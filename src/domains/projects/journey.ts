import type { ProjectStage } from '@/domains/projects/types'

/**
 * Derivação da jornada — funções puras, sem banco e sem Next.
 *
 * A jornada tem UMA fonte da verdade por pergunta, e este arquivo não cria
 * nenhuma nova: ele só lê o que o banco já decidiu.
 *
 * | Pergunta      | Fonte                                          |
 * | ------------- | ---------------------------------------------- |
 * | ordem         | `position` (único por projeto, contíguo desde 1)|
 * | onde estamos  | `state = 'current'` (único, por índice parcial) |
 * | o que acabou  | `state = 'done'` + `completed_at`              |
 * | o que vem     | menor `position` maior que a corrente, `pending`|
 *
 * ## O que NÃO existe aqui, e é decisão
 *
 * **Percentual.** `docs/design-direction.md` é explícito, e o componente da
 * jornada repete: "não existe percentual. '67%' não responde 'em que etapa
 * estamos' — o bloco responde". A jornada É o progresso; um número ao lado
 * dela seria uma segunda representação do mesmo fato, e a pior das duas.
 *
 * **Heurística para "corrente".** Não há fallback do tipo "a primeira não
 * concluída". Se o banco diz que não há etapa corrente, é isso que a aplicação
 * diz — e `journeyState()` distingue os dois motivos possíveis.
 */

/** Ordena por `position`. O banco garante unicidade; a ordem é total. */
export function sortStages(stages: readonly ProjectStage[]): ProjectStage[] {
  return [...stages].sort((a, b) => a.position - b.position)
}

/**
 * A etapa corrente, ou `undefined`.
 *
 * `undefined` não é um erro: pode ser jornada concluída (legítimo) ou estado a
 * corrigir. Quem precisa da diferença chama `journeyState()`.
 */
export function currentStage(stages: readonly ProjectStage[]): ProjectStage | undefined {
  return stages.find((stage) => stage.state === 'current')
}

/**
 * A próxima etapa: menor `position` acima da corrente, ainda `pending`.
 *
 * `skipped` **não** é próxima — foi pulada de propósito, e oferecê-la como
 * "o que vem a seguir" desfaria a decisão de quem a pulou. `done` também não,
 * pelo motivo óbvio.
 *
 * Sem etapa corrente não há "próxima": a pergunta pressupõe um lugar de onde
 * sair, e responder a partir do começo seria inventá-lo.
 */
export function nextStage(stages: readonly ProjectStage[]): ProjectStage | undefined {
  const current = currentStage(stages)
  if (!current) return undefined

  return sortStages(stages).find(
    (stage) => stage.position > current.position && stage.state === 'pending',
  )
}

/**
 * O estado da jornada como um todo. Quatro valores, e cada um é uma tela.
 *
 * - `empty`       o projeto não tem etapas. Não deveria acontecer — a criação
 *                 é transacional (FASE 6) —, e existe porque um estado que "não
 *                 deveria acontecer" e não tem nome vira um `map` sobre lista
 *                 vazia e uma tela em branco sem explicação.
 * - `in_progress` há etapa corrente.
 * - `complete`    não há corrente e não há `pending`: acabou.
 * - `stalled`     não há corrente e ainda há `pending`. É o estado que
 *                 `advanceStage` recusa avançar (`no_current`) e que
 *                 `setStageState` conserta.
 */
export type JourneyState = 'empty' | 'in_progress' | 'complete' | 'stalled'

export function journeyState(stages: readonly ProjectStage[]): JourneyState {
  if (stages.length === 0) return 'empty'
  if (currentStage(stages)) return 'in_progress'

  return stages.some((stage) => stage.state === 'pending') ? 'stalled' : 'complete'
}

/**
 * Quantas etapas foram encerradas e quantas existem.
 *
 * Devolve a CONTAGEM, nunca uma razão nem um percentual — quem chama mostra
 * "3 de 8", que é uma frase, e não "37%", que é um número sem significado.
 *
 * `skipped` conta como encerrada: uma etapa pulada não está pendente, e
 * deixá-la fora do numerador faria a jornada parecer parada quando ela andou.
 */
export function stageTally(stages: readonly ProjectStage[]): { settled: number; total: number } {
  return {
    settled: stages.filter((stage) => stage.state === 'done' || stage.state === 'skipped').length,
    total: stages.length,
  }
}
