import 'server-only'

import { cache } from 'react'
import { requireBoop, requireProjectAccess } from '@/lib/auth/authorization'
import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SupabaseServerClient } from '@/lib/supabase/server'
import { requireVisiblePortalProject } from '@/domains/projects/queries'
import {
  ANSWER_COLUMNS,
  QUESTION_COLUMNS,
  SECTION_COLUMNS,
  SUBMISSION_ADMIN_COLUMNS,
  SUBMISSION_PUBLIC_COLUMNS,
  type OnboardingAnswer,
  type OnboardingForBoop,
  type OnboardingForClient,
  type OnboardingSection,
  type OnboardingState,
} from '@/domains/onboarding/types'

/**
 * Leituras do onboarding. Sob RLS, com projeção explícita, guard próprio em
 * cada função.
 *
 * ## As três ausências, e por que são três estados e não um
 *
 * A tela precisa distinguir coisas que um `null` sozinho não distingue:
 *
 *   `unsupported`  o projeto é `website`/`branding`/`automation`/`custom`. Não
 *                  existe formulário para ele na V0, e nunca vai existir sem
 *                  uma decisão de produto. Dizer "ainda não foi aberto" seria
 *                  prometer uma coisa que não vem.
 *   `not_started`  existe formulário, a Boop ainda não abriu. É espera.
 *   `draft`        aberto.
 *
 * O critério de `unsupported` é a JORNADA MATERIALIZADA do projeto: tem etapa
 * `onboarding`? Não é a escolha mais óbvia — o instinto seria perguntar se
 * existe template ativo para o tipo —, e é a única que funciona para as duas
 * audiências: `app.has_template_access()` concede ao `client_user` apenas o
 * template da PRÓPRIA submissão, então um cliente sem submissão não enxerga
 * template nenhum e "não achei template" não distinguiria nada para ele.
 *
 * A etapa, ele enxerga. E ela responde a mesma pergunta pelo lado certo: quem
 * decide que este projeto tem onboarding é a jornada dele.
 */

/* ═══ Peças comuns ══════════════════════════════════════════════════════════ */

/**
 * O que o portal PEDE, que é uma coluna a mais do que ele DEVOLVE.
 *
 * `template_id` entra porque é ele que resolve qual formulário carregar — e
 * para aqui: não está em `OnboardingSubmissionPublic`, então não atravessa a
 * fronteira do RSC. Qual template a Boop escolheu é decisão interna; para quem
 * responde existe um onboarding, não uma instância de catálogo.
 */
const SUBMISSION_PORTAL_QUERY = `${SUBMISSION_PUBLIC_COLUMNS}, template_id`

/** A etapa `onboarding` existe na jornada deste projeto? */
async function hasOnboardingStage(
  supabase: SupabaseServerClient,
  projectId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('project_stages')
    .select('id')
    .eq('project_id', projectId)
    .eq('stage_key', 'onboarding')
    .maybeSingle()

  if (error) {
    logger.error('onboarding.stage_lookup_failed', { code: error.code })
    throw new Error('onboarding.stage_lookup_failed')
  }

  return data !== null
}

/**
 * O formulário inteiro de um template, já agrupado.
 *
 * Duas consultas e um agrupamento em memória, e não um embed do PostgREST: a
 * projeção de cada tabela fica escrita em um lugar só, e o `order` de perguntas
 * dentro de seção não depende de como o PostgREST serializa aninhamento.
 */
async function readForm(
  supabase: SupabaseServerClient,
  templateId: string,
): Promise<OnboardingSection[]> {
  const sections = await supabase
    .from('onboarding_sections')
    .select(SECTION_COLUMNS)
    .eq('template_id', templateId)
    .order('position', { ascending: true })

  if (sections.error) {
    logger.error('onboarding.form_read_failed', { sections: sections.error.code })
    throw new Error('onboarding.form_read_failed')
  }

  const sectionIds = (sections.data ?? []).map((section) => section.id)

  if (sectionIds.length === 0) return []

  /*
   * As perguntas são pedidas PELAS SEÇÕES deste template, e não em bloco.
   * `onboarding_questions` não tem `template_id` para filtrar — a coluna não
   * existe, e criá-la seria a segunda verdade que a migration de integridade
   * deliberadamente recusou. Para a Boop, que lê o catálogo inteiro, pedir sem
   * o `in` traria as perguntas de todo template ativo para montar uma tela que
   * usa as de um só.
   */
  const questions = await supabase
    .from('onboarding_questions')
    .select(QUESTION_COLUMNS)
    .in('section_id', sectionIds)
    .order('position', { ascending: true })

  if (questions.error) {
    logger.error('onboarding.form_read_failed', { questions: questions.error.code })
    throw new Error('onboarding.form_read_failed')
  }

  return (sections.data ?? []).map((section) => ({
    id: section.id,
    key: section.key,
    title: section.title,
    lead: section.description,
    position: section.position,
    questions: (questions.data ?? [])
      .filter((question) => question.section_id === section.id)
      .map((question) => ({
        id: question.id,
        key: question.key,
        label: question.label,
        help: question.help_text,
        type: question.type,
        required: question.is_required,
        options: Array.isArray(question.options) ? (question.options as string[]) : [],
        position: question.position,
      })),
  }))
}

async function readAnswers(
  supabase: SupabaseServerClient,
  submissionId: string,
): Promise<OnboardingAnswer[]> {
  const { data, error } = await supabase
    .from('onboarding_answers')
    .select(ANSWER_COLUMNS)
    .eq('submission_id', submissionId)

  if (error) {
    logger.error('onboarding.answers_read_failed', { code: error.code })
    throw new Error('onboarding.answers_read_failed')
  }

  return (data ?? []).map((row) => ({
    questionId: row.question_id,
    value: row.value as OnboardingAnswer['value'],
  }))
}

function stateFor(hasStage: boolean, status: 'draft' | 'submitted' | null): OnboardingState {
  if (!hasStage) return 'unsupported'
  if (status === null) return 'not_started'
  return status
}

/* ═══ Portal ════════════════════════════════════════════════════════════════ */

/**
 * O onboarding do cliente.
 *
 * O guard é `requireVisiblePortalProject`, o mesmo do layout do grupo — e ele
 * está aqui de novo de propósito: um loader seguro só porque a página que o
 * chama é segura deixa de ser seguro na segunda página (docs/security.md).
 */
export const getOnboardingForClient = cache(
  async (projectId: string): Promise<OnboardingForClient> => {
    await requireVisiblePortalProject(projectId)

    const supabase = await createSupabaseServerClient()

    const [hasStage, submissionResult] = await Promise.all([
      hasOnboardingStage(supabase, projectId),
      supabase
        .from('onboarding_submissions')
        .select(SUBMISSION_PORTAL_QUERY)
        .eq('project_id', projectId)
        .maybeSingle(),
    ])

    if (submissionResult.error) {
      logger.error('onboarding.submission_read_failed', { code: submissionResult.error.code })
      throw new Error('onboarding.submission_read_failed')
    }

    const row = submissionResult.data

    if (!row) {
      return {
        state: stateFor(hasStage, null),
        submission: null,
        sections: [],
        answers: [],
      }
    }

    const [sections, answers] = await Promise.all([
      readForm(supabase, row.template_id),
      readAnswers(supabase, row.id),
    ])

    return {
      state: stateFor(hasStage, row.status),
      submission: {
        id: row.id,
        status: row.status,
        startedOn: row.started_at,
        submittedOn: row.submitted_at,
      },
      sections,
      answers,
    }
  },
)

/* ═══ Boop-side ═════════════════════════════════════════════════════════════ */

/**
 * O onboarding para a tela do projeto no admin.
 *
 * Acrescenta ao do cliente a autoria do envio e a etapa corrente — que é o que
 * decide se "Abrir onboarding" está disponível ou se a resposta é "avance o
 * projeto primeiro".
 *
 * `submittedByName` sai de `profiles`, sob RLS: `app.has_profile_access()`
 * decide, e um `boop_member` que não divida cliente com a pessoa recebe `null`
 * em vez do nome. Falhar em `null` é a resposta certa — a tela mostra a data do
 * envio sem inventar quem enviou.
 */
export const getOnboardingForBoop = cache(async (projectId: string): Promise<OnboardingForBoop> => {
  await requireBoop()
  await requireProjectAccess(projectId)

  const supabase = await createSupabaseServerClient()

  const [hasStage, submissionResult, currentStage] = await Promise.all([
    hasOnboardingStage(supabase, projectId),
    supabase
      .from('onboarding_submissions')
      .select(SUBMISSION_ADMIN_COLUMNS)
      .eq('project_id', projectId)
      .maybeSingle(),
    supabase
      .from('project_stages')
      .select('stage_key')
      .eq('project_id', projectId)
      .eq('state', 'current')
      .maybeSingle(),
  ])

  if (submissionResult.error || currentStage.error) {
    logger.error('onboarding.submission_read_failed', {
      submission: submissionResult.error?.code ?? null,
      stage: currentStage.error?.code ?? null,
    })
    throw new Error('onboarding.submission_read_failed')
  }

  const row = submissionResult.data
  const currentStageKey = currentStage.data?.stage_key ?? null

  if (!row) {
    return {
      state: stateFor(hasStage, null),
      submission: null,
      submittedByName: null,
      sections: [],
      answers: [],
      currentStageKey,
    }
  }

  const [sections, answers, author] = await Promise.all([
    readForm(supabase, row.template_id),
    readAnswers(supabase, row.id),
    row.submitted_by
      ? supabase.from('profiles').select('full_name').eq('id', row.submitted_by).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  return {
    state: stateFor(hasStage, row.status),
    submission: {
      id: row.id,
      clientId: row.client_id,
      projectId: row.project_id,
      templateId: row.template_id,
      status: row.status,
      startedOn: row.started_at,
      submittedOn: row.submitted_at,
      submittedById: row.submitted_by,
      updatedOn: row.updated_at,
    },
    submittedByName: author.data?.full_name ?? null,
    sections,
    answers,
    currentStageKey,
  }
})
