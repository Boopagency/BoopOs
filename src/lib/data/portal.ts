import { isClientVisible } from '@/config/enums'
import { getClientPublic } from '@/domains/clients/queries'
import { getPortalJourney, requireVisiblePortalProject } from '@/domains/projects/queries'
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
 * É a única fronteira entre as telas e a origem dos dados. **A partir da FASE 6
 * ela tem duas origens**, e a divisão é exata:
 *
 *   projeto e jornada  →  Supabase, sob RLS, por `domains/projects/queries`
 *   todo o resto       →  `src/mocks/hartmann.ts`, até a fase de cada domínio
 *
 * Nenhuma tela mudou por causa disso, que era o contrato prometido na FASE 1:
 * `MOCK → DATA LAYER → SUPABASE`, com `./types.ts` no meio.
 *
 * ## O que mudou de verdade, e é o ponto da fase
 *
 * `assertProject()` comparava uma string com `DEMO_PROJECT_ID` e chamava
 * `notFound()`. Era a única barreira do portal — e não era barreira nenhuma:
 * não consultava o banco, não sabia quem estava pedindo, e teria devolvido o
 * projeto do mock para qualquer pessoa autenticada.
 *
 * No lugar dela entrou `requireVisiblePortalProject()`, que faz DUAS perguntas
 * ao banco: o vínculo (RLS, via `has_project_access`) e a visibilidade de
 * produto (um `draft` não existe para o `client_user`). As três recusas
 * possíveis — não existe, não é seu, não está visível — produzem exatamente a
 * mesma resposta.
 *
 * ## Por que as funções mockadas continuam recebendo `projectId`
 *
 * Elas passaram a receber um uuid REAL, conferido pelo mesmo guard das outras.
 * Nenhuma delas usa `DEMO_PROJECT_ID` como atalho: o id é validado primeiro, e
 * só então o mock responde. Assim, quando a FASE 7 trocar `getOnboarding()` por
 * uma consulta de verdade, a autorização já está no lugar certo — e o que
 * mudou foi só de onde vieram as linhas.
 */

/**
 * O guard de todas as funções deste arquivo.
 *
 * Cada uma o chama, inclusive as que ainda respondem com mock. Um loader seguro
 * só porque a página que o chama é segura deixa de ser seguro na segunda
 * página (docs/security.md).
 */
async function assertProject(projectId: string): Promise<void> {
  await requireVisiblePortalProject(projectId)
}

/**
 * O projeto, do banco.
 *
 * Duas leituras, e não um embed: o nome do cliente sai de `getClientPublic()`,
 * que carrega o próprio guard e a própria projeção — a que NÃO tem `notes`.
 * Pedir `clients(name)` embutido aqui funcionaria e deixaria a decisão sobre
 * quais colunas de `clients` atravessam a fronteira em dois lugares.
 */
export async function getProject(projectId: string): Promise<ProjectSummary> {
  const project = await requireVisiblePortalProject(projectId)
  const client = await getClientPublic(project.clientId)

  return {
    id: project.id,
    clientName: client.name,
    name: project.name,
    type: project.type,
    cycle: project.cycle,
    startedOn: project.startedOn,
  }
}

/**
 * A jornada, do banco — ordem, rótulo e estado — com o `summary` resolvido do
 * template em código (ADR-0006).
 */
export async function getJourney(projectId: string): Promise<JourneyStage[]> {
  const stages = await getPortalJourney(projectId)

  return stages.map((stage) => ({
    key: stage.key,
    label: stage.label,
    state: stage.state,
    summary: stage.summary,
    completedOn: stage.completedOn,
  }))
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
  await assertProject(projectId)
  return hartmann.ATTENTION.filter((item) => item.count > 0)
}

export async function getNextDelivery(projectId: string): Promise<Delivery | null> {
  await assertProject(projectId)
  return hartmann.NEXT_DELIVERY
}

export async function getMeetings(projectId: string): Promise<Meeting[]> {
  await assertProject(projectId)
  return [...hartmann.MEETINGS].sort((a, b) => a.startAt.localeCompare(b.startAt))
}

export async function getNextMeeting(projectId: string): Promise<Meeting | null> {
  const meetings = await getMeetings(projectId)
  return meetings.find((meeting) => meeting.status === 'scheduled') ?? null
}

export async function getDashboardInsight(projectId: string): Promise<Insight | null> {
  await assertProject(projectId)
  return hartmann.DASHBOARD_INSIGHT
}

/**
 * Conteúdo visível ao cliente. O filtro por status espelha a policy de RLS:
 * `idea`, `planned`, `in_production` e `internal_review` nunca chegam aqui.
 */
export async function getContentList(projectId: string): Promise<ContentItem[]> {
  await assertProject(projectId)
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
  await assertProject(projectId)
  return hartmann.STRATEGY
}

export async function getOnboarding(projectId: string): Promise<OnboardingSection[]> {
  await assertProject(projectId)
  return hartmann.ONBOARDING
}

export async function getResults(projectId: string): Promise<ResultsPeriod | null> {
  await assertProject(projectId)
  return hartmann.RESULTS
}

export async function getFiles(projectId: string): Promise<ProjectFile[]> {
  await assertProject(projectId)
  return hartmann.FILES
}
