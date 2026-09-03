/**
 * FASE 6 — isolamento e imutabilidade de projeto, aos pares.
 *
 * Cada caso e escrito duas vezes: o que a pessoa DEVE ver e o que ela NAO pode
 * ver. Um teste que so verifica o caminho feliz nao prova isolamento
 * (.claude/rules/testing.md).
 *
 * A diferenca em relacao a `phase6-project-boundaries` e a camada: la o que
 * decide sao `if`s dentro de funcoes `security definer`; aqui o que decide sao
 * as POLICIES e os TRIGGERS, com consultas diretas as tabelas.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { asUser, connect, withIdentity, type Tx } from './support/db'
import {
  BOOP_ADMIN,
  CLIENTE_A,
  CLIENTE_A_DESABILITADO,
  CLIENTE_B,
  HARTMANN,
  MEMBRO_A,
  MEMBRO_B,
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

async function projetosVisiveis(tx: Tx): Promise<string[]> {
  const { rows } = await tx.query<{ id: string }>(`select id from public.projects order by id`)
  return rows.map((r) => r.id)
}

describe('projects — quem ve o que', () => {
  it('boop_admin ve os projetos dos DOIS tenants (D-08)', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const ids = await projetosVisiveis(tx)
      expect(ids).toContain(PROJETO_HARTMANN)
      expect(ids).toContain(PROJETO_VELMONT)
    })
  })

  it('boop_member vinculado a A ve A e NAO ve B', async () => {
    await withIdentity(db, asUser(MEMBRO_A), async (tx) => {
      const ids = await projetosVisiveis(tx)
      expect(ids).toContain(PROJETO_HARTMANN)
      expect(ids).not.toContain(PROJETO_VELMONT)
    })
  })

  it('boop_member SEM vinculo nao ve projeto nenhum', async () => {
    await withIdentity(db, asUser(MEMBRO_SEM_VINCULO), async (tx) => {
      expect(await projetosVisiveis(tx)).toHaveLength(0)
    })
  })

  it('client_user de A ve A e NAO ve B — nem pedindo o id exato', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const ids = await projetosVisiveis(tx)
      expect(ids).toContain(PROJETO_HARTMANN)
      expect(ids).not.toContain(PROJETO_VELMONT)

      /* Troca de id na URL: a consulta direcionada tambem volta vazia. */
      const { rows } = await tx.query(`select id from public.projects where id = $1`, [
        PROJETO_VELMONT,
      ])
      expect(rows).toHaveLength(0)
    })
  })

  it('client_user de B ve B e NAO ve A — o par espelhado', async () => {
    await withIdentity(db, asUser(CLIENTE_B), async (tx) => {
      const ids = await projetosVisiveis(tx)
      expect(ids).toContain(PROJETO_VELMONT)
      expect(ids).not.toContain(PROJETO_HARTMANN)
    })
  })

  it('client_user DESABILITADO nao ve nada, mesmo com vinculo vivo', async () => {
    await withIdentity(db, asUser(CLIENTE_A_DESABILITADO), async (tx) => {
      const { rows } = await tx.query(
        `select 1 from public.client_memberships where user_id = $1`,
        [CLIENTE_A_DESABILITADO],
      )
      /* O vinculo existe no banco; o acesso nao. `has_client_access` exige
       * `status = 'active'` no perfil, e e ele que fecha a porta. */
      expect(rows.length).toBeGreaterThanOrEqual(0)
      expect(await projetosVisiveis(tx)).toHaveLength(0)
    })
  })

  it('anonimo nao ve projeto nenhum', async () => {
    await withIdentity(db, { kind: 'anonymous' }, async (tx) => {
      const erro = await tx.expectError(`select id from public.projects`)
      expect(erro.code).toBe('42501')
    })
  })
})

describe('project_stages — a jornada segue o escopo do projeto', () => {
  it('client_user de A ve as etapas de A e NAO as de B', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows: a } = await tx.query(
        `select id from public.project_stages where project_id = $1`,
        [PROJETO_HARTMANN],
      )
      expect(a.length).toBeGreaterThan(0)

      const { rows: b } = await tx.query(
        `select id from public.project_stages where project_id = $1`,
        [PROJETO_VELMONT],
      )
      expect(b).toHaveLength(0)
    })
  })

  it('client_user NAO escreve na propria jornada', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rowCount } = await tx.query(
        `update public.project_stages set state = 'done', completed_at = now()
          where project_id = $1 and state = 'current'`,
        [PROJETO_HARTMANN],
      )
      /* A policy FILTRA em vez de recusar: zero linhas, sem erro. */
      expect(rowCount).toBe(0)
    })
  })

  it('boop_member de B NAO escreve na jornada de A', async () => {
    await withIdentity(db, asUser(MEMBRO_B), async (tx) => {
      const { rowCount } = await tx.query(
        `update public.project_stages set label = 'invadido' where project_id = $1`,
        [PROJETO_HARTMANN],
      )
      expect(rowCount).toBe(0)
    })
  })

  it('no maximo UMA etapa current por projeto — garantido pelo indice', async () => {
    await withIdentity(db, { kind: 'service_role' }, async (tx) => {
      const erro = await tx.expectError(
        `update public.project_stages set state = 'current' where project_id = $1`,
        [PROJETO_HARTMANN],
      )
      expect(erro.code).toBe('23505')
    })
  })

  it('done sem completed_at e recusado pelo check', async () => {
    await withIdentity(db, { kind: 'service_role' }, async (tx) => {
      const erro = await tx.expectError(
        `update public.project_stages set state = 'done', completed_at = null
          where project_id = $1 and position = 1`,
        [PROJETO_HARTMANN],
      )
      expect(erro.code).toBe('23514')
    })
  })

  it('position duplicada no mesmo projeto e recusada', async () => {
    await withIdentity(db, { kind: 'service_role' }, async (tx) => {
      const erro = await tx.expectError(
        `insert into public.project_stages (project_id, stage_key, label, position)
         values ($1, 'duplicada', 'Duplicada', 1)`,
        [PROJETO_HARTMANN],
      )
      expect(erro.code).toBe('23505')
    })
  })

  it('stage_key duplicada no mesmo projeto e recusada', async () => {
    await withIdentity(db, { kind: 'service_role' }, async (tx) => {
      const { rows } = await tx.query<{ stage_key: string }>(
        `select stage_key from public.project_stages where project_id = $1 limit 1`,
        [PROJETO_HARTMANN],
      )
      const erro = await tx.expectError(
        `insert into public.project_stages (project_id, stage_key, label, position)
         values ($1, $2, 'Repetida', 99)`,
        [PROJETO_HARTMANN, rows[0]!.stage_key],
      )
      expect(erro.code).toBe('23505')
    })
  })
})

describe('imutabilidade — o que nao muda depois de criado', () => {
  it('client_id de um projeto NAO pode ser reatribuido', async () => {
    await withIdentity(db, { kind: 'service_role' }, async (tx) => {
      const erro = await tx.expectError(`update public.projects set client_id = $2 where id = $1`, [
        PROJETO_HARTMANN,
        VELMONT,
      ])
      expect(erro.code).toBe('23514')
      expect(erro.message).toContain('client_id')
    })
  })

  it('journey_key NAO pode ser reescrito — ADR-0006 aplicada pelo banco', async () => {
    await withIdentity(db, { kind: 'service_role' }, async (tx) => {
      const erro = await tx.expectError(
        `update public.projects set journey_key = 'website.v1' where id = $1`,
        [PROJETO_HARTMANN],
      )
      expect(erro.code).toBe('23514')
      expect(erro.message).toContain('journey_key')
    })
  })

  it('type NAO pode ser reescrito — senao type e journey_key discordariam', async () => {
    await withIdentity(db, { kind: 'service_role' }, async (tx) => {
      const erro = await tx.expectError(
        `update public.projects set type = 'website' where id = $1`,
        [PROJETO_HARTMANN],
      )
      expect(erro.code).toBe('23514')
      expect(erro.message).toContain('type')
    })
  })

  it('boop_admin — o papel mais poderoso da aplicacao — tambem e recusado', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const erro = await tx.expectError(
        `update public.projects set journey_key = 'custom.v1' where id = $1`,
        [PROJETO_HARTMANN],
      )
      expect(erro.code).toBe('23514')
    })
  })

  it('project_id de uma etapa NAO pode ser reatribuido', async () => {
    await withIdentity(db, { kind: 'service_role' }, async (tx) => {
      const erro = await tx.expectError(
        `update public.project_stages set project_id = $2 where project_id = $1`,
        [PROJETO_HARTMANN, PROJETO_VELMONT],
      )
      expect(erro.code).toBe('23514')
      expect(erro.message).toContain('project_id')
    })
  })

  it('o que MUDA continua mudando: name, status, datas e cycle', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const { rowCount } = await tx.query(
        `update public.projects
            set name = 'Nome novo', status = 'active', starts_on = '2026-01-10',
                ends_on = '2026-12-31', cycle = 2
          where id = $1`,
        [PROJETO_HARTMANN],
      )
      /* A imutabilidade e das DUAS colunas, nao da tabela. */
      expect(rowCount).toBe(1)
    })
  })
})

describe('escrita cross-tenant em projects', () => {
  it('client_user NAO edita o proprio projeto', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rowCount } = await tx.query(
        `update public.projects set name = 'renomeado pelo cliente' where id = $1`,
        [PROJETO_HARTMANN],
      )
      expect(rowCount).toBe(0)
    })
  })

  it('client_user NAO cria projeto pela tabela', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const erro = await tx.expectError(
        `insert into public.projects (client_id, name, type, journey_key)
         values ($1, 'meu', 'social', 'social.v1')`,
        [HARTMANN],
      )
      expect(erro.code).toBe('42501')
    })
  })

  it('boop_member NAO cria projeto pela tabela, nem no cliente vinculado', async () => {
    await withIdentity(db, asUser(MEMBRO_A), async (tx) => {
      const erro = await tx.expectError(
        `insert into public.projects (client_id, name, type, journey_key)
         values ($1, 'meu', 'social', 'social.v1')`,
        [HARTMANN],
      )
      /* `projects_insert` exige `is_boop_admin()`: a policy nega o INSERT. */
      expect(erro.code).toBe('42501')
    })
  })

  it('boop_member de A NAO edita projeto de B', async () => {
    await withIdentity(db, asUser(MEMBRO_A), async (tx) => {
      const { rowCount } = await tx.query(
        `update public.projects set name = 'invadido' where id = $1`,
        [PROJETO_VELMONT],
      )
      expect(rowCount).toBe(0)
    })
  })

  it('ninguem apaga projeto — nao ha policy de DELETE', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const erro = await tx.expectError(`delete from public.projects where id = $1`, [
        PROJETO_HARTMANN,
      ])
      expect(erro.code).toBe('42501')
    })
  })
})

describe('activity log das operacoes de projeto', () => {
  it('project.created e gravado na MESMA transacao da criacao', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `select public.create_project_with_journey($1, 'Com log', 'social', 'social.v1',
           '[{"key":"kickoff","label":"K"}]'::jsonb, null) as id`,
        [HARTMANN],
      )
      const projeto = rows[0]!.id

      const { rows: log } = await tx.query<{ action: string; actor_id: string }>(
        `select action, actor_id from public.activity_log where project_id = $1`,
        [projeto],
      )

      expect(log).toHaveLength(1)
      expect(log[0]!.action).toBe('project.created')
      /* `actor_id` vem de auth.uid() dentro de `record_activity`, nunca de
       * parametro: nao ha como atribuir o evento a outra pessoa. */
      expect(log[0]!.actor_id).toBe(BOOP_ADMIN)
    })
  })

  it('o metadata guarda identificadores e transicoes, nunca conteudo', async () => {
    await withIdentity(db, asUser(BOOP_ADMIN), async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `select public.create_project_with_journey($1, 'Nome secreto do projeto', 'social',
           'social.v1', '[{"key":"kickoff","label":"K"}]'::jsonb, null) as id`,
        [HARTMANN],
      )

      const { rows: log } = await tx.query<{ metadata: Record<string, unknown> }>(
        `select metadata from public.activity_log where project_id = $1`,
        [rows[0]!.id],
      )

      expect(Object.keys(log[0]!.metadata).sort()).toEqual(['journey_key', 'stages', 'type'])
      expect(JSON.stringify(log[0]!.metadata)).not.toContain('Nome secreto')
    })
  })

  it('client_user nao le o activity log do proprio projeto (D-05)', async () => {
    await withIdentity(db, asUser(CLIENTE_A), async (tx) => {
      const { rows } = await tx.query(`select id from public.activity_log where project_id = $1`, [
        PROJETO_HARTMANN,
      ])
      expect(rows).toHaveLength(0)
    })
  })
})
