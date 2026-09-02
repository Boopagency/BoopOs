import 'server-only'

import { cache } from 'react'
import { requireBoop, requireClientAccess } from '@/lib/auth/authorization'
import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { AssignablePerson, ClientMember, PersonListItem } from '@/domains/people/types'

/**
 * Leituras de `profiles` e `client_memberships`. Sob RLS, com projeção explícita.
 *
 * Como em `clients/queries.ts`, cada função carrega o próprio guard: um loader
 * seguro só porque a página que o chama é segura deixa de ser seguro na
 * segunda página.
 *
 * ## O que a RLS já faz por estas consultas
 *
 * `profiles_select` usa `app.has_profile_access(id)`: a própria linha sempre,
 * todas para `boop_admin`, e para `boop_member` só quem divide um cliente.
 * `client_memberships_select` usa `has_client_access(client_id)` e, para
 * `client_user`, restringe ao próprio vínculo.
 *
 * Nenhuma das funções abaixo repete esses filtros em TypeScript. Repetir
 * criaria uma segunda verdade sobre escopo — e a errada seria a de cá, porque
 * a RLS é a que o banco obedece (ADR-0022).
 */

const PROFILE_COLUMNS = 'id, full_name, email, role, status'
const MEMBERSHIP_COLUMNS = 'id, client_id, user_id, created_at'

/**
 * Quantas pessoas alcançam cada cliente.
 *
 * Uma consulta para a lista inteira, e não uma por cliente: a página de
 * clientes faz duas consultas no total, independentemente de quantas linhas
 * mostrar. Com a V0 na casa das dezenas de clientes, contar em memória é mais
 * simples e mais previsível do que um agregado embutido do PostgREST — e a
 * hora de trocar é quando a lista crescer, não antes (§38 do briefing).
 */
export const countMembersByClientForBoop = cache(async (): Promise<Map<string, number>> => {
  await requireBoop()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.from('client_memberships').select('client_id')

  if (error) {
    logger.error('memberships.count_failed', { code: error.code })
    throw new Error('memberships.count_failed')
  }

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    counts.set(row.client_id, (counts.get(row.client_id) ?? 0) + 1)
  }

  return counts
})

/** Todas as pessoas que este ator enxerga, para `/admin/usuarios`. */
export const listPeopleForBoop = cache(async (): Promise<PersonListItem[]> => {
  await requireBoop()
  const supabase = await createSupabaseServerClient()

  const [people, memberships] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLUMNS).order('full_name', { ascending: true }),
    supabase.from('client_memberships').select('user_id'),
  ])

  if (people.error) {
    logger.error('people.list_failed', { code: people.error.code })
    throw new Error('people.list_failed')
  }

  if (memberships.error) {
    logger.error('people.membership_count_failed', { code: memberships.error.code })
    throw new Error('people.list_failed')
  }

  const counts = new Map<string, number>()
  for (const row of memberships.data ?? []) {
    counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1)
  }

  return (people.data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    clientCount: counts.get(row.id) ?? 0,
  }))
})

/**
 * Quem alcança este cliente.
 *
 * O embed traz `profiles` pela FK `user_id` — nomeada por extenso porque
 * `client_memberships` aponta para `profiles` duas vezes (`user_id` e
 * `created_by`), e sem o nome da constraint o PostgREST não sabe qual seguir.
 */
export const listClientMembersForBoop = cache(async (clientId: string): Promise<ClientMember[]> => {
  await requireBoop()
  await requireClientAccess(clientId)

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('client_memberships')
    .select(
      `${MEMBERSHIP_COLUMNS}, profile:profiles!client_memberships_user_id_fkey(${PROFILE_COLUMNS})`,
    )
    .eq('client_id', clientId)
    .order('created_at', { ascending: true })

  if (error) {
    logger.error('memberships.list_failed', { code: error.code })
    throw new Error('memberships.list_failed')
  }

  return (data ?? []).flatMap((row) => {
    /*
     * O perfil pode voltar nulo quando a RLS concede o vínculo e nega a
     * pessoa. Não acontece hoje — quem enxerga o vínculo divide o cliente,
     * e `has_profile_access` concede por isso mesmo —, e a linha é
     * descartada em vez de virar "pessoa sem nome": um vínculo que não sabe
     * dizer de quem é não ajuda ninguém na tela.
     */
    if (!row.profile) return []

    return [
      {
        membershipId: row.id,
        userId: row.user_id,
        fullName: row.profile.full_name,
        email: row.profile.email,
        role: row.profile.role,
        status: row.profile.status,
        grantedAt: row.created_at,
      },
    ]
  })
})

/**
 * Quem ainda NÃO alcança este cliente — as opções do seletor de vínculo.
 *
 * `boop_admin` fica de fora da lista de propósito: ele já alcança todos os
 * clientes por papel global (D-08), e um vínculo para ele seria uma linha que
 * não concede nada e sugere, na tela, que concede.
 */
export const listAssignablePeopleForBoop = cache(
  async (clientId: string): Promise<AssignablePerson[]> => {
    await requireBoop()
    await requireClientAccess(clientId)

    const supabase = await createSupabaseServerClient()

    const [people, members] = await Promise.all([
      supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .neq('role', 'boop_admin')
        .neq('status', 'disabled')
        .order('full_name', { ascending: true }),
      supabase.from('client_memberships').select('user_id').eq('client_id', clientId),
    ])

    if (people.error || members.error) {
      logger.error('people.assignable_failed', {
        code: people.error?.code ?? members.error?.code ?? 'unknown',
      })
      throw new Error('people.assignable_failed')
    }

    const linked = new Set((members.data ?? []).map((row) => row.user_id))

    return (people.data ?? [])
      .filter((row) => !linked.has(row.id))
      .map((row) => ({
        id: row.id,
        fullName: row.full_name,
        email: row.email,
        role: row.role,
      }))
  },
)
