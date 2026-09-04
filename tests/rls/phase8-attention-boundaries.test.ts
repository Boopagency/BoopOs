/**
 * FASE 8 — as leituras do motor de atenção, aos pares.
 *
 * O motor não consulta tabela: ele chama loaders de domínio que já carregam o
 * próprio guard. Este arquivo prova que essas leituras continuam escopadas
 * quando feitas sob a identidade de cada persona — que a superfície nova não
 * abriu caminho nenhum.
 *
 * Nenhuma policy mudou nesta fase. O valor aqui é justamente esse: se algum
 * caso ficar vermelho, a regressão é de autorização, não de layout.
 *
 * Cada asserção feliz tem par negativo. Um caso que só verifica o caminho feliz
 * não prova isolamento (.claude/rules/testing.md).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, switchIdentity, withIdentity, type Tx } from './support/db'
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
 * A leitura de `getOnboardingStateForClient`, em SQL: só a coluna `status`.
 *
 * A projeção mínima é de propósito — a Home roda isto em toda abertura, e o
 * formulário inteiro não tem por que atravessar a fronteira para responder
 * "é a vez do cliente?".
 */
async function statusDaSubmissao(tx: Tx, projectId: string): Promise<string | null> {
  const { rows } = await tx.query<{ status: string }>(
    `select status from public.onboarding_submissions where project_id = $1`,
    [projectId],
  )
  return rows[0]?.status ?? null
}

/** A outra leitura da source: a etapa existe para este projeto? */
async function temEtapaOnboarding(tx: Tx, projectId: string): Promise<boolean> {
  const { rows } = await tx.query(
    `select id from public.project_stages
      where project_id = $1 and stage_key = 'onboarding'`,
    [projectId],
  )
  return rows.length > 0
}

/**
 * Um projeto social com etapa de onboarding, criado pelo caminho real.
 *
 * `create_project_with_journey` deriva o autor de `auth.uid()`: cria-se como
 * `boop_admin`, nunca como `service_role`.
 */
async function projetoComOnboarding(tx: Tx, clientId: string, nome: string): Promise<string> {
  await switchIdentity(tx, asUser(BOOP_ADMIN))

  const { rows } = await tx.query<{ id: string }>(
    `select public.create_project_with_journey($1, $2, 'social', 'social.v1', $3::jsonb, null) as id`,
    [
      clientId,
      nome,
      JSON.stringify([
        { key: 'onboarding', label: 'Onboarding' },
        { key: 'immersion', label: 'Imersão' },
      ]),
    ],
  )

  return rows[0]!.id
}

/* ═══ 1. A submissão que a atenção lê é escopada por tenant ════════════════ */

describe('onboarding_submissions — a leitura do motor', () => {
  it('client_user de A lê a submissão de A', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      expect(await statusDaSubmissao(tx, PROJETO_HARTMANN)).not.toBeNull()
    })
  })

  it('⚠️ client_user de A NÃO lê a submissão de B — nem com o project id exato', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      expect(await statusDaSubmissao(tx, PROJETO_VELMONT)).toBeNull()
    })
  })

  it('client_user de B lê a de B e não a de A', async () => {
    await withIdentity(db, asUser(CLIENTE_B), async (tx) => {
      expect(await statusDaSubmissao(tx, PROJETO_VELMONT)).not.toBeNull()
      expect(await statusDaSubmissao(tx, PROJETO_HARTMANN)).toBeNull()
    })
  })

  it('boop_admin alcança os dois tenants (D-08)', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      expect(await statusDaSubmissao(tx, PROJETO_HARTMANN)).not.toBeNull()
      expect(await statusDaSubmissao(tx, PROJETO_VELMONT)).not.toBeNull()
    })
  })

  it('boop_member vinculado a A lê A e NÃO lê B', async () => {
    await withIdentity(db, asUser(MEMBRO_A), async (tx) => {
      expect(await statusDaSubmissao(tx, PROJETO_HARTMANN)).not.toBeNull()
      expect(await statusDaSubmissao(tx, PROJETO_VELMONT)).toBeNull()
    })
  })

  it('⚠️ boop_member SEM vínculo não lê nenhuma das duas', async () => {
    await withIdentity(db, asUser(MEMBRO_SEM_VINCULO), async (tx) => {
      expect(await statusDaSubmissao(tx, PROJETO_HARTMANN)).toBeNull()
      expect(await statusDaSubmissao(tx, PROJETO_VELMONT)).toBeNull()
    })
  })

  it('⚠️ usuário desabilitado perde o acesso — nenhuma atenção é derivável', async () => {
    await withIdentity(db, asUser(CLIENTE_A_DESABILITADO), async (tx) => {
      expect(await statusDaSubmissao(tx, PROJETO_HARTMANN)).toBeNull()
    })
  })
})

/* ═══ 2. A etapa que decide `unsupported` também é escopada ════════════════ */

describe('project_stages — a etapa de onboarding', () => {
  it('a etapa criada em A é visível para o cliente de A', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await projetoComOnboarding(tx, HARTMANN, 'Social com onboarding')

      await switchIdentity(tx, asUser(CLIENTE_A))
      expect(await temEtapaOnboarding(tx, projeto)).toBe(true)
    })
  })

  it('⚠️ a etapa criada em B é invisível para o cliente de A', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await projetoComOnboarding(tx, VELMONT, 'Social do outro tenant')

      await switchIdentity(tx, asUser(CLIENTE_A))
      expect(await temEtapaOnboarding(tx, projeto)).toBe(false)
    })
  })

  it('os projetos do seed não têm etapa de onboarding — a source responde `unsupported`', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      expect(await temEtapaOnboarding(tx, PROJETO_HARTMANN)).toBe(false)
    })
  })
})

/* ═══ 3. O ciclo que produz atenção, ponta a ponta ═════════════════════════ */

describe('draft é a única vez do cliente', () => {
  it('a Boop abre e o cliente passa a ler `draft`', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await projetoComOnboarding(tx, HARTMANN, 'Social para abrir')
      await tx.query(`select public.start_onboarding($1)`, [projeto])

      await switchIdentity(tx, asUser(CLIENTE_A))

      expect(await temEtapaOnboarding(tx, projeto)).toBe(true)
      expect(await statusDaSubmissao(tx, projeto)).toBe('draft')
    })
  })

  it('⚠️ o cliente do OUTRO tenant não vê esse `draft`', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await projetoComOnboarding(tx, HARTMANN, 'Social para abrir')
      await tx.query(`select public.start_onboarding($1)`, [projeto])

      await switchIdentity(tx, asUser(CLIENTE_B))
      expect(await statusDaSubmissao(tx, projeto)).toBeNull()
    })
  })

  it('antes de a Boop abrir, não há submissão — `not_started`, e nada a cobrar', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await projetoComOnboarding(tx, HARTMANN, 'Social sem abrir')

      await switchIdentity(tx, asUser(CLIENTE_A))

      expect(await temEtapaOnboarding(tx, projeto)).toBe(true)
      expect(await statusDaSubmissao(tx, projeto)).toBeNull()
    })
  })

  it('⚠️ o cliente não consegue abrir a própria submissão', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await projetoComOnboarding(tx, HARTMANN, 'Social sem abrir')

      await switchIdentity(tx, asUser(CLIENTE_A))

      /*
       * É por isso que `not_started` não gera atenção: cobrar do cliente uma
       * ação que a fronteira recusa seria ruído com cara de cuidado.
       */
      await expect(tx.query(`select public.start_onboarding($1)`, [projeto])).rejects.toThrow()
    })
  })
})

/* ═══ 4. O que a projeção NÃO carrega ══════════════════════════════════════ */

describe('a projeção do motor é mínima', () => {
  it('a leitura declara uma coluna só — nada de `select *`', async () => {
    const { readFileSync } = await import('node:fs')
    const fonte = readFileSync('src/domains/onboarding/types.ts', 'utf8')

    expect(fonte).toContain("SUBMISSION_STATE_COLUMNS = 'status'")
  })

  it('⚠️ `template_id` não atravessa a fronteira do motor', async () => {
    const { readFileSync } = await import('node:fs')
    const fonte = readFileSync('src/domains/attention/sources/onboarding.ts', 'utf8')

    expect(fonte).not.toMatch(/template_id/)
  })
})

/* ═══ 5. Um cliente com MAIS DE UM projeto ═════════════════════════════════ */

/**
 * O seed tem um projeto por cliente, e por isso a pergunta do multi-projeto
 * não estava respondida por nenhum caso: dois projetos do MESMO tenant passam
 * pela mesma policy, e a policy sozinha não separa um do outro. O que separa é
 * o `project_id` da consulta — e é isso que se prova aqui, contra Postgres de
 * verdade e pelo caminho real de criação.
 */
describe('dois projetos do mesmo cliente não se misturam', () => {
  it('o cliente lê os DOIS projetos do próprio tenant', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const primeiro = await projetoComOnboarding(tx, HARTMANN, 'Social — ciclo A')
      const segundo = await projetoComOnboarding(tx, HARTMANN, 'Social — ciclo B')

      await switchIdentity(tx, asUser(CLIENTE_A))

      const { rows } = await tx.query<{ id: string }>(
        `select id from public.projects where id = any($1::uuid[])`,
        [[primeiro, segundo]],
      )

      expect(rows.map((r) => r.id).sort()).toEqual([primeiro, segundo].sort())
    })
  })

  it('⚠️ o `draft` de um projeto NÃO aparece na leitura do outro', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const semAbrir = await projetoComOnboarding(tx, HARTMANN, 'Social — ciclo A')
      const aberto = await projetoComOnboarding(tx, HARTMANN, 'Social — ciclo B')
      await tx.query(`select public.start_onboarding($1)`, [aberto])

      await switchIdentity(tx, asUser(CLIENTE_A))

      /*
       * A Home do primeiro projeto tem de ficar calma enquanto a do segundo
       * cobra ação. Se a leitura fosse por cliente em vez de por projeto, os
       * dois exibiriam a mesma pendência — e o cliente clicaria num onboarding
       * que não é o daquela tela.
       */
      expect(await statusDaSubmissao(tx, semAbrir)).toBeNull()
      expect(await statusDaSubmissao(tx, aberto)).toBe('draft')
    })
  })

  it('⚠️ nem com os dois ids na mão o outro tenant lê qualquer um deles', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const primeiro = await projetoComOnboarding(tx, HARTMANN, 'Social — ciclo A')
      const segundo = await projetoComOnboarding(tx, HARTMANN, 'Social — ciclo B')
      await tx.query(`select public.start_onboarding($1)`, [segundo])

      await switchIdentity(tx, asUser(CLIENTE_B))

      const { rows } = await tx.query(`select id from public.projects where id = any($1::uuid[])`, [
        [primeiro, segundo],
      ])

      expect(rows).toHaveLength(0)
      expect(await statusDaSubmissao(tx, segundo)).toBeNull()
    })
  })

  it('a etapa de onboarding de um projeto não vaza para o irmão', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const comEtapa = await projetoComOnboarding(tx, HARTMANN, 'Social — ciclo A')

      await switchIdentity(tx, asUser(CLIENTE_A))

      expect(await temEtapaOnboarding(tx, comEtapa)).toBe(true)
      /* O projeto do seed é do mesmo cliente e continua sem a etapa. */
      expect(await temEtapaOnboarding(tx, PROJETO_HARTMANN)).toBe(false)
    })
  })
})
