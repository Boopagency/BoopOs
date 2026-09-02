import 'server-only'

import type { ActivityAction, ActivityEntityType } from '@/config/activity'
import type { ActivityVisibility } from '@/config/enums'
import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Unico caminho da aplicacao para escrever em `activity_log`
 * (.claude/rules/database.md). As cinco operacoes atomicas da V0 escrevem o
 * log dentro da propria funcao SQL; todo o resto passa por aqui.
 *
 * `metadata` aceita apenas primitivos por assinatura, e isso e a regra virando
 * tipo: o log guarda **identificadores e transicoes**, nunca conteudo, PII ou
 * segredo. Um objeto aninhado aqui seria o comeco de "vamos so guardar a
 * resposta do onboarding para depurar".
 *
 * ## Por que RPC, e nao um insert daqui
 *
 * A FASE 3 escrevia com service role porque `authenticated` nao tinha
 * privilegio em `public` (ADR-0021). A FASE 4 nao trocou isso por um GRANT de
 * INSERT: conceder escrita direta em `activity_log` permitiria gravar linha
 * com `actor_id` de outra pessoa, ou um evento que nunca aconteceu — e um log
 * de auditoria que aceita ser forjado e pior do que nao ter log.
 *
 * `public.record_activity()` e `security definer` e resolve `actor_id` a
 * partir de `auth.uid()`, sempre. Por isso `actorId` NAO existe mais nesta
 * assinatura: nao ha o que passar, nem o que errar. Ela tambem confere
 * `clientId` e `projectId` contra o vinculo de quem chama, entao ninguem
 * atribui evento a um tenant que nao alcanca.
 */
export type ActivityEntry = {
  action: ActivityAction
  entityType: ActivityEntityType
  entityId?: string | null
  clientId?: string | null
  projectId?: string | null
  metadata?: Record<string, string | number | boolean | null>
  visibility?: ActivityVisibility
}

/**
 * Nunca lanca. Perder uma linha de auditoria e ruim; derrubar a operacao que
 * ja aconteceu e pior, e a inconsistencia fica registrada no log estruturado
 * (docs/workflows.md).
 */
export async function logActivity(entry: ActivityEntry): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient()

    /*
     * A chave OMITIDA, e nao a chave com `undefined`.
     *
     * Os tres parametros opcionais tem DEFAULT no banco, e o PostgREST so
     * aplica o default quando a chave nao vem no corpo. O `exactOptional
     * PropertyTypes` do TypeScript diz a mesma coisa por outro caminho: uma
     * propriedade opcional ausente nao e a mesma coisa que presente e
     * indefinida. Os dois concordam, e o spread condicional atende os dois.
     */
    const { error } = await supabase.rpc('record_activity', {
      p_action: entry.action,
      p_entity_type: entry.entityType,
      ...(entry.entityId ? { p_entity_id: entry.entityId } : {}),
      ...(entry.clientId ? { p_client_id: entry.clientId } : {}),
      ...(entry.projectId ? { p_project_id: entry.projectId } : {}),
      p_metadata: entry.metadata ?? {},
      p_visibility: entry.visibility ?? 'internal',
    })

    if (error) {
      logger.error('activity_log.insert_failed', { action: entry.action, code: error.code })
    }
  } catch (cause) {
    logger.error('activity_log.unavailable', {
      action: entry.action,
      reason: cause instanceof Error ? cause.name : 'unknown',
    })
  }
}
