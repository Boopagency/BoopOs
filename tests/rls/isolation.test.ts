/**
 * Isolamento entre tenants — a razao de existir da FASE 4.
 *
 * A matriz abaixo declara, para cada tabela e cada papel, QUANTO daquilo a
 * pessoa enxerga. Nao ha caso solto: cada celula e verificada contra a
 * contagem real do banco lida como `service_role`, entao "ve o proprio tenant"
 * significa exatamente o numero de linhas que existem, e "nao ve o outro"
 * significa zero — nunca "menos do que antes".
 *
 * As quatro respostas possiveis:
 *
 *   tudo     ve os dois tenants inteiros (so `boop_admin`, por D-08)
 *   escopo   ve o proprio tenant inteiro; do outro, zero
 *   parcial  ve PARTE do proprio tenant; do outro, zero — a redacao interna
 *   nada     zero dos dois
 *
 * `parcial` e afirmado com desigualdade estrita: se um dia a redacao sumir e o
 * cliente passar a ver a linha inteira do proprio tenant, o teste quebra aqui,
 * e nao so no arquivo de visibilidade interna.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { ANONYMOUS, asUser, connect, SERVICE_ROLE, withIdentity } from './support/db'
import type { Identity } from './support/db'
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

type Visao = 'tudo' | 'escopo' | 'parcial' | 'nada'

/** As doze tabelas com `client_id`. O escopo se le direto da coluna. */
const TABELAS_TENANT = [
  'client_memberships',
  'projects',
  'onboarding_submissions',
  'strategies',
  'strategy_versions',
  'strategy_approvals',
  'content_items',
  'content_versions',
  'content_comments',
  'content_approvals',
  'activity_log',
  'notifications',
] as const

type TabelaTenant = (typeof TABELAS_TENANT)[number]

const PAPEIS = {
  admin: { id: BOOP_ADMIN, dono: null },
  membroHartmann: { id: MEMBRO_A, dono: HARTMANN },
  membroSemVinculo: { id: MEMBRO_SEM_VINCULO, dono: null },
  clienteHartmann: { id: CLIENTE_A, dono: HARTMANN },
  clienteVelmont: { id: CLIENTE_B, dono: VELMONT },
  desabilitado: { id: CLIENTE_A_DESABILITADO, dono: null },
} as const

type Papel = keyof typeof PAPEIS

/**
 * A matriz. Cada linha e uma tabela; cada coluna, um papel.
 *
 * Vale ler as colunas de baixo para cima uma vez: `desabilitado` e
 * `membroSemVinculo` sao `nada` em toda a tabela, sem excecao. Se qualquer
 * celula dessas duas colunas deixar de ser `nada`, alguma policy passou a
 * conceder por identidade em vez de por vinculo.
 */
const MATRIZ: Record<TabelaTenant, Record<Papel, Visao>> = {
  /* O cliente ve o proprio vinculo, nao a lista de quem atende a conta. */
  client_memberships: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'parcial',
    clienteVelmont: 'parcial',
    desabilitado: 'nada',
  },
  projects: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'escopo',
    clienteVelmont: 'escopo',
    desabilitado: 'nada',
  },
  onboarding_submissions: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'escopo',
    clienteVelmont: 'escopo',
    desabilitado: 'nada',
  },
  strategies: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'escopo',
    clienteVelmont: 'escopo',
    desabilitado: 'nada',
  },
  /* Hartmann tem uma versao aprovada e uma em rascunho: o cliente ve uma. */
  strategy_versions: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'parcial',
    clienteVelmont: 'escopo',
    desabilitado: 'nada',
  },
  strategy_approvals: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'escopo',
    clienteVelmont: 'escopo',
    desabilitado: 'nada',
  },
  /* `idea` e `in_production` sao bastidor: o cliente ve 4 dos 6 da Hartmann. */
  content_items: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'parcial',
    clienteVelmont: 'parcial',
    desabilitado: 'nada',
  },
  /* A versao que nunca saiu para aprovacao nao existe para o cliente. */
  content_versions: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'parcial',
    clienteVelmont: 'escopo',
    desabilitado: 'nada',
  },
  /* O comentario interno da Boop nao aparece para o cliente do mesmo tenant. */
  content_comments: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'parcial',
    clienteVelmont: 'escopo',
    desabilitado: 'nada',
  },
  content_approvals: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'escopo',
    clienteVelmont: 'escopo',
    desabilitado: 'nada',
  },
  /* D-05: o log e interno. O cliente nao ve nem o proprio. */
  activity_log: {
    admin: 'tudo',
    membroHartmann: 'escopo',
    membroSemVinculo: 'nada',
    clienteHartmann: 'nada',
    clienteVelmont: 'nada',
    desabilitado: 'nada',
  },
  /* Operacao da Boop: so `boop_admin`. Nem o membro vinculado ve. */
  notifications: {
    admin: 'tudo',
    membroHartmann: 'nada',
    membroSemVinculo: 'nada',
    clienteHartmann: 'nada',
    clienteVelmont: 'nada',
    desabilitado: 'nada',
  },
}

/** Contagem por tenant sem RLS: o denominador contra o qual tudo e medido. */
const base = new Map<TabelaTenant, { hartmann: number; velmont: number }>()

beforeAll(async () => {
  await withIdentity(db, SERVICE_ROLE, async (tx) => {
    for (const tabela of TABELAS_TENANT) {
      const { rows } = await tx.query<{ h: string; v: string }>(
        `select count(*) filter (where client_id = $1) as h,
                count(*) filter (where client_id = $2) as v
           from public.${tabela}`,
        [HARTMANN, VELMONT],
      )
      base.set(tabela, { hartmann: Number(rows[0]?.h ?? 0), velmont: Number(rows[0]?.v ?? 0) })
    }
  })

  /* Sem isto, `parcial` e `escopo` poderiam passar por vacuidade em tabela
   * vazia — e a suite inteira estaria medindo nada. */
  for (const tabela of TABELAS_TENANT) {
    const b = base.get(tabela)
    expect(b, `${tabela} sem baseline`).toBeDefined()
    expect(
      (b?.hartmann ?? 0) + (b?.velmont ?? 0),
      `${tabela} nao tem linha nenhuma no seed: o caso passaria por vacuidade`,
    ).toBeGreaterThan(0)
  }
})

async function contar(identity: Identity, tabela: TabelaTenant) {
  return withIdentity(db, identity, async (tx) => {
    const { rows } = await tx.query<{ h: string; v: string }>(
      `select count(*) filter (where client_id = $1) as h,
              count(*) filter (where client_id = $2) as v
         from public.${tabela}`,
      [HARTMANN, VELMONT],
    )
    return { hartmann: Number(rows[0]?.h ?? 0), velmont: Number(rows[0]?.v ?? 0) }
  })
}

describe('matriz de isolamento — 12 tabelas x 6 papeis', () => {
  for (const tabela of TABELAS_TENANT) {
    describe(tabela, () => {
      for (const papel of Object.keys(PAPEIS) as Papel[]) {
        const esperado = MATRIZ[tabela][papel]
        const { id, dono } = PAPEIS[papel]

        it(`${papel} → ${esperado}`, async () => {
          const visto = await contar(asUser(id), tabela)
          const b = base.get(tabela)!

          if (esperado === 'nada') {
            expect(visto.hartmann, `${papel} viu linha da Hartmann em ${tabela}`).toBe(0)
            expect(visto.velmont, `${papel} viu linha da Velmont em ${tabela}`).toBe(0)
            return
          }

          if (esperado === 'tudo') {
            expect(visto.hartmann).toBe(b.hartmann)
            expect(visto.velmont).toBe(b.velmont)
            return
          }

          /* Daqui para baixo o papel tem um tenant proprio, e o outro e o que
           * ele nao pode alcancar de jeito nenhum. */
          const proprio = dono === HARTMANN ? 'hartmann' : 'velmont'
          const alheio = dono === HARTMANN ? 'velmont' : 'hartmann'

          expect(
            visto[alheio],
            `${papel} alcancou ${alheio} em ${tabela} — VAZAMENTO ENTRE TENANTS`,
          ).toBe(0)

          if (esperado === 'escopo') {
            expect(visto[proprio], `${papel} nao viu o proprio tenant em ${tabela}`).toBe(
              b[proprio],
            )
          } else {
            expect(
              visto[proprio],
              `${papel} nao viu nada do proprio tenant em ${tabela}`,
            ).toBeGreaterThan(0)
            expect(
              visto[proprio],
              `${papel} viu o tenant inteiro em ${tabela} — a redacao interna sumiu`,
            ).toBeLessThan(b[proprio])
          }
        })
      }
    })
  }
})

describe('tabelas sem client_id — escopo pelo pai', () => {
  async function contarEstagios(identity: Identity) {
    return withIdentity(db, identity, async (tx) => {
      const { rows } = await tx.query<{ h: string; v: string }>(
        `select count(*) filter (where project_id = $1) as h,
                count(*) filter (where project_id = $2) as v
           from public.project_stages`,
        [PROJETO_HARTMANN, PROJETO_VELMONT],
      )
      return { hartmann: Number(rows[0]?.h ?? 0), velmont: Number(rows[0]?.v ?? 0) }
    })
  }

  it('project_stages: cada um ve so a jornada do proprio projeto', async () => {
    const admin = await contarEstagios(asUser(BOOP_ADMIN))
    expect(admin.hartmann).toBeGreaterThan(0)
    expect(admin.velmont).toBeGreaterThan(0)

    const cliente = await contarEstagios(asUser(CLIENTE_A))
    expect(cliente.hartmann).toBe(admin.hartmann)
    expect(cliente.velmont).toBe(0)

    const membro = await contarEstagios(asUser(MEMBRO_A))
    expect(membro.hartmann).toBe(admin.hartmann)
    expect(membro.velmont).toBe(0)

    expect(await contarEstagios(asUser(MEMBRO_SEM_VINCULO))).toEqual({ hartmann: 0, velmont: 0 })
    expect(await contarEstagios(asUser(CLIENTE_A_DESABILITADO))).toEqual({
      hartmann: 0,
      velmont: 0,
    })
  })

  it('onboarding_answers: a resposta segue a submissao, que segue o cliente', async () => {
    const total = async (identity: Identity) =>
      withIdentity(db, identity, async (tx) => {
        const { rows } = await tx.query<{ n: string }>(
          `select count(*) as n
             from public.onboarding_answers a
             join public.onboarding_submissions s on s.id = a.submission_id
            where s.client_id = $1`,
          [VELMONT],
        )
        return Number(rows[0]?.n ?? 0)
      })

    /* O par: quem e da Velmont alcanca; quem nao e, nao alcanca — nem o
     * cliente do outro tenant, nem o membro sem vinculo. */
    expect(await total(asUser(BOOP_ADMIN))).toBeGreaterThan(0)
    expect(await total(asUser(CLIENTE_B))).toBeGreaterThan(0)
    expect(await total(asUser(CLIENTE_A))).toBe(0)
    expect(await total(asUser(MEMBRO_A))).toBe(0)
    expect(await total(asUser(MEMBRO_SEM_VINCULO))).toBe(0)
    expect(await total(asUser(CLIENTE_A_DESABILITADO))).toBe(0)
  })

  it('profiles: o cliente enxerga a si mesmo e a mais ninguem', async () => {
    const visiveis = async (identity: Identity) =>
      withIdentity(db, identity, async (tx) => {
        const { rows } = await tx.query<{ id: string }>('select id from public.profiles')
        return rows.map((r) => r.id)
      })

    /* O cliente nao pode enumerar quem mais existe: nem o outro cliente do
     * mesmo tenant, nem a equipe da Boop, nem quem quer que seja. */
    expect(await visiveis(asUser(CLIENTE_A))).toEqual([CLIENTE_A])
    expect(await visiveis(asUser(CLIENTE_B))).toEqual([CLIENTE_B])

    /* O membro alcanca quem divide cliente com ele — e nunca o cliente do
     * outro tenant. */
    const doMembro = await visiveis(asUser(MEMBRO_A))
    expect(doMembro).toContain(MEMBRO_A)
    expect(doMembro).toContain(CLIENTE_A)
    expect(doMembro).not.toContain(CLIENTE_B)

    /* Sem vinculo nao ha com quem dividir cliente: sobra o proprio perfil. */
    expect(await visiveis(asUser(MEMBRO_SEM_VINCULO))).toEqual([MEMBRO_SEM_VINCULO])

    /*
     * Desabilitado le a PROPRIA linha, e so ela. Isso e proposital, nao uma
     * folga: e o que permite ao `getActor()` responder "acesso revogado" em
     * vez de "sessao invalida" — sem essa leitura, quem foi desligado e quem
     * nunca entrou receberiam a mesma tela.
     *
     * A leitura nao concede nada: `has_client_access` continua false para
     * quem nao esta ativo, e as doze tabelas de tenant ja provaram `nada`
     * para este mesmo usuario na matriz acima.
     */
    expect(await visiveis(asUser(CLIENTE_A_DESABILITADO))).toEqual([CLIENTE_A_DESABILITADO])

    /* Escopo global (D-08): o admin alcanca as sete pessoas do seed. */
    expect((await visiveis(asUser(BOOP_ADMIN))).length).toBe(7)
  })
})

describe('anonimo nao alcanca nada', () => {
  /*
   * Duas fechaduras, e o teste prova a primeira: `anon` nao tem GRANT nenhum
   * em `public`, entao o erro e de privilegio (42501) e nem chega a RLS. Se um
   * dia alguem conceder o GRANT por engano, este teste quebra ANTES de a
   * policy virar a unica defesa.
   */
  for (const tabela of [...TABELAS_TENANT, 'profiles', 'clients', 'project_stages'] as const) {
    it(`${tabela}: permissao negada`, async () =>
      withIdentity(db, ANONYMOUS, async (tx) => {
        const erro = await tx.expectError(`select * from public.${tabela} limit 1`)
        expect(erro.code).toBe('42501')
      }))
  }
})
