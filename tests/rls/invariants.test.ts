/**
 * Invariantes do banco — as regras que valem mesmo quando a aplicação erra.
 *
 * Tudo aqui roda como `service_role`, DE PROPÓSITO. É o papel que ignora RLS,
 * o mais poderoso que o sistema usa. Se a regra segura nele, segura em
 * qualquer um. É também o oposto do erro que o §37 do enunciado adverte: não
 * estamos provando isolamento com service_role — isolamento é RLS, é a FASE 4.
 * Estamos provando que trigger e constraint não têm exceção.
 *
 * Cada caso vive em uma transação que termina em rollback, então a ordem de
 * execução não importa (.claude/rules/testing.md).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { SERVICE_ROLE, connect, withIdentity, withRollback, type Tx } from './support/db'
import {
  CLIENTE_A,
  HARTMANN,
  MEMBRO_A,
  MEMBRO_SEM_VINCULO,
  PROJETO_HARTMANN,
  PROJETO_VELMONT,
  VELMONT,
  VERSAO_A_AGUARDANDO,
  VERSAO_ESTRATEGIA_A_APROVADA,
} from './support/fixtures'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db?.end()
})

const comBanco = (nome: string, corpo: (tx: Tx) => Promise<void>) =>
  it(nome, () => withIdentity(db, SERVICE_ROLE, corpo))

/**
 * Para o que e mecanica do Postgres e nao caminho da aplicacao. `auth.users`
 * entra aqui: nem `service_role` escreve nela — no Supabase hospedado quem
 * escreve e o GoTrue, com papel proprio.
 */
const comoDono = (nome: string, corpo: (tx: Tx) => Promise<void>) =>
  it(nome, () => withRollback(db, corpo))

describe('derivação de tenant', () => {
  comBanco('o client_id do input é descartado, não validado', async (tx) => {
    // O ataque clássico: peça da Hartmann carimbada como Velmont. O trigger
    // nem olha para o valor enviado — sobrescreve com o do pai.
    const { rows } = await tx.query<{ client_id: string }>(
      `insert into public.content_items (project_id, client_id, title, channel, format)
       values ($1, $2, 'Tentativa de carimbar outro tenant', 'instagram', 'reel')
       returning client_id`,
      [PROJETO_HARTMANN, VELMONT],
    )

    expect(rows[0]?.client_id).toBe(HARTMANN)
  })

  comBanco('a versão herda o tenant do item, não do payload', async (tx) => {
    const { rows } = await tx.query<{ client_id: string }>(
      `insert into public.content_versions (content_item_id, client_id, version, status)
       select id, $1, 99, 'draft' from public.content_items where project_id = $2 limit 1
       returning client_id`,
      [VELMONT, PROJETO_HARTMANN],
    )

    expect(rows[0]?.client_id).toBe(HARTMANN)
  })

  comBanco('pai inexistente aborta o insert', async (tx) => {
    const erro = await tx.expectError(
      `insert into public.content_items (project_id, title, channel, format)
       values ('30000000-0000-4000-8000-0000000000ff', 'Órfã', 'instagram', 'reel')`,
    )

    // 23503 = foreign_key_violation. Quem chega primeiro é a FK do Postgres.
    expect(erro.code).toBe('23503')
  })
})

describe('imutabilidade de tenant', () => {
  comBanco('uma peça nunca muda de cliente', async (tx) => {
    const erro = await tx.expectError(
      `update public.content_items set client_id = $1 where project_id = $2`,
      [VELMONT, PROJETO_HARTMANN],
    )

    expect(erro.code).toBe('23514')
    expect(erro.message).toContain('imutavel')
  })

  comBanco('uma peça nunca muda de projeto', async (tx) => {
    const erro = await tx.expectError(
      `update public.content_items set project_id = $1 where project_id = $2`,
      [PROJETO_VELMONT, PROJETO_HARTMANN],
    )

    expect(erro.code).toBe('23514')
  })

  comBanco('um projeto nunca muda de cliente', async (tx) => {
    const erro = await tx.expectError(`update public.projects set client_id = $1 where id = $2`, [
      VELMONT,
      PROJETO_HARTMANN,
    ])

    expect(erro.code).toBe('23514')
  })

  comBanco('um vínculo nunca troca de lado', async (tx) => {
    const erro = await tx.expectError(
      `update public.client_memberships set client_id = $1 where user_id = $2 and client_id = $3`,
      [VELMONT, MEMBRO_A, HARTMANN],
    )

    expect(erro.code).toBe('23514')
  })
})

describe('activity_log é append-only', () => {
  comBanco('nem service_role edita uma linha do log', async (tx) => {
    const erro = await tx.expectError(
      `update public.activity_log set action = 'content.forjado' where client_id = $1`,
      [HARTMANN],
    )

    // 42501 = insufficient_privilege. RLS não bastaria: service_role a ignora.
    expect(erro.code).toBe('42501')
    expect(erro.message).toContain('append-only')
  })

  comBanco('nem service_role apaga uma linha do log', async (tx) => {
    const erro = await tx.expectError(`delete from public.activity_log where client_id = $1`, [
      HARTMANN,
    ])

    expect(erro.code).toBe('42501')
  })

  comBanco('metadata só aceita objeto', async (tx) => {
    const erro = await tx.expectError(
      `insert into public.activity_log (client_id, entity_type, action, metadata)
       values ($1, 'content_item', 'content.created', '"texto solto"'::jsonb)`,
      [HARTMANN],
    )

    expect(erro.code).toBe('23514')
  })

  comBanco('action fora do formato dominio.verbo é rejeitada', async (tx) => {
    const erro = await tx.expectError(
      `insert into public.activity_log (client_id, entity_type, action)
       values ($1, 'content_item', 'CoisaQualquer')`,
      [HARTMANN],
    )

    expect(erro.code).toBe('23514')
  })
})

describe('updated_at', () => {
  comBanco('é carimbado a cada update, sem a aplicação lembrar', async (tx) => {
    await tx.query(
      `update public.clients set updated_at = timestamptz '2020-01-01' where id = $1`,
      [HARTMANN],
    )

    const { rows } = await tx.query<{ mudou: boolean }>(
      `update public.clients set name = 'Hartmann (editada)' where id = $1
       returning updated_at > timestamptz '2020-01-02' as mudou`,
      [HARTMANN],
    )

    expect(rows[0]?.mudou).toBe(true)
  })
})

describe('idempotência', () => {
  comBanco('convidar a mesma pessoa duas vezes não duplica o vínculo', async (tx) => {
    const erro = await tx.expectError(
      `insert into public.client_memberships (client_id, user_id) values ($1, $2)`,
      [HARTMANN, MEMBRO_A],
    )

    // 23505 = unique_violation. É o que transforma o clique duplo em no-op.
    expect(erro.code).toBe('23505')
  })

  comBanco('uma versão tem no máximo uma aprovação válida', async (tx) => {
    await tx.query(
      `insert into public.content_approvals (content_version_id, decided_by, decision)
       values ($1, $2, 'approved')`,
      [VERSAO_A_AGUARDANDO, CLIENTE_A],
    )

    const erro = await tx.expectError(
      `insert into public.content_approvals (content_version_id, decided_by, decision)
       values ($1, $2, 'approved')`,
      [VERSAO_A_AGUARDANDO, CLIENTE_A],
    )

    expect(erro.code).toBe('23505')
  })

  comBanco('mas pedir ajuste duas vezes é legítimo e não é bloqueado', async (tx) => {
    // O índice é parcial (`where decision = 'approved'`) justamente para isso:
    // o cliente pode voltar e pedir outro ajuste.
    const { rowCount } = await tx.query(
      `insert into public.content_approvals (content_version_id, decided_by, decision, note)
       values ($1, $2, 'changes_requested', 'mais uma vez'),
              ($1, $2, 'changes_requested', 'e outra')`,
      [VERSAO_A_AGUARDANDO, CLIENTE_A],
    )

    expect(rowCount).toBe(2)
  })

  comBanco('a estratégia também aceita uma aprovação só', async (tx) => {
    const erro = await tx.expectError(
      `insert into public.strategy_approvals (strategy_version_id, decided_by, decision)
       values ($1, $2, 'approved')`,
      [VERSAO_ESTRATEGIA_A_APROVADA, CLIENTE_A],
    )

    expect(erro.code).toBe('23505')
  })

  comBanco('o autosave do onboarding faz upsert, não acumula respostas', async (tx) => {
    const alvo = await tx.query<{ submission_id: string; question_id: string }>(
      `select submission_id, question_id from public.onboarding_answers limit 1`,
    )
    const { submission_id, question_id } = alvo.rows[0]!

    for (const valor of ['"primeira"', '"segunda"', '"terceira"']) {
      await tx.query(
        `insert into public.onboarding_answers (submission_id, question_id, value)
         values ($1, $2, $3::jsonb)
         on conflict (submission_id, question_id) do update set value = excluded.value`,
        [submission_id, question_id, valor],
      )
    }

    const { rows } = await tx.query<{ total: string; value: string }>(
      `select count(*) over ()::text as total, value::text as value
         from public.onboarding_answers where submission_id = $1 and question_id = $2`,
      [submission_id, question_id],
    )

    expect(rows[0]?.total).toBe('1')
    expect(rows[0]?.value).toBe('"terceira"')
  })

  comBanco('o mesmo e-mail não é disparado duas vezes', async (tx) => {
    const erro = await tx.expectError(
      `insert into public.notifications (recipient_email, template, dedupe_key)
       values ('alguem@example.com', 'content.awaiting_client', $1)`,
      ['content.awaiting_client:61000000-0000-4000-8000-000000000004'],
    )

    expect(erro.code).toBe('23505')
  })
})

describe('integridade de domínio', () => {
  comBanco('um projeto tem no máximo uma etapa corrente', async (tx) => {
    const erro = await tx.expectError(
      `update public.project_stages set state = 'current'
        where project_id = $1 and stage_key = 'publishing'`,
      [PROJETO_HARTMANN],
    )

    expect(erro.code).toBe('23505')
  })

  comBanco('status fora do enum não entra', async (tx) => {
    const erro = await tx.expectError(
      `update public.content_items set status = 'quase_pronto' where project_id = $1`,
      [PROJETO_HARTMANN],
    )

    // 22P02 = invalid_text_representation.
    expect(erro.code).toBe('22P02')
  })

  comBanco('slug fora do formato não entra', async (tx) => {
    const erro = await tx.expectError(
      `insert into public.clients (name, slug) values ('Teste', 'Slug Com Espaço')`,
    )

    expect(erro.code).toBe('23514')
  })

  comBanco('versão não-rascunho exige registro de quando saiu', async (tx) => {
    const erro = await tx.expectError(
      `insert into public.content_versions (content_item_id, version, status)
       select id, 98, 'awaiting_client' from public.content_items where project_id = $1 limit 1`,
      [PROJETO_HARTMANN],
    )

    expect(erro.code).toBe('23514')
  })

  comBanco('apagar cliente com projeto é recusado — arquivar é a operação certa', async (tx) => {
    const erro = await tx.expectError(`delete from public.clients where id = $1`, [HARTMANN])

    expect(erro.code).toBe('23503')
  })

  comoDono('o perfil morre junto com o usuário de auth', async (tx) => {
    // Pessoa sem rastro no log: o cascade funciona ponta a ponta.
    await tx.query(`delete from auth.users where id = $1`, [MEMBRO_SEM_VINCULO])

    const { rows } = await tx.query<{ total: string }>(
      `select count(*)::text as total from public.profiles where id = $1`,
      [MEMBRO_SEM_VINCULO],
    )

    expect(rows[0]?.total).toBe('0')
  })

  comoDono('quem deixou rastro no log não pode ser apagado', async (tx) => {
    // O par do caso acima, e a razão de `activity_log.actor_id` ser RESTRICT:
    // apagar a pessoa exigiria UPDATE numa tabela append-only. A operação certa
    // é desabilitar (`status = 'disabled'`), não apagar.
    const erro = await tx.expectError(`delete from auth.users where id = $1`, [CLIENTE_A])

    expect(erro.code).toBe('23503')
  })

  comoDono('criar usuário de auth cria o perfil espelho', async (tx) => {
    const id = '10000000-0000-4000-8000-0000000000ee'
    await tx.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, 'novo@example.com', '{"full_name":"Pessoa Nova"}'::jsonb)`,
      [id],
    )

    const { rows } = await tx.query<{ email: string; full_name: string; role: string }>(
      `select email::text, full_name, role::text from public.profiles where id = $1`,
      [id],
    )

    expect(rows[0]).toEqual({
      email: 'novo@example.com',
      full_name: 'Pessoa Nova',
      // Nasce com o papel menos privilegiado. Promover é ato explícito.
      role: 'client_user',
    })
  })
})
