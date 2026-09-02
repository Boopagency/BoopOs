import 'server-only'

import { logActivity } from '@/lib/activity/log'
import { logger } from '@/lib/logging/logger'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type FirstLoginResult = 'promoted' | 'already_active' | 'disabled' | 'no_profile' | 'failed'

/**
 * Primeiro login: `invited` vira `active` e o sistema registra `user.joined`.
 *
 * E o outro lado do ADR-0009 — nao existe tabela de convite, entao o convite
 * "se completa" aqui, no primeiro acesso bem-sucedido.
 *
 * Idempotente por construcao: o `eq('status', 'invited')` faz a promocao
 * acontecer uma unica vez, e so ela dispara o evento. Reentrar dez vezes
 * gera um `user.joined`, nao dez.
 *
 * O filtro tambem e a defesa de quem foi desligado: `disabled` nao casa com
 * `invited`, entao ninguem volta a ficar ativo por clicar num link antigo.
 *
 * Service role pelo mesmo motivo de `getActor` (ADR-0021): ate a FASE 4 a RLS
 * esta ligada e sem politicas. O `userId` vem sempre da sessao recem-trocada
 * no callback, nunca do navegador.
 */
export async function recordFirstLogin(userId: string): Promise<FirstLoginResult> {
  const admin = createSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data: promoted, error } = await admin
    .from('profiles')
    .update({ status: 'active', last_seen_at: now })
    .eq('id', userId)
    .eq('status', 'invited')
    .select('id')
    .maybeSingle()

  if (error) {
    logger.error('auth.first_login_failed', { userId, code: error.code })
    return 'failed'
  }

  if (promoted) {
    await logActivity({
      action: 'user.joined',
      entityType: 'profile',
      entityId: userId,
      actorId: userId,
      /* Identificadores e transicao — nunca e-mail, nome ou token. */
      metadata: { status_from: 'invited', status_to: 'active' },
    })
    return 'promoted'
  }

  /*
   * Nao promoveu: ou ja estava ativo (caminho normal de quem volta), ou esta
   * `disabled` e nao pode entrar. So o segundo caso muda o desfecho, entao
   * vale uma leitura para distinguir — sem ela, uma pessoa desligada veria
   * "entrou" e so seria barrada no `requireActor`, com mensagem errada.
   */
  const { data: profile } = await admin
    .from('profiles')
    .select('status')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) {
    /*
     * Sessao valida sem espelho em `profiles`: estado inconsistente, nunca um
     * usuario novo. Ninguem ganha perfil aqui — criar um seria inventar papel
     * para quem o trigger de `auth.users` nao registrou.
     */
    logger.warn('auth.first_login_profile_missing', { userId })
    return 'no_profile'
  }

  if (profile.status !== 'active') return 'disabled'

  await admin.from('profiles').update({ last_seen_at: now }).eq('id', userId)

  return 'already_active'
}
