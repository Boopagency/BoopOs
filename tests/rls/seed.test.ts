/**
 * O seed é pré-condição da suíte de isolamento, não decoração.
 *
 * Sem dois tenants simétricos e pessoas de cada lado, "o Cliente A não vê o
 * Cliente B" é uma frase que não dá para testar. Este arquivo garante que o
 * elenco existe antes que a FASE 4 dependa dele — e falha primeiro, apontando
 * o `supabase/seed.sql`, em vez de deixar vinte testes falharem sem explicar
 * por quê.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { connect } from './support/db'
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

describe('elenco do seed', () => {
  it('existem exatamente dois tenants', async () => {
    const { rows } = await db.query<{ id: string; name: string }>(
      `select id, name from public.clients order by name`,
    )

    expect(rows).toEqual([
      { id: HARTMANN, name: 'Hartmann' },
      { id: VELMONT, name: 'Velmont' },
    ])
  })

  it('cada tenant tem o seu projeto', async () => {
    const { rows } = await db.query<{ id: string; client_id: string }>(
      `select id, client_id from public.projects order by starts_on`,
    )

    expect(rows).toEqual([
      { id: PROJETO_HARTMANN, client_id: HARTMANN },
      { id: PROJETO_VELMONT, client_id: VELMONT },
    ])
  })

  it('os papéis são os que a matriz de permissões precisa', async () => {
    const { rows } = await db.query<{ id: string; role: string; status: string }>(
      `select id, role::text, status::text from public.profiles order by id`,
    )
    const porId = new Map(rows.map((r) => [r.id, r]))

    expect(porId.get(BOOP_ADMIN)).toMatchObject({ role: 'boop_admin', status: 'active' })
    expect(porId.get(MEMBRO_A)).toMatchObject({ role: 'boop_member', status: 'active' })
    expect(porId.get(MEMBRO_B)).toMatchObject({ role: 'boop_member', status: 'active' })
    expect(porId.get(MEMBRO_SEM_VINCULO)).toMatchObject({ role: 'boop_member', status: 'active' })
    expect(porId.get(CLIENTE_A)).toMatchObject({ role: 'client_user', status: 'active' })
    expect(porId.get(CLIENTE_B)).toMatchObject({ role: 'client_user', status: 'active' })
    // Vínculo sem acesso: prova que status derruba independentemente do papel.
    expect(porId.get(CLIENTE_A_DESABILITADO)).toMatchObject({
      role: 'client_user',
      status: 'disabled',
    })
  })

  it('cada membro está vinculado a um lado só, e um a nenhum', async () => {
    const { rows } = await db.query<{ user_id: string; clientes: string[] }>(
      `select user_id, array_agg(client_id::text order by client_id) as clientes
         from public.client_memberships group by user_id`,
    )
    const porUsuario = new Map(rows.map((r) => [r.user_id, r.clientes]))

    expect(porUsuario.get(MEMBRO_A)).toEqual([HARTMANN])
    expect(porUsuario.get(MEMBRO_B)).toEqual([VELMONT])
    expect(porUsuario.get(CLIENTE_A)).toEqual([HARTMANN])
    expect(porUsuario.get(CLIENTE_B)).toEqual([VELMONT])
    // O caso negativo puro. Se este vínculo aparecer, a matriz perde uma célula.
    expect(porUsuario.has(MEMBRO_SEM_VINCULO)).toBe(false)
    // boop_admin não precisa de vínculo: o alcance dele é global (D-08).
    expect(porUsuario.has(BOOP_ADMIN)).toBe(false)
  })

  it('os dois tenants têm conteúdo em status que o cliente NÃO pode ver', async () => {
    // Sem isto no banco, o teste de "o portal esconde o que é interno" não teria
    // o que esconder e passaria por vacuidade.
    const { rows } = await db.query<{ client_id: string; total: string }>(
      `select client_id, count(*)::text as total
         from public.content_items
        where status in ('idea', 'planned', 'in_production', 'internal_review')
        group by client_id`,
    )

    expect(rows.map((r) => r.client_id).sort()).toEqual([HARTMANN, VELMONT].sort())
  })

  it('há comentário interno e comentário público na mesma peça', async () => {
    const { rows } = await db.query<{ internos: string; publicos: string }>(
      `select count(*) filter (where is_internal)::text as internos,
              count(*) filter (where not is_internal)::text as publicos
         from public.content_comments
        where content_item_id = '60000000-0000-4000-8000-000000000003'`,
    )

    expect(rows[0]).toEqual({ internos: '1', publicos: '2' })
  })

  it('há versão de estratégia em rascunho, que o cliente nunca viu', async () => {
    const { rows } = await db.query<{ total: string }>(
      `select count(*)::text as total from public.strategy_versions
        where status = 'draft' and sent_at is null`,
    )

    expect(Number(rows[0]?.total)).toBeGreaterThan(0)
  })

  it('nenhuma linha do seed aponta para o tenant errado', async () => {
    const { rows } = await db.query<{ vazamentos: string }>(`
      select count(*)::text as vazamentos from (
        select 1 from public.content_items i join public.projects p on p.id = i.project_id
         where i.client_id <> p.client_id
        union all
        select 1 from public.content_versions v join public.content_items i on i.id = v.content_item_id
         where v.client_id <> i.client_id
        union all
        select 1 from public.content_comments c join public.content_items i on i.id = c.content_item_id
         where c.client_id <> i.client_id
        union all
        select 1 from public.content_approvals a join public.content_versions v on v.id = a.content_version_id
         where a.client_id <> v.client_id
        union all
        select 1 from public.strategy_versions sv join public.strategies s on s.id = sv.strategy_id
         where sv.client_id <> s.client_id
        union all
        select 1 from public.strategy_approvals sa join public.strategy_versions sv on sv.id = sa.strategy_version_id
         where sa.client_id <> sv.client_id
        union all
        select 1 from public.onboarding_submissions o join public.projects p on p.id = o.project_id
         where o.client_id <> p.client_id
      ) t
    `)

    expect(rows[0]?.vazamentos).toBe('0')
  })

  it('nenhum e-mail do seed sai de example.com', async () => {
    // Domínio reservado pela IANA: não resolve, não recebe, não alcança
    // ninguém. Um e-mail real aqui viraria e-mail de teste para um cliente real.
    const { rows } = await db.query<{ email: string }>(
      `select email::text from public.profiles where email not like '%@%.example.com'
       union all
       select recipient_email::text from public.notifications where recipient_email not like '%@%.example.com'`,
    )

    expect(rows.map((r) => r.email)).toEqual([])
  })
})
