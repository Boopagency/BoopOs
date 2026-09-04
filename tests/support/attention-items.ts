import type { AttentionItem, AttentionKind } from '@/domains/attention/types'

/**
 * Construtor de item para as duas suítes que precisam de um.
 *
 * Mesma forma de `tests/support/answer-cases.ts`: a tabela mora fora do arquivo
 * de teste para que unit e component afirmem sobre exatamente o mesmo objeto.
 */
export const PROJETO = '30000000-0000-4000-8000-000000000001'

export function item(over: Partial<AttentionItem> = {}): AttentionItem {
  const kind: AttentionKind = over.kind ?? 'onboarding.continue'

  return {
    id: `${kind}:${over.projectId ?? PROJETO}`,
    kind,
    priority: 10,
    count: 1,
    title: 'Seu onboarding está esperando você.',
    description: null,
    cta: { label: 'Continuar', href: `/portal/${PROJETO}/onboarding` },
    projectId: PROJETO,
    entityId: null,
    dueAt: null,
    ...over,
  }
}
