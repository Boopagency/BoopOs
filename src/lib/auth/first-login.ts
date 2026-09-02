import 'server-only'

import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type FirstLoginResult =
  'promoted' | 'already_active' | 'disabled' | 'no_profile' | 'no_session' | 'failed'

/**
 * Primeiro login: `invited` vira `active` e o sistema registra `user.joined`.
 *
 * E o outro lado do ADR-0009 — nao existe tabela de convite, entao o convite
 * "se completa" aqui, no primeiro acesso bem-sucedido.
 *
 * ## Por que uma funcao no banco, e nao um `update` daqui
 *
 * A promocao escreve `profiles.status`, e `role` mora na mesma linha. Conceder
 * UPDATE de `profiles` a `authenticated` para permitir esta transicao seria
 * conceder, na mesma tacada, `update profiles set role = 'boop_admin' where id
 * = auth.uid()` — escalada de privilegio em uma linha de SQL. Por isso
 * `profiles` nao tem policy nem GRANT de UPDATE para ninguem, e a transicao
 * sai por `public.promote_invited_profile()`: `security definer`, opera
 * exclusivamente sobre `auth.uid()` e faz uma transicao so.
 *
 * A funcao nao recebe parametro nenhum, e e isso que a torna impossivel de
 * apontar para outra pessoa. Esta funcao TypeScript tambem nao recebe: nao ha
 * `userId` para passar adiante, nem para errar.
 *
 * ## Idempotencia
 *
 * O `where status = 'invited'` do lado do banco faz a promocao acontecer uma
 * unica vez, e o `user.joined` e gravado na MESMA transacao. Reentrar dez
 * vezes promove uma vez e escreve um evento, nao dez — e nao existe janela em
 * que a promocao valha e o registro se perca.
 *
 * Quem esta `disabled` nao casa com `invited` e nao volta a ficar ativo por
 * clicar num link antigo.
 */
export async function recordFirstLogin(): Promise<FirstLoginResult> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.rpc('promote_invited_profile')

  if (error) {
    logger.error('auth.first_login_failed', { code: error.code })
    return 'failed'
  }

  const resultado = data as FirstLoginResult | null

  if (
    resultado !== 'promoted' &&
    resultado !== 'already_active' &&
    resultado !== 'disabled' &&
    resultado !== 'no_profile' &&
    resultado !== 'no_session'
  ) {
    /* Resposta fora do contrato: falha fechada, nunca "deu certo, acho". */
    logger.error('auth.first_login_unexpected', { resultado: String(resultado) })
    return 'failed'
  }

  return resultado
}
