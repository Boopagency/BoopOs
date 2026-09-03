import 'server-only'

import { notFound } from 'next/navigation'
import { cache } from 'react'
import { stageSummary } from '@/config/journeys'
import { requireActor } from '@/lib/auth/actor'
import { requireBoop, requireClientAccess, requireProjectAccess } from '@/lib/auth/authorization'
import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isPortalVisible } from '@/domains/projects/visibility'
import {
  PROJECT_DETAIL_COLUMNS,
  PROJECT_LIST_COLUMNS,
  PROJECT_PUBLIC_COLUMNS,
  STAGE_ADMIN_COLUMNS,
  STAGE_PUBLIC_COLUMNS,
  type ProjectDetail,
  type ProjectListItem,
  type ProjectPublic,
  type ProjectStage,
  type ProjectStageAdmin,
  type TeamMemberPublic,
} from '@/domains/projects/types'

/**
 * Leituras de `projects` e `project_stages`. Sob RLS, com projeção explícita.
 *
 * Como em `clients/queries.ts`, cada função carrega o próprio guard.
 *
 * ## A distinção que esta fase acrescenta
 *
 * A RLS responde **tenant**: "este ator alcança este projeto?". Ela não
 * responde **visibilidade de produto**: "este projeto deve aparecer para este
 * ator?". As duas não são a mesma pergunta, e a diferença tem nome — `draft`.
 *
 * Um projeto `draft` pertence ao cliente, e `projects_select` concede a linha
 * (`has_client_access`). Está certo: `boop_admin` e `boop_member` precisam ver
 * rascunho para trabalhar nele. O que não pode é o rascunho aparecer para o
 * `client_user` — é o análogo direto de conteúdo em `idea`, que
 * `docs/security.md` proíbe expor.
 *
 * Apertar a policy resolveria pelo lado errado: `authenticated` é um papel só
 * para as três personas, e um predicado por status na policy tiraria o rascunho
 * da Boop junto. Então a regra de produto mora aqui, no servidor, exatamente
 * como a projeção de `clients.notes` mora na lista de colunas — e a RLS
 * continua cuidando do que só ela pode cuidar.
 *
 * As funções que DECIDEM isso — `isPortalVisible`, `isPortalResolvable` e
 * `resolvePortalEntry` — vivem em `./visibility.ts`, e não aqui: são puras, e
 * lógica sem I/O atrás de `server-only` fica cara de testar.
 */

/* ═══ Boop-side ═════════════════════════════════════════════════════════════ */

/** Os projetos de um cliente, para o admin. Inclui `draft`. */
export const listProjectsForClientForBoop = cache(
  async (clientId: string): Promise<ProjectListItem[]> => {
    await requireBoop()
    await requireClientAccess(clientId)

    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_LIST_COLUMNS)
      .eq('client_id', clientId)
      /* Ordem total e determinística: sem desempate por `id` duas linhas
       * empatadas podem trocar de lugar entre requests. */
      .order('starts_on', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })

    if (error) {
      logger.error('projects.list_failed', { code: error.code })
      throw new Error('projects.list_failed')
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      type: row.type,
      status: row.status,
      cycle: row.cycle,
      startedOn: row.starts_on,
      updatedAt: row.updated_at,
    }))
  },
)

/** O projeto inteiro, para a tela interna. A única projeção com `journeyKey`. */
export const getProjectDetailForBoop = cache(async (projectId: string): Promise<ProjectDetail> => {
  await requireBoop()
  await requireProjectAccess(projectId)

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_DETAIL_COLUMNS)
    .eq('id', projectId)
    .maybeSingle()

  /* Inexistente e inalcançável dão a MESMA resposta (docs/security.md). */
  if (error || !data) notFound()

  return {
    id: data.id,
    clientId: data.client_id,
    name: data.name,
    type: data.type,
    status: data.status,
    cycle: data.cycle,
    journeyKey: data.journey_key,
    startedOn: data.starts_on,
    endsOn: data.ends_on,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
})

/** A jornada para o admin: acrescenta quando cada etapa começou. */
export const getProjectStagesForBoop = cache(
  async (projectId: string): Promise<ProjectStageAdmin[]> => {
    const project = await getProjectDetailForBoop(projectId)
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase
      .from('project_stages')
      .select(STAGE_ADMIN_COLUMNS)
      .eq('project_id', projectId)
      .order('position', { ascending: true })

    if (error) {
      logger.error('project_stages.list_failed', { code: error.code })
      throw new Error('project_stages.list_failed')
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      key: row.stage_key,
      label: row.label,
      position: row.position,
      state: row.state,
      summary: stageSummary(project.journeyKey, row.stage_key),
      startedOn: row.started_at,
      completedOn: row.completed_at,
    }))
  },
)

/* ═══ Portal ════════════════════════════════════════════════════════════════ */

/**
 * O guard do portal — acesso **e** visibilidade, numa pergunta só.
 *
 * `requireProjectAccess()` sozinho não basta aqui, e é a correção mais
 * importante desta fase: ele responde tenant, e responderia "sim" para um
 * `draft` do próprio cliente. Esta função faz as duas perguntas e devolve a
 * MESMA resposta para as três recusas possíveis — não existe, não é seu, não
 * está visível para você. Quem troca uuid na URL não distingue nenhuma delas.
 *
 * É ela que o layout de `/portal/[projectId]` chama, e por isso vale para todas
 * as páginas filhas de uma vez.
 */
export const requireVisiblePortalProject = cache(
  async (projectId: string): Promise<ProjectPublic> => {
    const actor = await requireActor()
    /* Tenant primeiro: 404 antes de qualquer leitura de domínio. */
    await requireProjectAccess(projectId)

    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase
      .from('projects')
      .select(PROJECT_PUBLIC_COLUMNS)
      .eq('id', projectId)
      .maybeSingle()

    if (error || !data) notFound()
    if (!isPortalVisible(data.status, actor)) notFound()

    return {
      id: data.id,
      clientId: data.client_id,
      name: data.name,
      type: data.type,
      status: data.status,
      cycle: data.cycle,
      startedOn: data.starts_on,
    }
  },
)

/**
 * Todos os projetos que este ator pode abrir no portal, já ordenados.
 *
 * É a base do resolvedor de `/portal`. Não filtra por vínculo em TypeScript:
 * `projects_select` já faz isso via `has_client_access`, e repetir criaria uma
 * segunda verdade sobre escopo (ADR-0022). O que ele filtra é VISIBILIDADE, que
 * a RLS não decide.
 */
export const listPortalProjects = cache(async (): Promise<ProjectPublic[]> => {
  const actor = await requireActor()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_PUBLIC_COLUMNS)
    /*
     * A ordem é declarada por inteiro, e não parcialmente: sem desempate total
     * o Postgres pode devolver duas linhas empatadas em ordem diferente entre
     * dois requests, e "o primeiro projeto" mudaria sozinho entre um F5 e
     * outro. `id` fecha a ordem porque é único.
     *
     * `created_at` ordena sem ser projetado — o PostgREST aceita ordenar por
     * coluna que não está no `select`, e o carimbo não vai para o payload.
     */
    .order('starts_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })

  if (error) {
    logger.error('portal.projects_failed', { code: error.code })
    throw new Error('portal.projects_failed')
  }

  return (data ?? [])
    .filter((row) => isPortalVisible(row.status, actor))
    .map((row) => ({
      id: row.id,
      clientId: row.client_id,
      name: row.name,
      type: row.type,
      status: row.status,
      cycle: row.cycle,
      startedOn: row.starts_on,
    }))
})

/** A jornada como o cliente a vê, com o texto do template já resolvido. */
export const getPortalJourney = cache(async (projectId: string): Promise<ProjectStage[]> => {
  await requireVisiblePortalProject(projectId)

  const supabase = await createSupabaseServerClient()

  /*
   * `journey_key` é buscado à parte, e não junto da projeção pública: ele
   * precisa existir no SERVIDOR para resolver os `summary`, e não pode viajar
   * para o cliente. Duas leituras pequenas, e a chave técnica não atravessa a
   * fronteira do RSC.
   */
  const [project, stages] = await Promise.all([
    supabase.from('projects').select('journey_key').eq('id', projectId).maybeSingle(),
    supabase
      .from('project_stages')
      .select(STAGE_PUBLIC_COLUMNS)
      .eq('project_id', projectId)
      .order('position', { ascending: true }),
  ])

  if (stages.error) {
    logger.error('portal.journey_failed', { code: stages.error.code })
    throw new Error('portal.journey_failed')
  }

  const journeyKey = project.data?.journey_key ?? ''

  return (stages.data ?? []).map((row) => ({
    id: row.id,
    key: row.stage_key,
    label: row.label,
    position: row.position,
    state: row.state,
    summary: stageSummary(journeyKey, row.stage_key),
    completedOn: row.completed_at,
  }))
})

/**
 * Quem cuida desta conta pela Boop — só os nomes.
 *
 * Sai por `public.list_client_team()`, e não por um `select` daqui, porque um
 * `client_user` não alcança `client_memberships` de terceiros nem `profiles` de
 * outra pessoa — as duas policies negam, corretamente. A função é a fronteira
 * mínima que devolve o que o produto pede (nomes) sem conceder o que ele não
 * pede (a lista de vínculos, os perfis, os e-mails). Ver a migration.
 *
 * Lista vazia é resultado normal, não erro: conta sem pessoa da Boop vinculada
 * simplesmente não mostra o bloco (D-16).
 */
export const listClientTeam = cache(async (clientId: string): Promise<TeamMemberPublic[]> => {
  await requireClientAccess(clientId)

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.rpc('list_client_team', { p_client_id: clientId })

  if (error) {
    logger.error('portal.team_failed', { code: error.code })
    /*
     * A equipe é decoração informativa, não o conteúdo da página. Derrubar a
     * tela do projeto porque a lista de nomes falhou seria trocar uma perda
     * pequena por uma grande — o bloco some, como sumiria se estivesse vazio.
     */
    return []
  }

  return (data ?? []).flatMap((row) => (row.full_name ? [{ name: row.full_name }] : []))
})
