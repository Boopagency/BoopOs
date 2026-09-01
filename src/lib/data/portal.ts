import { notFound } from 'next/navigation'
import { isClientVisible } from '@/config/enums'
import * as hartmann from '@/mocks/hartmann'
import type {
  AttentionItem,
  ContentItem,
  Delivery,
  Insight,
  JourneyStage,
  Meeting,
  OnboardingSection,
  ProjectFile,
  ProjectSummary,
  ResultsPeriod,
  Strategy,
} from '@/lib/data/types'

/**
 * Camada de acesso a dados do portal.
 *
 * É a única fronteira entre as telas e a origem dos dados. Hoje a origem é
 * `src/mocks/hartmann.ts`; na FASE 5 passa a ser um repository sobre o
 * Supabase e nenhuma tela precisa mudar — o contrato é `./types.ts`.
 *
 * Três decisões que deixam essa troca limpa:
 *
 * 1. Toda função é `async`. Hoje resolve na hora; amanhã faz I/O. Nenhum
 *    componente precisa virar assíncrono depois.
 * 2. Toda função recebe `projectId` e valida. É onde `requireProjectAccess()`
 *    vai entrar na FASE 4 — a autorização já tem lugar reservado.
 * 3. A visibilidade de conteúdo já é filtrada aqui, com a mesma regra que a
 *    RLS vai aplicar no banco (docs/security.md). O protótipo já não mostra
 *    rascunho nem backlog.
 */

/** Único projeto do protótipo. Na FASE 6 vem do banco. */
export const DEMO_PROJECT_ID = hartmann.PROJECT.id

function assertProject(projectId: string): void {
  // FASE 4: aqui entra requireProjectAccess(projectId), que responde 404
  // para recurso inacessível — nunca 403 (docs/security.md).
  if (projectId !== DEMO_PROJECT_ID) notFound()
}

export async function getProject(projectId: string): Promise<ProjectSummary> {
  assertProject(projectId)
  return hartmann.PROJECT
}

export async function getJourney(projectId: string): Promise<JourneyStage[]> {
  assertProject(projectId)
  return hartmann.JOURNEY
}

export async function getCurrentStage(projectId: string): Promise<JourneyStage | undefined> {
  const journey = await getJourney(projectId)
  return journey.find((stage) => stage.state === 'current')
}

/**
 * O que depende do cliente. Bloco vazio desaparece do dashboard — não vira
 * card de "nenhum item" (CLAUDE.md).
 */
export async function getAttention(projectId: string): Promise<AttentionItem[]> {
  assertProject(projectId)
  return hartmann.ATTENTION.filter((item) => item.count > 0)
}

export async function getNextDelivery(projectId: string): Promise<Delivery | null> {
  assertProject(projectId)
  return hartmann.NEXT_DELIVERY
}

export async function getMeetings(projectId: string): Promise<Meeting[]> {
  assertProject(projectId)
  return [...hartmann.MEETINGS].sort((a, b) => a.startAt.localeCompare(b.startAt))
}

export async function getNextMeeting(projectId: string): Promise<Meeting | null> {
  const meetings = await getMeetings(projectId)
  return meetings.find((meeting) => meeting.status === 'scheduled') ?? null
}

export async function getDashboardInsight(projectId: string): Promise<Insight | null> {
  assertProject(projectId)
  return hartmann.DASHBOARD_INSIGHT
}

/**
 * Conteúdo visível ao cliente. O filtro por status espelha a policy de RLS:
 * `idea`, `planned`, `in_production` e `internal_review` nunca chegam aqui.
 */
export async function getContentList(projectId: string): Promise<ContentItem[]> {
  assertProject(projectId)
  return hartmann.CONTENT.filter((item) => isClientVisible(item.status))
}

export async function getContentItem(
  projectId: string,
  contentId: string,
): Promise<ContentItem | null> {
  const list = await getContentList(projectId)
  return list.find((item) => item.id === contentId) ?? null
}

export async function getAwaitingContent(projectId: string): Promise<ContentItem[]> {
  const list = await getContentList(projectId)
  return list.filter((item) => item.status === 'awaiting_client')
}

export async function getStrategy(projectId: string): Promise<Strategy> {
  assertProject(projectId)
  return hartmann.STRATEGY
}

export async function getOnboarding(projectId: string): Promise<OnboardingSection[]> {
  assertProject(projectId)
  return hartmann.ONBOARDING
}

export async function getResults(projectId: string): Promise<ResultsPeriod | null> {
  assertProject(projectId)
  return hartmann.RESULTS
}

export async function getFiles(projectId: string): Promise<ProjectFile[]> {
  assertProject(projectId)
  return hartmann.FILES
}
