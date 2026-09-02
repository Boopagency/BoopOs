/**
 * O que acontece quando alguem TENTA.
 *
 * A suite de isolamento prova o que cada papel enxerga. Esta prova o que cada
 * papel consegue FAZER quando escreve a query a mao — que e o cenario real:
 * a Data API do Supabase aceita qualquer `insert`, `update` e `delete` que o
 * navegador montar, e a unica coisa entre esse payload e a tabela e a policy.
 *
 * Nenhum caso aqui depende da interface. Todos escrevem SQL direto, como quem
 * abriu o console e resolveu tentar.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, SERVICE_ROLE, switchIdentity, withIdentity } from './support/db'
import type { Identity, Tx } from './support/db'
import {
  BOOP_ADMIN,
  CLIENTE_A,
  CONTEUDO_A_VISIVEL,
  CONTEUDO_B_VISIVEL,
  HARTMANN,
  MEMBRO_A,
  MEMBRO_SEM_VINCULO,
  PROJETO_HARTMANN,
  PROJETO_VELMONT,
  VELMONT,
  VERSAO_A_AGUARDANDO,
} from './support/fixtures'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db?.end()
})

/**
 * Roda a escrita e afirma que ela NAO teve efeito.
 *
 * Uma policy pode barrar de duas formas, e as duas sao aceitaveis: erro de
 * privilegio/RLS (42501), ou zero linhas afetadas — porque o `USING` de um
 * UPDATE ou DELETE simplesmente nao encontra a linha. O que nao pode acontecer
 * e a operacao valer.
 */
async function negado(tx: Tx, sql: string, params: unknown[] = []) {
  await tx.query('savepoint tentativa')
  try {
    const resultado = await tx.query(sql, params)
    await tx.query('rollback to savepoint tentativa')
    return { bloqueado: resultado.rowCount === 0, motivo: `afetou ${resultado.rowCount} linha(s)` }
  } catch (error) {
    await tx.query('rollback to savepoint tentativa')
    const pg = error as { code?: string; message?: string }
    return { bloqueado: true, motivo: `${pg.code}: ${pg.message}` }
  }
}

function comoUsuario(identity: Identity, corpo: (tx: Tx) => Promise<void>) {
  return withIdentity(db, identity, corpo)
}

describe('spoof de tenant na escrita', () => {
  it('membro da Hartmann nao cria conteudo no projeto da Velmont', async () =>
    comoUsuario(asUser(MEMBRO_A), async (tx) => {
      /*
       * O ataque mais direto que existe: o `project_id` e um campo do payload.
       * O `client_id` nem sequer e enviado — o trigger da FASE 2 o deriva do
       * projeto —, entao a linha nasceria como Velmont e a policy de INSERT e
       * quem tem que recusar.
       */
      const r = await negado(
        tx,
        `insert into public.content_items (project_id, title, channel, format, status)
         values ($1, 'invasao', 'instagram', 'reel', 'idea')`,
        [PROJETO_VELMONT],
      )
      expect(r.bloqueado, `criou conteudo na Velmont: ${r.motivo}`).toBe(true)
    }))

  it('cliente da Hartmann nao comenta em conteudo da Velmont', async () =>
    comoUsuario(asUser(CLIENTE_A), async (tx) => {
      const r = await negado(
        tx,
        `insert into public.content_comments (content_item_id, body, is_internal)
         values ($1, 'oi', false)`,
        [CONTEUDO_B_VISIVEL],
      )
      expect(r.bloqueado, `comentou na Velmont: ${r.motivo}`).toBe(true)
    }))

  it('cliente nao escreve comentario interno nem no proprio tenant', async () =>
    comoUsuario(asUser(CLIENTE_A), async (tx) => {
      /* Escrever na conversa que ele nao pode ler. */
      const r = await negado(
        tx,
        `insert into public.content_comments (content_item_id, body, is_internal)
         values ($1, 'interno', true)`,
        [CONTEUDO_A_VISIVEL],
      )
      expect(r.bloqueado, `marcou comentario como interno: ${r.motivo}`).toBe(true)
    }))

  it('ninguem comenta em nome de outra pessoa', async () =>
    comoUsuario(asUser(CLIENTE_A), async (tx) => {
      /* `author_id` e o que a tela mostra: assinar com o id alheio e
       * falsificar registro, mesmo dentro do proprio tenant. */
      const r = await negado(
        tx,
        `insert into public.content_comments (content_item_id, body, is_internal, author_id)
         values ($1, 'assinado por outro', false, $2)`,
        [CONTEUDO_A_VISIVEL, MEMBRO_A],
      )
      expect(r.bloqueado, `assinou como terceiro: ${r.motivo}`).toBe(true)
    }))

  it('membro sem vinculo nao escreve em lugar nenhum', async () =>
    comoUsuario(asUser(MEMBRO_SEM_VINCULO), async (tx) => {
      const r = await negado(
        tx,
        `insert into public.content_items (project_id, title, channel, format, status)
         values ($1, 'sem vinculo', 'instagram', 'reel', 'idea')`,
        [PROJETO_HARTMANN],
      )
      expect(r.bloqueado, `escreveu sem vinculo: ${r.motivo}`).toBe(true)
    }))
})

describe('mudanca de tenant em linha existente', () => {
  it('membro nao move conteudo da Hartmann para a Velmont', async () =>
    comoUsuario(asUser(MEMBRO_A), async (tx) => {
      /*
       * Duas fechaduras: o `WITH CHECK` da policy e o trigger de imutabilidade
       * da FASE 2. Qualquer uma das duas basta — e e por isso que existem as
       * duas.
       */
      const r = await negado(tx, 'update public.content_items set client_id = $1 where id = $2', [
        VELMONT,
        CONTEUDO_A_VISIVEL,
      ])
      expect(r.bloqueado, `moveu de tenant: ${r.motivo}`).toBe(true)
    }))

  it('admin tambem nao move: escopo global nao e licenca para reescrever tenant', async () =>
    comoUsuario(asUser(BOOP_ADMIN), async (tx) => {
      const r = await negado(tx, 'update public.content_items set client_id = $1 where id = $2', [
        VELMONT,
        CONTEUDO_A_VISIVEL,
      ])
      expect(r.bloqueado, `admin moveu de tenant: ${r.motivo}`).toBe(true)
    }))

  it('membro nao repoe o projeto de um conteudo para outro tenant', async () =>
    comoUsuario(asUser(MEMBRO_A), async (tx) => {
      const r = await negado(tx, 'update public.content_items set project_id = $1 where id = $2', [
        PROJETO_VELMONT,
        CONTEUDO_A_VISIVEL,
      ])
      expect(r.bloqueado, `trocou o projeto: ${r.motivo}`).toBe(true)
    }))

  it('cliente nao altera conteudo do proprio tenant', async () =>
    comoUsuario(asUser(CLIENTE_A), async (tx) => {
      /* Ler o que ja foi compartilhado, sim. Reescrever, nao — nem o titulo. */
      const r = await negado(tx, `update public.content_items set title = 'meu' where id = $1`, [
        CONTEUDO_A_VISIVEL,
      ])
      expect(r.bloqueado, `cliente editou conteudo: ${r.motivo}`).toBe(true)
    }))
})

describe('escalada de papel', () => {
  const tentativas: [string, string][] = [
    ['client_user vira boop_admin', `update public.profiles set role = 'boop_admin' where id = $1`],
    ['client_user se reativa', `update public.profiles set status = 'active' where id = $1`],
  ]

  for (const [nome, sql] of tentativas) {
    it(`${nome} — negado`, async () =>
      comoUsuario(asUser(CLIENTE_A), async (tx) => {
        const r = await negado(tx, sql, [CLIENTE_A])
        expect(r.bloqueado, `${nome}: ${r.motivo}`).toBe(true)
      }))
  }

  it('boop_member vira boop_admin — negado', async () =>
    comoUsuario(asUser(MEMBRO_A), async (tx) => {
      const r = await negado(tx, `update public.profiles set role = 'boop_admin' where id = $1`, [
        MEMBRO_A,
      ])
      expect(r.bloqueado, `membro escalou: ${r.motivo}`).toBe(true)
    }))

  it('nem o admin escreve em profiles pela Data API', async () =>
    comoUsuario(asUser(BOOP_ADMIN), async (tx) => {
      /*
       * `profiles` nao tem policy de UPDATE para ninguem, e nao tem GRANT de
       * UPDATE. Administrar pessoa e workflow da FASE 5, com regra propria —
       * nao um `update` solto que tambem serviria para se autopromover.
       */
      const r = await negado(tx, `update public.profiles set role = 'client_user' where id = $1`, [
        MEMBRO_A,
      ])
      expect(r.bloqueado, `admin escreveu em profiles: ${r.motivo}`).toBe(true)
    }))

  it('ninguem insere perfil: identidade nasce do espelho de auth.users', async () =>
    comoUsuario(asUser(BOOP_ADMIN), async (tx) => {
      const r = await negado(
        tx,
        `insert into public.profiles (id, email, role, status)
         values (gen_random_uuid(), 'novo@example.com', 'boop_admin', 'active')`,
      )
      expect(r.bloqueado, `criou perfil: ${r.motivo}`).toBe(true)
    }))
})

describe('vinculo: quem concede acesso', () => {
  it('membro sem vinculo nao se concede vinculo', async () =>
    comoUsuario(asUser(MEMBRO_SEM_VINCULO), async (tx) => {
      /* O ataque que transforma "sem acesso" em "acesso a tudo" em uma linha. */
      const r = await negado(
        tx,
        'insert into public.client_memberships (client_id, user_id) values ($1, $2)',
        [HARTMANN, MEMBRO_SEM_VINCULO],
      )
      expect(r.bloqueado, `self-grant: ${r.motivo}`).toBe(true)
    }))

  it('cliente nao se concede vinculo com outro tenant', async () =>
    comoUsuario(asUser(CLIENTE_A), async (tx) => {
      const r = await negado(
        tx,
        'insert into public.client_memberships (client_id, user_id) values ($1, $2)',
        [VELMONT, CLIENTE_A],
      )
      expect(r.bloqueado, `cliente se vinculou a outro tenant: ${r.motivo}`).toBe(true)
    }))

  it('membro vinculado nao concede vinculo a terceiro', async () =>
    comoUsuario(asUser(MEMBRO_A), async (tx) => {
      /* Conceder acesso e privilegio de admin: um membro que pudesse fazer
       * isso poderia dar a propria conta acesso a qualquer cliente. */
      const r = await negado(
        tx,
        'insert into public.client_memberships (client_id, user_id) values ($1, $2)',
        [HARTMANN, MEMBRO_SEM_VINCULO],
      )
      expect(r.bloqueado, `membro concedeu vinculo: ${r.motivo}`).toBe(true)
    }))

  it('cliente nao revoga o proprio vinculo nem o de ninguem', async () =>
    comoUsuario(asUser(CLIENTE_A), async (tx) => {
      const r = await negado(tx, 'delete from public.client_memberships where client_id = $1', [
        HARTMANN,
      ])
      expect(r.bloqueado, `cliente revogou vinculo: ${r.motivo}`).toBe(true)
    }))
})

describe('aprovacao nao se forja pela Data API', () => {
  /*
   * A regra mais importante da fase, e a que mais parece um detalhe.
   *
   * Aprovacao e registro de decisao do cliente. Se ela pudesse ser gravada por
   * `insert` direto, uma linha de SQL diria que o cliente aprovou algo que ele
   * nunca viu — e a maquina de estados que confere "esta versao estava mesmo
   * aguardando aprovacao?" seria contornada por completo.
   *
   * `boop_admin` esta na lista de propósito: escopo global (D-08) e sobre
   * QUAIS clientes ele alcanca, nao sobre quais invariantes de dominio ele
   * pode quebrar. Nem ele aprova em nome do cliente.
   */
  const papeis: [string, string][] = [
    ['client_user', CLIENTE_A],
    ['boop_member', MEMBRO_A],
    ['boop_admin', BOOP_ADMIN],
  ]

  for (const [nome, id] of papeis) {
    it(`${nome} nao insere content_approvals`, async () =>
      comoUsuario(asUser(id), async (tx) => {
        const r = await negado(
          tx,
          `insert into public.content_approvals (content_version_id, decided_by, decision)
           values ($1, $2, 'approved')`,
          [VERSAO_A_AGUARDANDO, id],
        )
        expect(r.bloqueado, `${nome} forjou aprovacao de conteudo: ${r.motivo}`).toBe(true)
      }))

    it(`${nome} nao insere strategy_approvals`, async () =>
      comoUsuario(asUser(id), async (tx) => {
        const r = await negado(
          tx,
          `insert into public.strategy_approvals (strategy_version_id, decided_by, decision)
           values ($1, $2, 'approved')`,
          ['51000000-0000-4000-8000-000000000002', id],
        )
        expect(r.bloqueado, `${nome} forjou aprovacao de estrategia: ${r.motivo}`).toBe(true)
      }))

    it(`${nome} nao apaga aprovacao existente`, async () =>
      comoUsuario(asUser(id), async (tx) => {
        const r = await negado(tx, 'delete from public.content_approvals where client_id = $1', [
          HARTMANN,
        ])
        expect(r.bloqueado, `${nome} apagou aprovacao: ${r.motivo}`).toBe(true)
      }))
  }
})

describe('activity_log e notifications nao se escrevem pela Data API', () => {
  const papeis: [string, string][] = [
    ['client_user', CLIENTE_A],
    ['boop_member', MEMBRO_A],
    ['boop_admin', BOOP_ADMIN],
  ]

  for (const [nome, id] of papeis) {
    it(`${nome} nao insere no activity_log`, async () =>
      comoUsuario(asUser(id), async (tx) => {
        /* Forjar auditoria e pior do que nao ter: o log passa a mentir. */
        const r = await negado(
          tx,
          `insert into public.activity_log (actor_id, entity_type, action, metadata)
           values ($1, 'profile', 'user.joined', '{}'::jsonb)`,
          [id],
        )
        expect(r.bloqueado, `${nome} escreveu no log: ${r.motivo}`).toBe(true)
      }))

    it(`${nome} nao apaga linha do activity_log`, async () =>
      comoUsuario(asUser(id), async (tx) => {
        const r = await negado(tx, 'delete from public.activity_log where client_id = $1', [
          HARTMANN,
        ])
        expect(r.bloqueado, `${nome} apagou auditoria: ${r.motivo}`).toBe(true)
      }))

    it(`${nome} nao insere notificacao`, async () =>
      comoUsuario(asUser(id), async (tx) => {
        const r = await negado(
          tx,
          `insert into public.notifications (client_id, kind, recipient_email, dedupe_key)
           values ($1, 'teste', 'x@example.com', 'k')`,
          [HARTMANN],
        )
        expect(r.bloqueado, `${nome} criou notificacao: ${r.motivo}`).toBe(true)
      }))
  }

  it('o trigger append-only vale ate para service_role', async () =>
    comoUsuario(SERVICE_ROLE, async (tx) => {
      /* RLS sozinha nao bastaria: `service_role` a ignora por definicao. O
       * trigger e o que vale para todo mundo (ADR-0012/0019). */
      const erro = await tx.expectError('update public.activity_log set action = $1 where id = 1', [
        'x.y',
      ])
      expect(erro.code).toBe('42501')
    }))
})

describe('record_activity: a fronteira privilegiada nao aceita ser apontada', () => {
  it('nao atribui evento a tenant que o autor nao alcanca', async () =>
    comoUsuario(asUser(MEMBRO_A), async (tx) => {
      const erro = await tx.expectError(
        `select public.record_activity('user.joined', 'profile', null, $1, null, '{}'::jsonb, 'internal')`,
        [VELMONT],
      )
      expect(erro.code).toBe('42501')
    }))

  it('nao atribui evento a projeto que o autor nao alcanca', async () =>
    comoUsuario(asUser(MEMBRO_A), async (tx) => {
      const erro = await tx.expectError(
        `select public.record_activity('user.joined', 'profile', null, null, $1, '{}'::jsonb, 'internal')`,
        [PROJETO_VELMONT],
      )
      expect(erro.code).toBe('42501')
    }))

  it('o autor gravado e sempre a sessao, nunca o que o payload diria', async () =>
    comoUsuario(asUser(CLIENTE_A), async (tx) => {
      await tx.query(
        `select public.record_activity('user.joined', 'profile', null, $1, null, '{}'::jsonb, 'internal')`,
        [HARTMANN],
      )

      /* O cliente nao le o log (D-05), entao a conferencia sai do papel que
       * enxerga — o que tambem prova que a linha existiu de verdade. */
      await switchIdentity(tx, SERVICE_ROLE)
      const { rows } = await tx.query<{ actor_id: string }>(
        'select actor_id from public.activity_log order by id desc limit 1',
      )
      expect(rows[0]?.actor_id).toBe(CLIENTE_A)
    }))
})

describe('promocao de primeiro login', () => {
  it('nao existe forma de apontar a promocao para outra pessoa', async () => {
    /* A funcao nao tem parametro nenhum: nao ha o que apontar. O teste guarda
     * a assinatura, que e o que impede alguem de "so acrescentar um userId". */
    const { rows } = await db.query<{ args: string }>(
      `select pg_get_function_arguments(p.oid) as args
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'promote_invited_profile'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]?.args).toBe('')
  })

  it('quem esta disabled nao se reativa chamando a funcao', async () =>
    comoUsuario(asUser('10000000-0000-4000-8000-000000000007'), async (tx) => {
      const { rows } = await tx.query<{ r: string }>('select public.promote_invited_profile() as r')
      expect(rows[0]?.r).toBe('disabled')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows: perfil } = await tx.query<{ status: string }>(
        'select status from public.profiles where id = $1',
        ['10000000-0000-4000-8000-000000000007'],
      )
      expect(perfil[0]?.status).toBe('disabled')
    }))

  it('promover duas vezes gera um unico user.joined', async () =>
    comoUsuario(SERVICE_ROLE, async (tx) => {
      /* Cenario montado com privilegio; a operacao sob teste roda como o
       * proprio usuario logo abaixo. */
      const convidado = '10000000-0000-4000-8000-0000000000aa'
      await tx.query('reset role')
      await tx.query('insert into auth.users (id, email) values ($1, $2)', [
        convidado,
        'convidado@example.com',
      ])

      await switchIdentity(tx, asUser(convidado))
      const primeira = await tx.query<{ r: string }>('select public.promote_invited_profile() as r')
      const segunda = await tx.query<{ r: string }>('select public.promote_invited_profile() as r')

      expect(primeira.rows[0]?.r).toBe('promoted')
      expect(segunda.rows[0]?.r).toBe('already_active')

      await switchIdentity(tx, SERVICE_ROLE)
      const { rows } = await tx.query<{ n: string }>(
        `select count(*) as n from public.activity_log
          where action = 'user.joined' and entity_id = $1`,
        [convidado],
      )
      expect(Number(rows[0]?.n)).toBe(1)
    }))
})
