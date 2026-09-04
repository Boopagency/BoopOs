import { AttentionBlock } from '@/components/patterns/attention-block'
import { CalmState } from '@/components/patterns/calm-state'
import { DegradedState } from '@/components/patterns/degraded-state'
import type { ProjectStatus } from '@/config/enums'
import type { AttentionResult } from '@/domains/attention/types'

/**
 * A resposta à primeira pergunta do cliente, nas três formas que ela tem.
 *
 * Este componente NÃO decide nada: ele despacha. A regra que separa calma de
 * degradação é de produto e mora no domínio (`resolveAttention`), porque ela
 * vai ser lida também pelo e-mail da FASE 16 e, mais tarde, por uma IA — e a
 * segunda implementação de uma regra é onde a divergência nasce.
 *
 * As três formas são conteúdos diferentes, não variações de estilo:
 *
 *   attention  há algo esperando você        laje navy, numeral, CTA
 *   calm       nada esperando, e é verdade   fundo claro, sem CTA
 *   degraded   não deu para verificar        neutro, sem alarme
 *
 * O bloco nunca fica ausente. A pergunta "preciso fazer alguma coisa?" sempre
 * tem resposta na tela — é a razão de o cliente ter aberto o portal.
 */
export function AttentionState({
  result,
  status,
  stageSummary,
}: {
  result: AttentionResult
  status: ProjectStatus
  stageSummary: string | null
}) {
  if (result.state === 'attention') {
    return <AttentionBlock items={result.items} complete={result.complete} />
  }

  if (result.state === 'degraded') return <DegradedState />

  return <CalmState status={status} stageSummary={stageSummary} />
}
