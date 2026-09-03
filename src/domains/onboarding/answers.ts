import type { QuestionType } from '@/config/enums'
import type { AnswerValue, OnboardingQuestion } from '@/domains/onboarding/types'

/**
 * A semântica de uma resposta: que FORMA ela tem, e se ela está PREENCHIDA.
 *
 * São duas perguntas diferentes, e confundi-las é o bug clássico deste
 * formulário:
 *
 *   forma       `""` é válido — o cliente apagou o campo, e rascunho aceita
 *               campo vazio. `"Opção Inventada"` num `single_select` não é.
 *   preenchido  `""` não responde nada; `false` e `0` respondem.
 *
 * ## Por que isto existe em TypeScript se já existe em SQL
 *
 * Não existe "de novo": existe em DUAS camadas, de propósito, e cada uma serve
 * a um momento diferente.
 *
 *   `app.answer_value_is_valid` / `app.answer_is_present` (banco) são a
 *   AUTORIDADE. Valem para todo papel, inclusive para um POST direto no
 *   PostgREST que nunca passou por este arquivo.
 *
 *   Estas funções são a UX e a mensagem: elas permitem ao workflow recusar com
 *   um código de domínio em pt-BR em vez de deixar o banco devolver `23514`, e
 *   permitem ao formulário marcar a obrigatória faltante sem uma viagem ao
 *   servidor.
 *
 * As duas implementações são conferidas uma contra a outra em
 * `tests/rls/phase7-answer-integrity.test.ts`, sobre a MESMA tabela de casos
 * (`tests/support/answer-cases.ts`). Divergir passa a ser um teste vermelho, e
 * não uma descoberta em produção.
 *
 * Puro, sem I/O, sem `server-only`: o formulário do portal é Client Component e
 * precisa das duas para dar retorno enquanto a pessoa digita.
 */

/** Tipos que a FASE 7 renderiza. `file` fica fora até a FASE 12 (I-05). */
export const RENDERABLE_QUESTION_TYPES = [
  'short_text',
  'long_text',
  'single_select',
  'multi_select',
  'boolean',
  'number',
  'url',
] as const

export type RenderableQuestionType = (typeof RENDERABLE_QUESTION_TYPES)[number]

/**
 * Este tipo tem campo nesta fase?
 *
 * `file` responde `false`, e a tela mostra a pergunta como indisponível em vez
 * de um input falso — que é a diferença entre adiar um tipo e mentir sobre ele.
 */
export function isRenderableType(type: QuestionType): type is RenderableQuestionType {
  return (RENDERABLE_QUESTION_TYPES as readonly string[]).includes(type)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

/**
 * A forma bate com o tipo, e a escolha existe no template?
 *
 * Espelha `app.answer_value_is_valid`. Tipo desconhecido e `file` caem no
 * `default`: fail closed.
 */
export function isAnswerShapeValid(
  type: QuestionType,
  options: readonly string[],
  value: unknown,
): value is AnswerValue {
  if (value === null || value === undefined) return false

  switch (type) {
    case 'short_text':
    case 'long_text':
    case 'url':
      return typeof value === 'string'
    case 'boolean':
      return typeof value === 'boolean'
    case 'number':
      /* `NaN` e `Infinity` não sobrevivem a `JSON.stringify`: viram `null`. */
      return typeof value === 'number' && Number.isFinite(value)
    case 'single_select':
      return typeof value === 'string' && options.includes(value)
    case 'multi_select':
      return isStringArray(value) && value.every((entry) => options.includes(entry))
    default:
      return false
  }
}

/**
 * Está preenchida?
 *
 * Espelha `app.answer_is_present`. **Não é truthiness**: `false` responde um
 * boolean e `0` responde um number, e os dois são falsy em JavaScript — que é
 * exatamente como uma obrigatória legitimamente respondida seria recusada.
 */
export function isAnswerPresent(type: QuestionType, value: unknown): boolean {
  if (value === null || value === undefined) return false

  switch (type) {
    case 'short_text':
    case 'long_text':
    case 'url':
    case 'single_select':
      return typeof value === 'string' && value.trim() !== ''
    case 'boolean':
      return typeof value === 'boolean'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'multi_select':
      return isStringArray(value) && value.length > 0
    default:
      return false
  }
}

/**
 * As obrigatórias que ainda faltam, na ordem em que aparecem no formulário.
 *
 * A ordem importa: é ela que decide para qual campo o foco vai quando alguém
 * tenta enviar incompleto, e mandar o foco para a última pergunta faltante
 * seria mandar a pessoa para o lugar errado.
 */
export function missingRequired(
  questions: readonly OnboardingQuestion[],
  answers: Readonly<Record<string, unknown>>,
): OnboardingQuestion[] {
  return questions.filter(
    (question) => question.required && !isAnswerPresent(question.type, answers[question.id]),
  )
}
