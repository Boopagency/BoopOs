/**
 * O que o cliente NAO ve dentro do proprio tenant.
 *
 * Cliente A nao alcancar Cliente B e o caso que todo mundo lembra de testar.
 * O vazamento provavel e outro: o cliente enxergando o bastidor da Boop DENTRO
 * da propria conta — o rascunho que ninguem revisou, o comentario que a equipe
 * trocou sobre ele, a estrategia antes de estar pronta.
 *
 * Cada caso e um par: alguem da Boop ve a linha, o cliente do mesmo tenant nao.
 * Sem o lado positivo, um teste verde poderia significar apenas que a linha
 * nao existe.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, SERVICE_ROLE, switchIdentity, withIdentity } from './support/db'
import {
  BOOP_ADMIN,
  CLIENTE_A,
  CLIENTE_B,
  COMENTARIO_INTERNO,
  COMENTARIO_PUBLICO,
  CONTEUDO_A_INTERNO,
  CONTEUDO_A_VISIVEL,
  HARTMANN,
  MEMBRO_A,
  PROJETO_VELMONT,
  VELMONT,
  VERSAO_A_AGUARDANDO,
  VERSAO_A_RASCUNHO,
  VERSAO_ESTRATEGIA_A_APROVADA,
  VERSAO_ESTRATEGIA_A_RASCUNHO,
} from './support/fixtures'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db?.end()
})

/** A linha existe para quem? Devolve true se a identidade a enxerga. */
async function enxerga(userId: string, tabela: string, id: string): Promise<boolean> {
  return withIdentity(db, asUser(userId), async (tx) => {
    const { rows } = await tx.query(`select 1 from public.${tabela} where id = $1`, [id])
    return rows.length === 1
  })
}

/**
 * O par completo, em uma chamada: a Boop enxerga, o cliente nao.
 *
 * O lado positivo nao e decoracao. Sem ele, apagar a linha do seed faria o
 * teste passar — e ele estaria provando que nada vaza de uma tabela vazia.
 */
async function apenasParaBoop(tabela: string, id: string, oQue: string) {
  expect(await enxerga(MEMBRO_A, tabela, id), `a Boop nao enxerga ${oQue}`).toBe(true)
  expect(await enxerga(CLIENTE_A, tabela, id), `O CLIENTE ENXERGA ${oQue}`).toBe(false)
}

async function paraOsDois(tabela: string, id: string, oQue: string) {
  expect(await enxerga(MEMBRO_A, tabela, id), `a Boop nao enxerga ${oQue}`).toBe(true)
  expect(await enxerga(CLIENTE_A, tabela, id), `o cliente nao enxerga ${oQue}`).toBe(true)
}

describe('conteudo em producao', () => {
  it('`in_production` e bastidor; `awaiting_client` e conversa', async () => {
    await apenasParaBoop('content_items', CONTEUDO_A_INTERNO, 'conteudo em in_production')
    await paraOsDois('content_items', CONTEUDO_A_VISIVEL, 'conteudo em awaiting_client')
  })

  it('nenhum conteudo anterior a awaiting_client chega ao cliente', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      /* A afirmacao em bloco: qualquer status novo que alguem acrescente ao
       * enum e esqueca de classificar cai aqui. */
      const { rows } = await tx.query<{ status: string }>(
        'select distinct status::text from public.content_items',
      )
      const vistos = rows.map((r) => r.status)

      for (const escondido of ['idea', 'planned', 'in_production', 'internal_review']) {
        expect(vistos, `cliente viu conteudo em ${escondido}`).not.toContain(escondido)
      }
      expect(vistos.length).toBeGreaterThan(0)
    }))
})

describe('versoes de conteudo', () => {
  it('a versao que nunca saiu para aprovacao nao existe para o cliente', async () => {
    await apenasParaBoop('content_versions', VERSAO_A_RASCUNHO, 'versao em rascunho')
    await paraOsDois('content_versions', VERSAO_A_AGUARDANDO, 'versao enviada para aprovacao')
  })

  it('toda versao visivel ao cliente tem carimbo de envio', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query<{ n: string }>(
        'select count(*) as n from public.content_versions where sent_for_approval_at is null',
      )
      expect(Number(rows[0]?.n)).toBe(0)
    }))

  it('⚠️ internal_notes VEM na linha: RLS e row-level, nao column-level', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      /*
       * Este teste afirma uma LIMITACAO, nao uma protecao — e por isso ele
       * existe. A policy libera a linha inteira, `internal_notes` inclusive.
       * Se alguem escrever `select *` numa tela do cliente, a nota interna vai
       * junto.
       *
       * A protecao real e a projecao explicita no servidor, e a divida esta
       * registrada em docs/security.md. No dia em que uma view client-facing
       * ou um grant de coluna resolverem isso, este teste quebra — e quebrar
       * aqui e o aviso de que a documentacao precisa mudar junto.
       */
      const { rows } = await tx.query<{ tem: boolean }>(
        `select internal_notes is not null as tem
           from public.content_versions where id = $1`,
        [VERSAO_A_AGUARDANDO],
      )
      expect(rows).toHaveLength(1)
      expect(
        rows[0]?.tem,
        'internal_notes deixou de vir na linha — atualize docs/security.md e este teste',
      ).toBe(true)
    }))
})

describe('comentarios', () => {
  it('o comentario interno da Boop nao chega ao cliente do mesmo tenant', async () => {
    await apenasParaBoop('content_comments', COMENTARIO_INTERNO, 'comentario interno')
    await paraOsDois('content_comments', COMENTARIO_PUBLICO, 'comentario publico')
  })

  it('nenhum comentario com is_internal chega ao cliente', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query<{ n: string }>(
        'select count(*) as n from public.content_comments where is_internal',
      )
      expect(Number(rows[0]?.n)).toBe(0)
    }))
})

describe('estrategia', () => {
  it('rascunho e trabalho da Boop; o que saiu para aprovacao e do cliente', async () => {
    await apenasParaBoop(
      'strategy_versions',
      VERSAO_ESTRATEGIA_A_RASCUNHO,
      'estrategia em rascunho',
    )
    await paraOsDois('strategy_versions', VERSAO_ESTRATEGIA_A_APROVADA, 'estrategia aprovada')
  })

  it('nenhuma versao em draft chega ao cliente', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query<{ n: string }>(
        `select count(*) as n from public.strategy_versions where status = 'draft'`,
      )
      expect(Number(rows[0]?.n)).toBe(0)
    }))
})

describe('activity log e notificacoes', () => {
  it('D-05: o cliente nao le o proprio log', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query<{ n: string }>(
        'select count(*) as n from public.activity_log',
      )
      expect(Number(rows[0]?.n)).toBe(0)
    }))

  it('o membro le o log do seu escopo; o admin le tambem o que nao tem tenant', async () => {
    const semTenant = async (userId: string) =>
      withIdentity(db, asUser(userId), async (tx) => {
        const { rows } = await tx.query<{ n: string }>(
          'select count(*) as n from public.activity_log where client_id is null',
        )
        return Number(rows[0]?.n)
      })

    /* `client_id` NULL e linha de sistema: nao pertence a tenant nenhum, entao
     * so o escopo global a alcanca. Sem esta decisao escrita, um `or client_id
     * is null` bem-intencionado a entregaria a qualquer membro. */
    await withIdentity(db, SERVICE_ROLE, async (tx) => {
      await tx.query(
        `insert into public.activity_log (actor_id, entity_type, action, metadata)
         values ($1, 'profile', 'user.joined', '{}'::jsonb)`,
        [BOOP_ADMIN],
      )
      /* Dentro da transacao com rollback: a linha some no fim. */
      await switchIdentity(tx, asUser(MEMBRO_A))
      const { rows: doMembro } = await tx.query<{ n: string }>(
        'select count(*) as n from public.activity_log where client_id is null',
      )
      expect(Number(doMembro[0]?.n), 'membro alcancou linha de sistema').toBe(0)

      await switchIdentity(tx, asUser(BOOP_ADMIN))
      const { rows: doAdmin } = await tx.query<{ n: string }>(
        'select count(*) as n from public.activity_log where client_id is null',
      )
      expect(Number(doAdmin[0]?.n), 'admin nao alcancou linha de sistema').toBeGreaterThan(0)
    })

    expect(await semTenant(BOOP_ADMIN)).toBe(0) /* fora da transacao, o seed nao tem linha assim */
  })

  it('notificacao e operacao da Boop: nem o membro vinculado le', async () => {
    const contar = async (userId: string) =>
      withIdentity(db, asUser(userId), async (tx) => {
        const { rows } = await tx.query<{ n: string }>(
          'select count(*) as n from public.notifications',
        )
        return Number(rows[0]?.n)
      })

    expect(await contar(BOOP_ADMIN)).toBeGreaterThan(0)
    expect(await contar(MEMBRO_A)).toBe(0)
    expect(await contar(CLIENTE_A)).toBe(0)
  })
})

describe('catalogo de onboarding', () => {
  it('a Boop le o catalogo inteiro; o cliente so o template da propria submissao', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      /*
       * Cenario: um template que NENHUMA submissao usa. E o caso limite —
       * `has_template_access` so concede pelo caminho submissao -> template,
       * entao um template solto nao pertence a cliente nenhum.
       */
      const orfao = '40000000-0000-4000-8000-0000000000ff'
      await tx.query(
        `insert into public.onboarding_templates (id, key, name, project_type, version, is_active)
         values ($1, 'solto', 'Solto', 'social', 1, true)`,
        [orfao],
      )

      await switchIdentity(tx, asUser(MEMBRO_A))
      const { rows: daBoop } = await tx.query(
        'select 1 from public.onboarding_templates where id = $1',
        [orfao],
      )
      expect(daBoop, 'a Boop nao le o catalogo').toHaveLength(1)

      await switchIdentity(tx, asUser(CLIENTE_A))
      const { rows: doCliente } = await tx.query(
        'select 1 from public.onboarding_templates where id = $1',
        [orfao],
      )
      expect(doCliente, 'O CLIENTE LEU TEMPLATE SEM RELACAO COM A PROPRIA SUBMISSAO').toHaveLength(
        0,
      )
    }))

  it('template usado apenas por outro tenant nao chega ao cliente', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      /* Um template que so a Velmont usa. O cliente da Hartmann nao pode
       * alcanca-lo mesmo o catalogo sendo global. */
      const soDaVelmont = '40000000-0000-4000-8000-0000000000fe'
      await tx.query(
        `insert into public.onboarding_templates (id, key, name, project_type, version, is_active)
         values ($1, 'so-velmont', 'So Velmont', 'social', 1, true)`,
        [soDaVelmont],
      )
      await tx.query(
        'update public.onboarding_submissions set template_id = $1 where client_id = $2',
        [soDaVelmont, VELMONT],
      )

      await switchIdentity(tx, asUser(CLIENTE_B))
      const { rows: dono } = await tx.query(
        'select 1 from public.onboarding_templates where id = $1',
        [soDaVelmont],
      )
      expect(dono, 'o dono da submissao nao le o proprio template').toHaveLength(1)

      await switchIdentity(tx, asUser(CLIENTE_A))
      const { rows: alheio } = await tx.query(
        'select 1 from public.onboarding_templates where id = $1',
        [soDaVelmont],
      )
      expect(alheio, 'O CLIENTE LEU TEMPLATE DE OUTRO TENANT').toHaveLength(0)
    }))

  it('secoes e perguntas seguem o template', async () =>
    withIdentity(db, SERVICE_ROLE, async (tx) => {
      const orfao = '40000000-0000-4000-8000-0000000000fd'
      const secao = '41000000-0000-4000-8000-0000000000fd'
      await tx.query(
        `insert into public.onboarding_templates (id, key, name, project_type, version, is_active)
         values ($1, 'solto-2', 'Solto 2', 'social', 1, true)`,
        [orfao],
      )
      await tx.query(
        `insert into public.onboarding_sections (id, template_id, key, title, position)
         values ($1, $2, 'k', 'Secao solta', 1)`,
        [secao, orfao],
      )
      await tx.query(
        `insert into public.onboarding_questions (section_id, key, label, type, position, is_required)
         values ($1, 'q', 'Pergunta solta', 'short_text', 1, false)`,
        [secao],
      )

      await switchIdentity(tx, asUser(CLIENTE_A))
      const { rows: secoes } = await tx.query(
        'select 1 from public.onboarding_sections where id = $1',
        [secao],
      )
      expect(secoes, 'O CLIENTE LEU SECAO DE TEMPLATE ALHEIO').toHaveLength(0)

      const { rows: perguntas } = await tx.query(
        'select 1 from public.onboarding_questions where section_id = $1',
        [secao],
      )
      expect(perguntas, 'O CLIENTE LEU PERGUNTA DE TEMPLATE ALHEIO').toHaveLength(0)

      /* O par positivo: o catalogo que o cliente USA continua alcancavel. */
      const { rows: proprias } = await tx.query(
        `select 1 from public.onboarding_questions q
           join public.onboarding_sections s on s.id = q.section_id
           join public.onboarding_submissions sub on sub.template_id = s.template_id
          where sub.client_id = $1 limit 1`,
        [HARTMANN],
      )
      expect(proprias, 'o cliente perdeu o proprio catalogo').toHaveLength(1)
    }))
})

describe('clients.notes', () => {
  it('⚠️ vem na linha: mesma limitacao de internal_notes, mesma divida', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      /*
       * Igual ao caso de `content_versions.internal_notes`: a policy libera a
       * linha, e `notes` esta nela. Quem protege e a projecao do servidor.
       * Documentado em docs/security.md como divida da FASE 5.
       */
      const { rows } = await tx.query<{ tem: boolean }>(
        'select notes is not null as tem from public.clients where id = $1',
        [HARTMANN],
      )
      expect(rows).toHaveLength(1)
      expect(
        rows[0]?.tem,
        'clients.notes deixou de vir na linha — atualize docs/security.md e este teste',
      ).toBe(true)
    }))

  it('mas a linha do outro tenant nao vem de jeito nenhum', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query('select 1 from public.clients where id = $1', [VELMONT])
      expect(rows).toHaveLength(0)
    }))
})

describe('projeto de outro tenant', () => {
  it('trocar o id na URL nao entrega o projeto alheio', async () =>
    withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      /* O `projectId` da rota e endereco, nao prova: com o uuid correto em
       * maos, a linha continua nao existindo para quem nao tem vinculo. */
      const { rows } = await tx.query('select 1 from public.projects where id = $1', [
        PROJETO_VELMONT,
      ])
      expect(rows).toHaveLength(0)
    }))
})
