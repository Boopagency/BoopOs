import type { OnboardingStatus, QuestionType } from '@/config/enums'
import type { AssertClientFacing } from '@/lib/data/projection'

/**
 * Projeções do onboarding, separadas por AUDIÊNCIA.
 *
 * Mesma convenção das FASES 5 e 6: duas formas com dois nomes, nunca uma com
 * booleano.
 *
 * ## O que o cliente não recebe, e por quê
 *
 * | Coluna         | Por que fica fora da projeção client-facing                |
 * | -------------- | ---------------------------------------------------------- |
 * | `template_id`  | qual formulário ele respondeu é decisão da Boop. Para ele   |
 * |                | existe UM onboarding, não uma instância de um catálogo.     |
 * | `client_id`    | redundante: ele só alcança o próprio tenant, e a tela do    |
 * |                | onboarding não compõe com nada que precise disso.           |
 * | `submitted_by` | uuid de pessoa. A tela diz "recebemos tudo", não quem da    |
 * |                | equipe apertou o botão — e um uuid no payload do RSC é      |
 * |                | identificador vazando sem nenhum uso.                       |
 * | `created_at`   | quando a Boop abriu o registro. `started_at` é o que        |
 * | `updated_at`   | significa alguma coisa para quem responde.                  |
 *
 * Nenhum deles está em `INTERNAL_FIELDS` — não são segredo, são ruído ou
 * vocabulário errado. A proteção é a de sempre e é a primeira: **a coluna não
 * sai do banco**, porque não está na lista do `select`.
 *
 * `AssertClientFacing` continua ao lado de cada projeção client-facing, porque
 * é ele que cobra no dia em que o onboarding ganhar a sua nota interna — e ele
 * vai ganhar: `content_versions.internal_notes` já está na lista, e a mesma
 * convenção cobre o que vier.
 */

/* ═══ Listas de colunas — a PRIMEIRA camada ═════════════════════════════════ */

/** A submissão como o portal a lê. Sem template, sem autoria, sem carimbos. */
export const SUBMISSION_PUBLIC_COLUMNS = 'id, status, started_at, submitted_at'

/**
 * A projeção MÍNIMA: só o ciclo de vida.
 *
 * Existe para o motor de atenção, que roda em toda abertura da Home e precisa
 * responder uma pergunta só — "é a vez do cliente?". Reusar
 * `SUBMISSION_PUBLIC_COLUMNS` funcionaria e traria `id`, `started_at` e
 * `submitted_at` que ninguém lê ali. Projeção client-facing encolhe; não cresce.
 */
export const SUBMISSION_STATE_COLUMNS = 'status'

/** A submissão como o admin a lê: acrescenta autoria e o template respondido. */
export const SUBMISSION_ADMIN_COLUMNS =
  'id, client_id, project_id, template_id, status, started_at, submitted_at, submitted_by, updated_at'

/**
 * O formulário. As mesmas colunas para as duas audiências, e isso é correto:
 * o catálogo NÃO tem campo interno — pergunta, ajuda e alternativas existem
 * para serem lidas por quem responde.
 *
 * O que separa as audiências aqui não é a coluna, é o ALCANCE: `client_user` só
 * chega ao template da própria submissão, e quem garante isso é
 * `app.has_template_access()`, no banco.
 */
export const SECTION_COLUMNS = 'id, key, title, description, position'
export const QUESTION_COLUMNS =
  'id, section_id, key, label, help_text, type, is_required, options, position'

/** A resposta. `id` não interessa a ninguém: a chave real é a pergunta. */
export const ANSWER_COLUMNS = 'question_id, value'

/* ═══ Formas ════════════════════════════════════════════════════════════════ */

/**
 * Uma pergunta renderizável.
 *
 * `type` é o enum inteiro, e não um subconjunto: recortá-lo em TypeScript faria
 * o compilador acreditar que `file` não chega aqui, quando o banco pode
 * devolvê-lo a qualquer momento. Quem decide o que fazer com um tipo ainda não
 * implementado é o renderizador, explicitamente (FASE 12, spec-review I-05).
 */
export interface OnboardingQuestion {
  id: string
  key: string
  label: string
  help: string | null
  type: QuestionType
  required: boolean
  /** `single_select`/`multi_select`. Vazio nos demais tipos. */
  options: string[]
  position: number
}

export type _OnboardingQuestionIsSafe = AssertClientFacing<OnboardingQuestion>

export interface OnboardingSection {
  id: string
  key: string
  title: string
  /** A fala que abre a seção. É o que torna o onboarding conversacional. */
  lead: string | null
  position: number
  questions: OnboardingQuestion[]
}

export type _OnboardingSectionIsSafe = AssertClientFacing<OnboardingSection>

/** `value` é o jsonb do banco: a forma depende do tipo da pergunta. */
export type AnswerValue = string | number | boolean | string[]

export interface OnboardingAnswer {
  questionId: string
  value: AnswerValue
}

/**
 * O onboarding como o portal o vê.
 *
 * `state` é o que a tela decide em cima, e são três situações **diferentes**
 * que não podem virar a mesma:
 *
 *   `unsupported`  este tipo de projeto não tem onboarding na V0. Nunca vai ter
 *                  formulário aqui, e dizer "ainda não abriram" seria mentira.
 *   `not_started`  tem formulário, a Boop ainda não abriu. É espera, não erro.
 *   `draft`        aberto, respondendo.
 *   `submitted`    enviado. Leitura.
 */
export type OnboardingState = 'unsupported' | 'not_started' | 'draft' | 'submitted'

export interface OnboardingSubmissionPublic {
  id: string
  status: OnboardingStatus
  startedOn: string | null
  submittedOn: string | null
}

export type _OnboardingSubmissionPublicIsSafe = AssertClientFacing<OnboardingSubmissionPublic>

/** O que a página do portal recebe. Um objeto, e o `state` manda. */
export interface OnboardingForClient {
  state: OnboardingState
  submission: OnboardingSubmissionPublic | null
  sections: OnboardingSection[]
  answers: OnboardingAnswer[]
}

export type _OnboardingForClientIsSafe = AssertClientFacing<OnboardingForClient>

/* ═══ Boop-side ═════════════════════════════════════════════════════════════ */

export interface OnboardingSubmissionAdmin {
  id: string
  clientId: string
  projectId: string
  templateId: string
  status: OnboardingStatus
  startedOn: string | null
  submittedOn: string | null
  submittedById: string | null
  updatedOn: string
}

/**
 * O que o admin recebe. Acrescenta ao do cliente a autoria e o nome de quem
 * enviou — resolvido em `profiles`, sob RLS, e não montado a partir do uuid.
 */
export interface OnboardingForBoop {
  state: OnboardingState
  submission: OnboardingSubmissionAdmin | null
  submittedByName: string | null
  sections: OnboardingSection[]
  answers: OnboardingAnswer[]
  /** A etapa corrente do projeto: é ela que decide se "Abrir onboarding" pode. */
  currentStageKey: string | null
}
