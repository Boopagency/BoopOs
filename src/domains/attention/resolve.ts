import type { AttentionItem, AttentionResult, AttentionState, SourceOutcome } from './types'

/**
 * A decisão da atenção, pura e sem servidor.
 *
 * Mora fora de `queries.ts` de propósito: a regra que separa calma de degradação
 * é a regra mais importante da fase, e ela precisa ser testável sem banco, sem
 * Next e sem mock de infraestrutura.
 */

/**
 * Ordem determinística. Os dois últimos critérios existem só para o desempate
 * ser total: um teste que dependa da ordem de resolução do `Promise.all` falha
 * de forma intermitente, e teste intermitente é pior que teste ausente.
 *
 * `dueAt` nulo vai por último — item sem prazo não disputa com item com prazo.
 */
export function byPriority(a: AttentionItem, b: AttentionItem): number {
  if (a.priority !== b.priority) return a.priority - b.priority

  if (a.dueAt !== b.dueAt) {
    if (a.dueAt === null) return 1
    if (b.dueAt === null) return -1
    return a.dueAt < b.dueAt ? -1 : 1
  }

  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * As três respostas, decididas em UM lugar.
 *
 * ## A ordem do ternário é a fase inteira
 *
 * A simplificação natural — `items.length === 0 ? 'calm' : 'attention'` — é uma
 * linha mais curta e é uma mentira: uma source que FALHOU também produz zero
 * itens, e o cliente leria "tudo certo por aqui" com uma pendência aberta que
 * ninguém conseguiu ler.
 *
 * Por isso a falha é testada ANTES da calma. `tests/unit/attention-degraded`
 * quebra se alguém inverter.
 *
 * ## Zero sources avaliadas é calma, não degradação
 *
 * Projeto pausado, concluído ou sem source aplicável não tem o que verificar.
 * Não há pergunta em aberto, então não há incerteza a comunicar.
 */
export function resolveAttention(
  outcomes: readonly SourceOutcome[],
  evaluated: number,
): AttentionResult {
  const failed = outcomes.filter((outcome) => !outcome.ok).length
  const items = outcomes.flatMap((outcome) => (outcome.ok ? outcome.items : [])).sort(byPriority)

  const state: AttentionState = items.length > 0 ? 'attention' : failed > 0 ? 'degraded' : 'calm'

  return { state, items, complete: failed === 0, evaluated, failed }
}
