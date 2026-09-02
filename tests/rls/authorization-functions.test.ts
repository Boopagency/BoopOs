/**
 * As funcoes `app.*` — a base sobre a qual toda policy decide.
 *
 * Elas sao testadas antes das policies e separadas delas de proposito: uma
 * policy errada nega demais e alguem reclama; uma FUNCAO errada concede demais
 * em dezenove tabelas ao mesmo tempo, e ninguem reclama.
 *
 * Todo caso e escrito aos pares — quem recebe `true` e quem recebe `false`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { ANONYMOUS, asUser, connect, withIdentity, withRollback } from './support/db'
import type { Identity, Tx } from './support/db'
import {
  BOOP_ADMIN,
  CLIENTE_A,
  CLIENTE_A_DESABILITADO,
  CLIENTE_B,
  HARTMANN,
  MEMBRO_A,
  MEMBRO_SEM_VINCULO,
  PROJETO_HARTMANN,
  PROJETO_VELMONT,
  VELMONT,
} from './support/fixtures'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db?.end()
})

/**
 * Assume a identidade pelo CLAIM, sem trocar de papel no Postgres.
 *
 * `authenticated` nao tem `usage` no schema `app` — de proposito, e o
 * `schema.test.ts` guarda essa propriedade. Entao chamar `app.has_client_access`
 * diretamente como `authenticated` da "permission denied", que e o
 * comportamento correto e nao o que este arquivo esta medindo.
 *
 * O que a funcao decide depende de uma coisa so: `auth.uid()`, que sai do
 * claim configurado aqui. As tabelas que ela le sao lidas com `security
 * definer`, ou seja, sem RLS, tanto faz quem chama. Medir a decisao como dono
 * do banco mede exatamente a mesma decisao que a policy vai tomar.
 *
 * A prova de que `authenticated` nao alcanca `app` esta no fim do arquivo.
 */
async function comIdentidade<T>(identity: Identity, run: (tx: Tx) => Promise<T>): Promise<T> {
  return withRollback(db, async (tx) => {
    const claims =
      identity.kind === 'user'
        ? JSON.stringify({ sub: identity.userId, role: 'authenticated' })
        : ''
    await tx.query('select set_config($1, $2, true)', ['request.jwt.claims', claims])
    return run(tx)
  })
}

/** Roda uma expressao SQL sob a identidade dada e devolve o resultado. */
async function evaluate<T>(identity: Identity, expression: string, params: unknown[] = []) {
  return comIdentidade(identity, async (tx) => {
    const { rows } = await tx.query<{ resultado: T }>(`select ${expression} as resultado`, params)
    return rows[0]?.resultado
  })
}

describe('app.actor_role()', () => {
  const casos: [string, Identity, string | null][] = [
    ['boop_admin recebe boop_admin', asUser(BOOP_ADMIN), 'boop_admin'],
    ['boop_member recebe boop_member', asUser(MEMBRO_A), 'boop_member'],
    [
      'member sem vinculo continua boop_member — papel e global',
      asUser(MEMBRO_SEM_VINCULO),
      'boop_member',
    ],
    ['client_user recebe client_user', asUser(CLIENTE_A), 'client_user'],
    ['desabilitado nao recebe papel nenhum', asUser(CLIENTE_A_DESABILITADO), null],
    ['anonimo nao recebe papel nenhum', ANONYMOUS, null],
  ]

  for (const [nome, identidade, esperado] of casos) {
    it(nome, async () => {
      expect(await evaluate<string | null>(identidade, 'app.actor_role()')).toBe(esperado)
    })
  }

  it('sessao valida sem perfil nao recebe papel', async () => {
    /* Um `sub` que nao existe em `profiles`: e o estado que sobra quando o
     * trigger de espelho falha. Sem perfil nao ha papel, e sem papel nao ha
     * acesso — nunca o contrario. */
    const orfao = '10000000-0000-4000-8000-0000000000ff'
    expect(await evaluate<string | null>(asUser(orfao), 'app.actor_role()')).toBeNull()
  })
})

describe('predicados de papel', () => {
  const casos: [string, Identity, boolean, boolean, boolean][] = [
    /*                                  is_boop_admin  is_boop  is_client_user */
    ['boop_admin', asUser(BOOP_ADMIN), true, true, false],
    ['boop_member', asUser(MEMBRO_A), false, true, false],
    ['client_user', asUser(CLIENTE_A), false, false, true],
    ['desabilitado', asUser(CLIENTE_A_DESABILITADO), false, false, false],
    ['anonimo', ANONYMOUS, false, false, false],
  ]

  for (const [nome, identidade, admin, boop, cliente] of casos) {
    it(`${nome}: admin=${admin} boop=${boop} cliente=${cliente}`, async () => {
      expect(await evaluate<boolean>(identidade, 'app.is_boop_admin()')).toBe(admin)
      expect(await evaluate<boolean>(identidade, 'app.is_boop()')).toBe(boop)
      expect(await evaluate<boolean>(identidade, 'app.is_client_user()')).toBe(cliente)
    })
  }
})

describe('app.has_client_access()', () => {
  /* D-08 inteira em uma tabela: cada linha e um par allow/deny. */
  const casos: [string, Identity, boolean, boolean][] = [
    ['boop_admin alcanca os dois tenants (escopo global)', asUser(BOOP_ADMIN), true, true],
    ['boop_member vinculado alcanca so o seu', asUser(MEMBRO_A), true, false],
    ['boop_member sem vinculo nao alcanca nenhum', asUser(MEMBRO_SEM_VINCULO), false, false],
    ['client_user da Hartmann alcanca so a Hartmann', asUser(CLIENTE_A), true, false],
    ['client_user da Velmont alcanca so a Velmont', asUser(CLIENTE_B), false, true],
    ['desabilitado nao alcanca nem o proprio tenant', asUser(CLIENTE_A_DESABILITADO), false, false],
    ['anonimo nao alcanca nada', ANONYMOUS, false, false],
  ]

  for (const [nome, identidade, hartmann, velmont] of casos) {
    it(nome, async () => {
      expect(await evaluate<boolean>(identidade, 'app.has_client_access($1)', [HARTMANN])).toBe(
        hartmann,
      )
      expect(await evaluate<boolean>(identidade, 'app.has_client_access($1)', [VELMONT])).toBe(
        velmont,
      )
    })
  }

  it('NULL devolve false — fail closed, nunca NULL', async () => {
    /* Uma linha sem tenant nao pode virar "talvez". Em policy, NULL nao
     * concede, mas tambem nao e legivel; aqui o contrato e boolean. */
    expect(await evaluate<boolean>(asUser(BOOP_ADMIN), 'app.has_client_access(null)')).toBe(false)
    expect(await evaluate<boolean>(asUser(CLIENTE_A), 'app.has_client_access(null)')).toBe(false)
  })

  it('escopo global do admin nao depende de a linha existir; quem exige isso e a FK', async () => {
    /*
     * Contrato deliberado, e vale escrito: para `boop_admin` a funcao responde
     * "voce alcanca este tenant", nao "este tenant existe". Confirmar a
     * existencia custaria uma consulta em TODA avaliacao de policy — e nao
     * compraria nada, porque `client_id` e sempre FK: uma escrita apontando
     * para cliente inexistente e rejeitada pelo banco de qualquer forma.
     *
     * Para quem NAO e admin a resposta ja e `false`, porque o `exists` de
     * vinculo nao casa com uuid nenhum. O par abaixo prova as duas metades.
     */
    const fantasma = '20000000-0000-4000-8000-0000000000ff'
    expect(
      await evaluate<boolean>(asUser(BOOP_ADMIN), 'app.has_client_access($1)', [fantasma]),
    ).toBe(true)
    expect(await evaluate<boolean>(asUser(MEMBRO_A), 'app.has_client_access($1)', [fantasma])).toBe(
      false,
    )
    expect(
      await evaluate<boolean>(asUser(CLIENTE_A), 'app.has_client_access($1)', [fantasma]),
    ).toBe(false)
  })

  it('vinculo de pessoa desabilitada nao concede acesso a ninguem', async () =>
    comIdentidade(asUser(CLIENTE_A_DESABILITADO), async (tx) => {
      /* A linha de vinculo EXISTE no seed: e exatamente por isso que o
       * predicado confere `status = 'active'` tambem dentro do `exists`. Sem
       * essa conferencia, o vinculo sobrevivente reabriria a porta pelo
       * segundo braco do `or`, contornando o primeiro. */
      const { rows: vinculo } = await tx.query(
        'select 1 from public.client_memberships where user_id = $1 and client_id = $2',
        [CLIENTE_A_DESABILITADO, HARTMANN],
      )
      expect(vinculo).toHaveLength(1)

      const { rows: acesso } = await tx.query<{ ok: boolean }>(
        'select app.has_client_access($1) as ok',
        [HARTMANN],
      )
      expect(acesso[0]?.ok).toBe(false)
    }))
})

describe('app.has_project_access()', () => {
  const casos: [string, Identity, boolean, boolean][] = [
    ['boop_admin alcanca os dois projetos', asUser(BOOP_ADMIN), true, true],
    ['boop_member vinculado alcanca so o projeto do seu cliente', asUser(MEMBRO_A), true, false],
    ['member sem vinculo nao alcanca projeto nenhum', asUser(MEMBRO_SEM_VINCULO), false, false],
    ['client_user alcanca so o projeto do proprio tenant', asUser(CLIENTE_A), true, false],
    ['desabilitado nao alcanca projeto', asUser(CLIENTE_A_DESABILITADO), false, false],
    ['anonimo nao alcanca projeto', ANONYMOUS, false, false],
  ]

  for (const [nome, identidade, hartmann, velmont] of casos) {
    it(nome, async () => {
      expect(
        await evaluate<boolean>(identidade, 'app.has_project_access($1)', [PROJETO_HARTMANN]),
      ).toBe(hartmann)
      expect(
        await evaluate<boolean>(identidade, 'app.has_project_access($1)', [PROJETO_VELMONT]),
      ).toBe(velmont)
    })
  }

  it('projeto inexistente devolve false', async () => {
    const fantasma = '30000000-0000-4000-8000-0000000000ff'
    expect(
      await evaluate<boolean>(asUser(BOOP_ADMIN), 'app.has_project_access($1)', [fantasma]),
    ).toBe(false)
    expect(await evaluate<boolean>(asUser(BOOP_ADMIN), 'app.has_project_access(null)')).toBe(false)
  })
})

describe('nenhuma funcao de autorizacao aceita identidade por parametro', () => {
  /*
   * A propriedade mais importante do arquivo inteiro, e a que uma revisao
   * humana esquece: se qualquer uma dessas funcoes aceitasse `user_id`, a
   * autorizacao passaria a depender de um valor que quem chama escolhe — e
   * quem chama, no fim da linha, e o navegador.
   *
   * O teste le o catalogo do Postgres, entao vale tambem para a funcao que
   * alguem acrescentar depois sem ler esta regra.
   */
  it('nenhum argumento nomeia QUEM esta pedindo', async () => {
    const { rows } = await db.query<{ nome: string; args: string }>(`
      select p.proname as nome,
             pg_get_function_arguments(p.oid) as args
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app'
         and p.proname in (
           'actor_role', 'is_boop_admin', 'is_boop', 'is_client_user',
           'has_client_access', 'has_project_access', 'has_template_access',
           'has_profile_access', 'has_section_access', 'has_submission_access',
           'can_answer_submission'
         )
    `)

    expect(rows.length).toBeGreaterThanOrEqual(11)

    for (const { nome, args } of rows) {
      /*
       * A distincao que importa: `has_profile_access(p_profile_id)` recebe o
       * ALVO da leitura, e isso e legitimo — `has_client_access(p_client_id)`
       * faz o mesmo. O que nenhuma delas pode receber e o autor do request.
       */
      expect(
        /\b(p_)?(user_id|actor_id|caller|caller_id|uid|jwt|sub)\b/.test(args),
        `app.${nome}(${args}) nomeia quem esta pedindo`,
      ).toBe(false)
    }
  })

  it('toda funcao resolve o autor por auth.uid(), direta ou indiretamente', async () => {
    /*
     * O outro lado do teste acima. Nao basta que o autor nao seja parametro:
     * ele precisa vir de algum lugar, e o unico lugar aceitavel e a sessao.
     * Uma funcao que nao mencione `auth.uid()` nem chame outra que mencione
     * esta decidindo autorizacao sem saber de quem — o que so pode dar em
     * conceder para todo mundo ou para ninguem.
     */
    const { rows } = await db.query<{ nome: string; corpo: string }>(`
      select p.proname as nome, p.prosrc as corpo
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app'
         and p.proname like any (array['actor_role', 'is_%', 'has_%', 'can_%'])
    `)

    for (const { nome, corpo } of rows) {
      expect(
        /auth\.uid\(\)/.test(corpo) ||
          /\bapp\.(actor_role|is_boop|is_boop_admin|is_client_user|has_client_access|has_template_access)\b/.test(
            corpo,
          ),
        `app.${nome} nao resolve o autor a partir da sessao`,
      ).toBe(true)
    }
  })

  it('toda funcao de app e security definer, stable e com search_path fechado', async () => {
    const { rows } = await db.query<{
      nome: string
      definer: boolean
      volatilidade: string
      config: string[] | null
    }>(`
      select p.proname as nome,
             p.prosecdef as definer,
             p.provolatile as volatilidade,
             p.proconfig as config
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app'
         and p.proname like any (array['actor_role', 'is_%', 'has_%', 'can_%'])
    `)

    expect(rows.length).toBeGreaterThanOrEqual(11)

    for (const { nome, definer, volatilidade, config } of rows) {
      expect(definer, `app.${nome} nao e security definer`).toBe(true)
      expect(volatilidade, `app.${nome} nao e stable`).toBe('s')
      expect(
        (config ?? []).some((entrada) => entrada.startsWith('search_path=')),
        `app.${nome} sem search_path fixado`,
      ).toBe(true)
    }
  })
})

describe('o schema app nao e alcancavel por quem usa a aplicacao', () => {
  /*
   * O contraponto do `comIdentidade` la de cima: as funcoes existem para as
   * policies, nao para a API. Se `authenticated` pudesse chama-las, teria em
   * maos um oraculo de autorizacao — `has_client_access(<uuid>)` respondendo
   * "este cliente existe e voce nao alcanca", que ja e mais do que ele pode
   * saber (ADR-0004).
   */
  it('authenticated nao executa app.has_client_access diretamente', async () =>
    withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const erro = await tx.expectError('select app.has_client_access($1)', [HARTMANN])
      expect(erro.code).toBe('42501')
      expect(erro.message).toMatch(/schema app/i)
    }))

  it('anon tampouco', async () =>
    withIdentity(db, ANONYMOUS, async (tx) => {
      const erro = await tx.expectError('select app.actor_role()')
      expect(erro.code).toBe('42501')
    }))
})
