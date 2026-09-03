/**
 * FASE 6 — as tres fronteiras transacionais, adversarialmente.
 *
 * `create_project_with_journey`, `advance_project_stage` e
 * `set_project_stage_state` sao `security definer`: dentro delas a RLS NAO e
 * aplicada, e toda a autorizacao esta em `if`s no corpo da funcao. Isso muda o
 * que um teste precisa provar.
 *
 * Um `if` que sumisse num refactor nao quebraria nenhum outro teste — nao ha
 * policy no catalogo do Postgres para uma varredura conferir. Entao cada recusa
 * escrita no corpo tem um caso aqui, e o caso falha se a linha sair.
 *
 * E a mesma razao pela qual a FASE 5 escreveu `phase5-people-boundaries`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, switchIdentity, withIdentity, type Tx } from './support/db'
import {
  BOOP_ADMIN,
  CLIENTE_A,
  CLIENTE_B,
  HARTMANN,
  MEMBRO_A,
  MEMBRO_B,
  MEMBRO_SEM_VINCULO,
  VELMONT,
} from './support/fixtures'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db?.end()
})

/** Uma jornada de tres etapas. Curta de proposito: o teste e da mecanica. */
const JORNADA = JSON.stringify([
  { key: 'kickoff', label: 'Início do projeto' },
  { key: 'onboarding', label: 'Onboarding' },
  { key: 'immersion', label: 'Imersão' },
])

async function criarProjeto(tx: Tx, clientId: string, nome = 'Projeto de teste'): Promise<string> {
  const { rows } = await tx.query<{ id: string }>(
    `select public.create_project_with_journey($1, $2, 'social', 'social.v1', $3::jsonb, null) as id`,
    [clientId, nome, JORNADA],
  )
  return rows[0]!.id
}

describe('create_project_with_journey — quem pode criar', () => {
  it('boop_admin cria em QUALQUER cliente, sem precisar de vinculo (D-08)', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      /*
       * O admin nao tem vinculo em `client_memberships` com nenhum dos dois — o
       * seed nao lhe da nenhum. Se este teste passasse a exigir vinculo, D-08
       * teria sido quebrada sem ninguem perceber.
       */
      const { rows } = await tx.query<{ n: string }>(
        `select count(*) as n from public.client_memberships where user_id = $1`,
        [BOOP_ADMIN],
      )
      expect(rows[0]!.n).toBe('0')

      const projetoA = await criarProjeto(tx, HARTMANN)
      const projetoB = await criarProjeto(tx, VELMONT)

      expect(projetoA).toBeTruthy()
      expect(projetoB).toBeTruthy()
      expect(projetoA).not.toBe(projetoB)
    })
  })

  it('boop_member NAO cria — nem no cliente em que TEM vinculo', async () => {
    await withIdentity(db, asUser(MEMBRO_A), async (tx) => {
      const erro = await tx.expectError(
        `select public.create_project_with_journey($1, 'X', 'social', 'social.v1', $2::jsonb, null)`,
        [HARTMANN, JORNADA],
      )
      expect(erro.code).toBe('42501')
      expect(erro.message).toContain('apenas boop_admin')
    })
  })

  it('client_user NAO cria', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const erro = await tx.expectError(
        `select public.create_project_with_journey($1, 'X', 'social', 'social.v1', $2::jsonb, null)`,
        [HARTMANN, JORNADA],
      )
      expect(erro.code).toBe('42501')
    })
  })

  it('anonimo NAO cria', async () => {
    await withIdentity(db, { kind: 'anonymous' }, async (tx) => {
      const erro = await tx.expectError(
        `select public.create_project_with_journey($1, 'X', 'social', 'social.v1', $2::jsonb, null)`,
        [HARTMANN, JORNADA],
      )
      /* Sem grant para `anon`: a recusa vem antes do corpo da funcao. */
      expect(['42501', '42883']).toContain(erro.code)
    })
  })

  it('jornada vazia e recusada — projeto sem etapas nao existe', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const erro = await tx.expectError(
        `select public.create_project_with_journey($1, 'X', 'social', 'social.v1', '[]'::jsonb, null)`,
        [HARTMANN],
      )
      expect(erro.code).toBe('22023')
    })
  })
})

describe('create_project_with_journey — a transacao', () => {
  it('materializa TODAS as etapas, com position contigua desde 1', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)

      const { rows } = await tx.query<{ position: number; stage_key: string; state: string }>(
        `select position, stage_key, state from public.project_stages
          where project_id = $1 order by position`,
        [projeto],
      )

      expect(rows.map((r) => r.position)).toEqual([1, 2, 3])
      expect(rows.map((r) => r.stage_key)).toEqual(['kickoff', 'onboarding', 'immersion'])
    })
  })

  it('a PRIMEIRA etapa nasce current, com started_at, e as demais pending', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)

      const { rows } = await tx.query<{ state: string; iniciou: boolean }>(
        `select state, started_at is not null as iniciou from public.project_stages
          where project_id = $1 order by position`,
        [projeto],
      )

      expect(rows[0]).toEqual({ state: 'current', iniciou: true })
      expect(rows[1]).toEqual({ state: 'pending', iniciou: false })
      expect(rows[2]).toEqual({ state: 'pending', iniciou: false })
    })
  })

  it('o projeto nasce em draft e no ciclo 1', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)

      const { rows } = await tx.query<{ status: string; cycle: number; created_by: string }>(
        `select status, cycle, created_by from public.projects where id = $1`,
        [projeto],
      )

      expect(rows[0]!.status).toBe('draft')
      expect(rows[0]!.cycle).toBe(1)
      /* Autoria vem de auth.uid(), nunca de parametro: nao ha como falsifica-la. */
      expect(rows[0]!.created_by).toBe(BOOP_ADMIN)
    })
  })

  it('ROLLBACK: etapa invalida desfaz o projeto — nunca sobra projeto sem jornada', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const { rows: antes } = await tx.query<{ n: string }>(
        `select count(*) as n from public.projects where client_id = $1`,
        [HARTMANN],
      )

      /*
       * `label` nulo viola o NOT NULL de `project_stages`. A escrita das etapas
       * falha DEPOIS de o projeto ja ter sido inserido — que e exatamente a
       * janela que esta funcao existe para fechar.
       */
      const erro = await tx.expectError(
        `select public.create_project_with_journey($1, 'Meio criado', 'social', 'social.v1',
           '[{"key":"kickoff"},{"key":"onboarding"}]'::jsonb, null)`,
        [HARTMANN],
      )
      expect(erro.code).toBe('23502')

      const { rows: depois } = await tx.query<{ n: string }>(
        `select count(*) as n from public.projects where client_id = $1`,
        [HARTMANN],
      )

      /* A prova: nenhum projeto novo sobreviveu a falha das etapas. */
      expect(depois[0]!.n).toBe(antes[0]!.n)
    })
  })

  it('nao existe projeto com zero etapas em lugar nenhum', async () => {
    await withIdentity(db, { kind: 'service_role' }, async (tx) => {
      const { rows } = await tx.query<{ n: string }>(
        `select count(*) as n from public.projects p
          where not exists (select 1 from public.project_stages s where s.project_id = p.id)`,
      )
      expect(rows[0]!.n).toBe('0')
    })
  })
})

describe('advance_project_stage', () => {
  it('avanca: fecha a corrente com completed_at e abre a proxima', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)

      const { rows: r } = await tx.query<{ out: string }>(
        `select public.advance_project_stage($1) as out`,
        [projeto],
      )
      expect(r[0]!.out).toBe('advanced')

      const { rows } = await tx.query<{ state: string; concluiu: boolean }>(
        `select state, completed_at is not null as concluiu from public.project_stages
          where project_id = $1 order by position`,
        [projeto],
      )

      expect(rows[0]).toEqual({ state: 'done', concluiu: true })
      expect(rows[1]!.state).toBe('current')
      expect(rows[2]!.state).toBe('pending')
    })
  })

  it('a ULTIMA etapa conclui a jornada e nao inventa proxima', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)

      await tx.query(`select public.advance_project_stage($1)`, [projeto])
      await tx.query(`select public.advance_project_stage($1)`, [projeto])
      const { rows: r } = await tx.query<{ out: string }>(
        `select public.advance_project_stage($1) as out`,
        [projeto],
      )
      expect(r[0]!.out).toBe('journey_complete')

      const { rows } = await tx.query<{ state: string }>(
        `select state from public.project_stages where project_id = $1 order by position`,
        [projeto],
      )
      expect(rows.map((x) => x.state)).toEqual(['done', 'done', 'done'])
    })
  })

  it('zero etapa corrente com a jornada terminada e estado LEGITIMO', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)
      for (let i = 0; i < 3; i += 1) {
        await tx.query(`select public.advance_project_stage($1)`, [projeto])
      }

      const { rows } = await tx.query<{ n: string }>(
        `select count(*) as n from public.project_stages
          where project_id = $1 and state = 'current'`,
        [projeto],
      )
      expect(rows[0]!.n).toBe('0')

      /* Avancar de novo nao reabre nada nem levanta erro: e idempotente. */
      const { rows: r } = await tx.query<{ out: string }>(
        `select public.advance_project_stage($1) as out`,
        [projeto],
      )
      expect(r[0]!.out).toBe('journey_complete')
    })
  })

  it('sem corrente e COM pendente: devolve no_current e NAO escolhe etapa', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)

      /* Tira a corrente sem concluir: e o estado inconsistente sob teste. */
      await tx.query(
        `update public.project_stages set state = 'pending'
          where project_id = $1 and state = 'current'`,
        [projeto],
      )

      const { rows: r } = await tx.query<{ out: string }>(
        `select public.advance_project_stage($1) as out`,
        [projeto],
      )
      expect(r[0]!.out).toBe('no_current')

      /* A prova de que nao escolheu: continua sem corrente. */
      const { rows } = await tx.query<{ n: string }>(
        `select count(*) as n from public.project_stages
          where project_id = $1 and state = 'current'`,
        [projeto],
      )
      expect(rows[0]!.n).toBe('0')
    })
  })

  it('NAO toca project.status — jornada e status sao eixos distintos (I-01)', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)
      await tx.query(`update public.projects set status = 'active' where id = $1`, [projeto])

      for (let i = 0; i < 3; i += 1) {
        await tx.query(`select public.advance_project_stage($1)`, [projeto])
      }

      const { rows } = await tx.query<{ status: string }>(
        `select status from public.projects where id = $1`,
        [projeto],
      )
      /* Jornada concluida, projeto continua ativo. Nao ha promocao automatica. */
      expect(rows[0]!.status).toBe('active')
    })
  })

  it('boop_member COM vinculo avanca o projeto do seu cliente', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)

      await switchIdentity(tx, asUser(MEMBRO_A))

      const { rows } = await tx.query<{ out: string }>(
        `select public.advance_project_stage($1) as out`,
        [projeto],
      )
      expect(rows[0]!.out).toBe('advanced')
    })
  })

  it('boop_member SEM vinculo NAO avanca', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)

      await switchIdentity(tx, asUser(MEMBRO_SEM_VINCULO))

      const erro = await tx.expectError(`select public.advance_project_stage($1)`, [projeto])
      expect(erro.code).toBe('42501')
      expect(erro.message).toContain('sem acesso ao projeto')
    })
  })

  it('boop_member do cliente B NAO avanca projeto do cliente A', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)

      /* MEMBRO_B tem vinculo com Velmont, nao com Hartmann. */
      await switchIdentity(tx, asUser(MEMBRO_B))

      const erro = await tx.expectError(`select public.advance_project_stage($1)`, [projeto])
      expect(erro.code).toBe('42501')
    })
  })

  it('client_user NAO avanca a propria jornada', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)

      await switchIdentity(tx, asUser(CLIENTE_A))

      const erro = await tx.expectError(`select public.advance_project_stage($1)`, [projeto])
      expect(erro.code).toBe('42501')
      expect(erro.message).toContain('apenas a Boop')
    })
  })

  it('projeto inexistente: recusa sem revelar que nao existe', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const erro = await tx.expectError(
        `select public.advance_project_stage('99999999-0000-4000-8000-000000000000')`,
      )
      expect(erro.code).toBe('42501')
    })
  })
})

describe('set_project_stage_state', () => {
  async function etapas(tx: Tx, projeto: string) {
    const { rows } = await tx.query<{ id: string; stage_key: string; state: string }>(
      `select id, stage_key, state from public.project_stages
        where project_id = $1 order by position`,
      [projeto],
    )
    return rows
  }

  it('tornar uma etapa current devolve a anterior para pending, na mesma transacao', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)
      const lista = await etapas(tx, projeto)

      await tx.query(`select public.set_project_stage_state($1, $2, 'current')`, [
        projeto,
        lista[2]!.id,
      ])

      const depois = await etapas(tx, projeto)
      expect(depois[0]!.state).toBe('pending')
      expect(depois[2]!.state).toBe('current')

      /* A invariante do indice parcial continua valendo. */
      expect(depois.filter((s) => s.state === 'current')).toHaveLength(1)
    })
  })

  it('a etapa desfeita vira pending, nunca done — nao inventa conclusao', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)
      const lista = await etapas(tx, projeto)

      await tx.query(`select public.set_project_stage_state($1, $2, 'current')`, [
        projeto,
        lista[1]!.id,
      ])

      const { rows } = await tx.query<{ state: string; concluiu: boolean }>(
        `select state, completed_at is not null as concluiu
           from public.project_stages where id = $1`,
        [lista[0]!.id],
      )
      expect(rows[0]).toEqual({ state: 'pending', concluiu: false })
    })
  })

  it('pular uma etapa deixa a jornada sem completed_at nela', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)
      const lista = await etapas(tx, projeto)

      await tx.query(`select public.set_project_stage_state($1, $2, 'skipped')`, [
        projeto,
        lista[1]!.id,
      ])

      const { rows } = await tx.query<{ state: string; concluiu: boolean }>(
        `select state, completed_at is not null as concluiu
           from public.project_stages where id = $1`,
        [lista[1]!.id],
      )
      expect(rows[0]).toEqual({ state: 'skipped', concluiu: false })
    })
  })

  it('marcar done carimba completed_at (o check da tabela exige)', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)
      const lista = await etapas(tx, projeto)

      await tx.query(`select public.set_project_stage_state($1, $2, 'done')`, [
        projeto,
        lista[1]!.id,
      ])

      const { rows } = await tx.query<{ concluiu: boolean }>(
        `select completed_at is not null as concluiu from public.project_stages where id = $1`,
        [lista[1]!.id],
      )
      expect(rows[0]!.concluiu).toBe(true)
    })
  })

  it('etapa de OUTRO projeto e recusada, mesmo com os dois acessiveis', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projetoA = await criarProjeto(tx, HARTMANN, 'A')
      const projetoB = await criarProjeto(tx, VELMONT, 'B')
      const etapasB = await etapas(tx, projetoB)

      const erro = await tx.expectError(
        `select public.set_project_stage_state($1, $2, 'skipped')`,
        [projetoA, etapasB[0]!.id],
      )
      expect(erro.code).toBe('42501')
      expect(erro.message).toContain('nao pertence ao projeto')
    })
  })

  it('client_user NAO corrige a jornada', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)
      const lista = await etapas(tx, projeto)

      await switchIdentity(tx, asUser(CLIENTE_A))

      const erro = await tx.expectError(`select public.set_project_stage_state($1, $2, 'done')`, [
        projeto,
        lista[0]!.id,
      ])
      expect(erro.code).toBe('42501')
    })
  })

  it('estado igual ao atual e no-op declarado', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const projeto = await criarProjeto(tx, HARTMANN)
      const lista = await etapas(tx, projeto)

      const { rows } = await tx.query<{ out: string }>(
        `select public.set_project_stage_state($1, $2, 'current') as out`,
        [projeto, lista[0]!.id],
      )
      expect(rows[0]!.out).toBe('unchanged')
    })
  })
})

describe('list_client_team — a leitura que o portal precisa', () => {
  it('client_user ve os NOMES da Boop, que nao alcanca por consulta direta', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      /* Pela Data API ele nao alcanca o perfil de MEMBRO_A: a policy nega. */
      const { rows: direto } = await tx.query(`select id from public.profiles where id = $1`, [
        MEMBRO_A,
      ])
      expect(direto).toHaveLength(0)

      /* Pela fronteira, ele recebe o nome — e so o nome. */
      const { rows, fields } = await tx.query<{ full_name: string }>(
        `select * from public.list_client_team($1)`,
        [HARTMANN],
      )
      expect(rows.map((r) => r.full_name)).toContain('Ana Prado')
      expect(fields.map((f) => f.name)).toEqual(['full_name'])
    })
  })

  it('NAO inclui client_user: a lista e da equipe da Boop', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query<{ full_name: string }>(
        `select * from public.list_client_team($1)`,
        [HARTMANN],
      )
      expect(rows.map((r) => r.full_name)).not.toContain('Cecilia Hartmann')
    })
  })

  it('NAO inclui boop_admin sem vinculo — acesso nao e alocacao (D-08)', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query<{ full_name: string }>(
        `select * from public.list_client_team($1)`,
        [HARTMANN],
      )
      /* Marina alcanca todos os clientes e nao esta na equipe de nenhum. */
      expect(rows.map((r) => r.full_name)).not.toContain('Marina Duarte')
    })
  })

  it('cliente de OUTRO tenant recebe zero linhas, nao um erro', async () => {
    await withIdentity(db, asUser(CLIENTE_B), async (tx) => {
      const { rows } = await tx.query(`select * from public.list_client_team($1)`, [HARTMANN])
      /* Fail closed e silencioso: nao distingue "sem equipe" de "nao e seu". */
      expect(rows).toHaveLength(0)
    })
  })

  it('anonimo nao executa a funcao', async () => {
    await withIdentity(db, { kind: 'anonymous' }, async (tx) => {
      const erro = await tx.expectError(`select * from public.list_client_team($1)`, [HARTMANN])
      expect(['42501', '42883']).toContain(erro.code)
    })
  })
})
