import { unstable_rethrow } from 'next/navigation'
import { logger } from '@/lib/logging/logger'
import type { AttentionContext, AttentionSource, SourceOutcome } from './types'

/**
 * Isolamento de erro por source — e a armadilha que ele existe para evitar.
 *
 * ## `notFound()` e `redirect()` são exceções
 *
 * Toda a cadeia de autorização do portal sinaliza por `throw`:
 * `requireProjectAccess()` chama `notFound()`, `requireActor()` chama
 * `redirect()`. Um `try/catch` ingênuo em volta de uma source **engoliria um
 * 404 e o transformaria em estado degradado** — o cliente veria "não
 * conseguimos verificar suas pendências" no lugar de um 404, e a página
 * continuaria montando por cima de uma recusa de acesso.
 *
 * Isso não é resiliência: é falha de segurança com aparência de resiliência.
 *
 * `unstable_rethrow` é a API do próprio Next para isso, e existe e é função no
 * Next 16.3.4 (conferido, não presumido). Ela é a PRIMEIRA linha do `catch`:
 * devolve ao Next o que é do Next — 404, redirect e o sinal de saída do RSC —
 * e só o que sobra é falha de leitura de verdade.
 *
 * O guard principal, de qualquer forma, roda FORA daqui: `getClientAttention()`
 * chama `requireVisiblePortalProject()` antes de qualquer source existir. Este
 * relançamento é a segunda barreira, para o dia em que uma source nova chamar
 * um loader que guarda de novo.
 */
export async function runSafely(
  source: AttentionSource,
  ctx: AttentionContext,
): Promise<SourceOutcome> {
  try {
    return { ok: true, items: await source.run(ctx) }
  } catch (error) {
    unstable_rethrow(error)

    /*
     * Só a chave da source vai para o log. Nunca o payload, nunca o id do
     * cliente, nunca a mensagem do Postgres — a regra de log do repositório
     * vale aqui como em qualquer outro lugar.
     */
    logger.error('attention.source_failed', { source: source.key })

    return { ok: false }
  }
}
