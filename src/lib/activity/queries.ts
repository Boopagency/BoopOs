import 'server-only'

import { cache } from 'react'
import { ACTIVITY_ACTION_LABEL, type ActivityAction, ACTIVITY_ACTIONS } from '@/config/activity'
import { requireBoop } from '@/lib/auth/authorization'
import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Leitura do activity log — a auditoria visível para a Boop.
 *
 * `activity_log_select` já responde por escopo: `boop_admin` vê tudo,
 * `boop_member` vê o que pertence a um cliente que ele alcança, e
 * `client_user` não vê nada (D-05, a matriz não lhe dá `activity.read`).
 * Nenhum filtro por papel aqui — a RLS é quem decide, e repetir a regra criaria
 * a chance de as duas discordarem.
 *
 * ## O que NÃO se lê daqui
 *
 * `metadata` guarda identificadores e transições, nunca conteúdo — é regra da
 * tabela, garantida na escrita (`logActivity` aceita só primitivos). A leitura
 * confia nisso e mesmo assim projeta campo a campo na tela, em vez de despejar
 * o JSON: um `metadata` que um dia carregue algo indevido não vira texto na
 * página por acidente.
 */

/** Quantos eventos a tela mostra. Sem paginação — ver o comentário abaixo. */
export const ACTIVITY_PAGE_SIZE = 100

export interface ActivityEntryView {
  id: number
  action: ActivityAction | null
  actionLabel: string
  actorName: string | null
  clientId: string | null
  clientName: string | null
  entityType: string
  createdAt: string
  /** Só o que é seguro exibir: papel e status. Nunca e-mail, nunca texto. */
  detail: string | null
}

const KNOWN_ACTIONS = new Set<string>(ACTIVITY_ACTIONS)

function isKnownAction(action: string): action is ActivityAction {
  return KNOWN_ACTIONS.has(action)
}

/**
 * Os eventos mais recentes que este ator enxerga.
 *
 * Sem paginação, e isso é decisão: `activity_log` cresce, mas a tela responde
 * "o que aconteceu por aqui ultimamente" — não é um arquivo histórico
 * navegável, e nada no roadmap do M1 pede um. Um cursor agora seria motor de
 * paginação para uma tela que ninguém pediu para paginar (CLAUDE.md §4). A
 * hora de construí-lo é quando alguém precisar do evento de três meses atrás.
 */
export const listRecentActivityForBoop = cache(async (): Promise<ActivityEntryView[]> => {
  await requireBoop()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('activity_log')
    /*
     * Uma string literal, e nao concatenacao: o supabase-js infere o tipo do
     * retorno a partir do TEXTO do select, e `'a' + 'b'` chega ao tipo como
     * `string` — o resultado inteiro vira erro generico. Foi um typecheck
     * quebrado ate esta linha virar literal.
     */
    .select(
      'id, action, entity_type, client_id, metadata, created_at, actor:profiles(full_name, email), client:clients(name)',
    )
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_PAGE_SIZE)

  if (error) {
    logger.error('activity.list_failed', { code: error.code })
    throw new Error('activity.list_failed')
  }

  return (data ?? []).map((row) => {
    const action = isKnownAction(row.action) ? row.action : null
    const metadata = (row.metadata ?? {}) as Record<string, unknown>

    /*
     * Dois campos, escolhidos a dedo. `role` e `status` descrevem a transição
     * e não identificam ninguém; `user_id` e `email_sent` ficam de fora da
     * tela porque um é ruído e o outro só interessa ao log estruturado.
     */
    const role = typeof metadata.role === 'string' ? metadata.role : null
    const status = typeof metadata.status === 'string' ? metadata.status : null

    return {
      id: row.id,
      action,
      /* Ação de fase futura ainda não tem rótulo: descreve, não vaza o código. */
      actionLabel: action ? ACTIVITY_ACTION_LABEL[action] : 'registrou uma ação',
      actorName: row.actor?.full_name ?? row.actor?.email ?? null,
      clientId: row.client_id,
      clientName: row.client?.name ?? null,
      entityType: row.entity_type,
      createdAt: row.created_at,
      detail: role ?? status,
    }
  })
})
