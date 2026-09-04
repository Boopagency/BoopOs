import 'server-only'

import { cache } from 'react'
import { requireVisiblePortalProject } from '@/domains/projects/queries'
import { resolveAttention } from './resolve'
import { runSafely } from './safety'
import { ATTENTION_SOURCES } from './sources'
import type { AttentionContext, AttentionResult } from './types'

/**
 * A única porta do motor de atenção.
 *
 * Nenhuma página, componente ou source é chamada de fora daqui — é o que
 * garante que a regra de calma seja aplicada em um lugar só. Quando a FASE 16
 * mandar e-mail e uma IA futura responder "o que eu preciso fazer?", as duas
 * leem esta mesma função: a regra de pendência não é reimplementada por canal,
 * porque a segunda implementação é onde a divergência nasce.
 */
export const getClientAttention = cache(async (projectId: string): Promise<AttentionResult> => {
  /*
   * O guard fica FORA de qualquer captura. `requireVisiblePortalProject()`
   * responde as duas perguntas do portal — a RLS devolve esta linha para este
   * JWT? este status pode aparecer para este papel? — e as três recusas viram
   * o mesmo 404. Nenhuma delas pode ser confundida com falha de leitura.
   */
  const project = await requireVisiblePortalProject(projectId)
  const ctx: AttentionContext = { project }

  /*
   * Só projeto ativo cobra ação de alguém (D-27).
   *
   * A regra mora aqui, e não espalhada pelo `appliesTo` de cada source: uma
   * source nova não deveria precisar lembrar que projeto pausado não pede nada
   * ao cliente. Pausado, concluído e arquivado devolvem zero sources
   * relevantes — que é calma legítima, e não degradação.
   */
  const relevantes =
    project.status === 'active' ? ATTENTION_SOURCES.filter((source) => source.appliesTo(ctx)) : []

  const outcomes = await Promise.all(relevantes.map((source) => runSafely(source, ctx)))

  return resolveAttention(outcomes, relevantes.length)
})
