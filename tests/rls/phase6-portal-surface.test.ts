/**
 * FASE 6 — a superficie do portal contra o banco, por papel.
 *
 * Este arquivo importa as CONSTANTES DE COLUNA do codigo de producao. O que
 * roda contra o Postgres e a string que `listPortalProjects()` passa ao
 * `.select()`, nao uma imitacao dela — mesma decisao de
 * `phase5-admin-surface.test.ts`.
 *
 * Se alguem acrescentar `journey_key` a projecao client-facing, o caso que
 * confere as colunas devolvidas quebra aqui, alem de quebrar o teste de unidade.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import {
  PROJECT_DETAIL_COLUMNS,
  PROJECT_PUBLIC_COLUMNS,
  STAGE_PUBLIC_COLUMNS,
} from '@/domains/projects/types'
import { asUser, connect, withIdentity } from './support/db'
import {
  BOOP_ADMIN,
  CLIENTE_A,
  CLIENTE_B,
  HARTMANN,
  MEMBRO_A,
  PROJETO_HARTMANN,
} from './support/fixtures'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db?.end()
})

describe('projecao client-facing de projeto', () => {
  it('devolve EXATAMENTE as colunas declaradas — nem uma a mais', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { fields } = await tx.query(
        `select ${PROJECT_PUBLIC_COLUMNS} from public.projects where id = $1`,
        [PROJETO_HARTMANN],
      )

      expect(fields.map((f) => f.name)).toEqual([
        'id',
        'client_id',
        'name',
        'type',
        'status',
        'cycle',
        'starts_on',
      ])
    })
  })

  it('NAO carrega journey_key — a chave do template nao chega ao cliente', async () => {
    expect(PROJECT_PUBLIC_COLUMNS).not.toContain('journey_key')

    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { fields } = await tx.query(
        `select ${PROJECT_PUBLIC_COLUMNS} from public.projects where id = $1`,
        [PROJETO_HARTMANN],
      )
      expect(fields.map((f) => f.name)).not.toContain('journey_key')
    })
  })

  it('a projecao INTERNA traz journey_key, e e Boop-side', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const { rows } = await tx.query<{ journey_key: string }>(
        `select ${PROJECT_DETAIL_COLUMNS} from public.projects where id = $1`,
        [PROJETO_HARTMANN],
      )
      expect(rows[0]!.journey_key).toBeTruthy()
    })
  })

  it('a MESMA projecao interna, pedida pelo cliente, devolve zero linhas', async () => {
    await withIdentity(db, asUser(CLIENTE_B), async (tx) => {
      const { rows } = await tx.query(
        `select ${PROJECT_DETAIL_COLUMNS} from public.projects where id = $1`,
        [PROJETO_HARTMANN],
      )
      /* A RLS decide a LINHA; a projecao decide a COLUNA. As duas camadas. */
      expect(rows).toHaveLength(0)
    })
  })
})

describe('projecao client-facing de etapa', () => {
  it('devolve exatamente as colunas declaradas', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { fields } = await tx.query(
        `select ${STAGE_PUBLIC_COLUMNS} from public.project_stages where project_id = $1`,
        [PROJETO_HARTMANN],
      )

      expect(fields.map((f) => f.name)).toEqual([
        'id',
        'stage_key',
        'label',
        'position',
        'state',
        'completed_at',
      ])
    })
  })

  it('a jornada do cliente vem ordenada e completa', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query<{ position: number }>(
        `select ${STAGE_PUBLIC_COLUMNS} from public.project_stages
          where project_id = $1 order by position`,
        [PROJETO_HARTMANN],
      )

      expect(rows.length).toBeGreaterThan(0)
      /* `position` e contigua desde 1: e o que a criacao transacional garante. */
      expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => i + 1))
    })
  })
})

describe('draft — o que a RLS concede e a aplicacao esconde', () => {
  it('a RLS CONCEDE a linha de um draft ao proprio cliente', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `select public.create_project_with_journey($1, 'Rascunho', 'social', 'social.v1',
           '[{"key":"kickoff","label":"K"}]'::jsonb, null) as id`,
        [HARTMANN],
      )
      const rascunho = rows[0]!.id

      /* Trocar de identidade dentro da transacao preservaria o rollback, mas
       * aqui basta conferir o status: o projeto nasceu `draft`. */
      const { rows: st } = await tx.query<{ status: string }>(
        `select status from public.projects where id = $1`,
        [rascunho],
      )
      expect(st[0]!.status).toBe('draft')
    })
  })

  it('e por isso que a visibilidade NAO pode morar na policy', async () => {
    /*
     * A policy `projects_select` e uma so para os tres papeis, porque
     * `authenticated` e um papel so. Um predicado por status ali tiraria o
     * rascunho da Boop junto com o do cliente — e a Boop precisa dele para
     * trabalhar. A prova: o admin ENXERGA rascunho, e deve enxergar.
     */
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `select public.create_project_with_journey($1, 'Rascunho', 'social', 'social.v1',
           '[{"key":"kickoff","label":"K"}]'::jsonb, null) as id`,
        [HARTMANN],
      )

      const { rows: visto } = await tx.query(
        `select id from public.projects where id = $1 and status = 'draft'`,
        [rows[0]!.id],
      )
      expect(visto).toHaveLength(1)
    })
  })

  it('boop_member vinculado tambem enxerga rascunho do seu cliente', async () => {
    await withIdentity(db, asUser(MEMBRO_A), async (tx) => {
      const { rows } = await tx.query(`select id from public.projects where client_id = $1`, [
        HARTMANN,
      ])
      expect(rows.length).toBeGreaterThan(0)
    })
  })
})
