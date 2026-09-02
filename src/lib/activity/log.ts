import 'server-only'

import type { ActivityAction, ActivityEntityType } from '@/config/activity'
import type { ActivityVisibility } from '@/config/enums'
import { logger } from '@/lib/logging/logger'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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
 * Escreve pela service role porque a RLS esta ligada e sem politicas ate a
 * FASE 4, e `authenticated` nao tem privilegio em `public` (ADR-0021). A linha
 * carrega `actor_id`, entao a autoria continua registrada mesmo com a escrita
 * saindo em nome do sistema.
 */
export type ActivityEntry = {
  action: ActivityAction
  entityType: ActivityEntityType
  entityId?: string | null
  actorId?: string | null
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
    const admin = createSupabaseAdminClient()

    const { error } = await admin.from('activity_log').insert({
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      actor_id: entry.actorId ?? null,
      client_id: entry.clientId ?? null,
      project_id: entry.projectId ?? null,
      metadata: entry.metadata ?? {},
      visibility: entry.visibility ?? 'internal',
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
