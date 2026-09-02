import type { Capability } from '@/lib/auth/policy'

/**
 * Erro de domínio. Carrega `code`, nunca mensagem pronta.
 *
 * A separação é da regra do frontend: "erro de domínio chega como `code` e é
 * traduzido para pt-BR na UI". O motivo é duplo — a mesma falha aparece em
 * lugares com voz diferente (formulário, lista, confirmação), e uma string
 * montada no servidor vaza vocabulário técnico para a tela.
 *
 * O que NUNCA entra aqui: SQL, nome de tabela, valor de env, stack. O `detail`
 * existe para o log estruturado, não para a resposta (.claude/rules/security.md).
 */
export class WorkflowError extends Error {
  readonly code: string
  readonly detail: Record<string, string | number | boolean | null> | undefined

  constructor(code: string, detail?: Record<string, string | number | boolean | null>) {
    super(code)
    this.name = 'WorkflowError'
    this.code = code
    this.detail = detail
  }
}

/**
 * Recurso que não existe **ou** que este ator não alcança — deliberadamente o
 * mesmo código para os dois.
 *
 * É o 404 da FASE 4 traduzido para um resultado de Server Action: distinguir
 * "não existe" de "existe e não é seu" permite enumerar tenants trocando uuid
 * (docs/security.md).
 */
export const notFound = () => new WorkflowError('resource.not_found')

/** O papel deste ator não permite a capacidade. */
export const denied = (capability: Capability) => new WorkflowError(`${capability}.denied`)

/** Códigos que o `defineWorkflow` produz sozinho, sem o handler pedir. */
export const WORKFLOW_ERROR_CODES = {
  /** Sem sessão, ou perfil não `active`. */
  unauthenticated: 'actor.unauthenticated',
  /** Input reprovado pelo zod. Acompanha `fieldErrors`. */
  invalidInput: 'input.invalid',
  /** Qualquer falha não prevista. A causa vai para o log, nunca para a tela. */
  unexpected: 'workflow.unexpected',
} as const
