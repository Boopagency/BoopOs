import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/config/env'
import { callbackErrorCode, type LoginErrorCode } from '@/lib/auth/errors'
import { recordFirstLogin } from '@/lib/auth/first-login'
import { AFTER_LOGIN_PATH, LOGIN_PATH, NEXT_COOKIE, safeNextPath } from '@/lib/auth/routes'
import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Volta de um link de e-mail. Duas portas, porque existem dois tipos de link.
 *
 * ## 1. `?code=` — PKCE (FASE 3, intacta)
 *
 * O Magic Link pedido no `/login`. O `code` sozinho nao vale nada: so vira
 * sessao junto do verifier que o `signInWithOtp` gravou em cookie no navegador
 * de quem pediu. E o que faz um link encaminhado a terceiro nao entregar a
 * conta.
 *
 * ## 2. `?token_hash=&type=` — link iniciado no SERVIDOR (FASE 5)
 *
 * O convite (`inviteUserByEmail`) nasce no servidor, entao NAO existe verifier
 * no navegador de quem foi convidado — a pessoa nunca chamou `signInWithOtp`.
 * Sem esta porta o GoTrue cai no fluxo implicito e devolve a sessao no
 * fragmento da URL (`#access_token=...`), que nunca chega ao servidor: o
 * convite morreria aqui com "link invalido".
 *
 * `verifyOtp({ type, token_hash })` resolve inteiramente no servidor e grava o
 * cookie pelo mesmo caminho da porta 1. Exige que o template de convite do
 * Supabase aponte para ca com `{{ .TokenHash }}` — passo manual documentado em
 * `docs/deployment.md`.
 *
 * As duas portas convergem: dai para baixo o codigo e o mesmo, inclusive a
 * promocao `invited -> active` e o `signOut` de quem nao pode entrar.
 *
 * Route Handler, e nao pagina: aqui da para escrever cookie e devolver status
 * HTTP proprio.
 */

/**
 * Os tipos de link que esta rota aceita. Lista de permissao, e nao de recusa:
 * `type` vem da URL, e `recovery` ou `email_change` chegando aqui abririam um
 * fluxo que o produto nao tem (nao existe senha — D-06, ADR-0009).
 */
const ACCEPTED_OTP_TYPES = new Set(['invite', 'magiclink', 'signup', 'email'])
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams

  /*
   * Destino montado sobre a origem canonica da aplicacao, nunca sobre o host
   * do request — `Host` e `X-Forwarded-Host` sao controlaveis pelo cliente.
   */
  const failure = (code: LoginErrorCode) =>
    NextResponse.redirect(new URL(`${LOGIN_PATH}?erro=${code}`, env.NEXT_PUBLIC_APP_URL), {
      /* 303: a proxima requisicao e um GET na tela de login, nao o reenvio disto. */
      status: 303,
    })

  /* O proprio Supabase pode voltar com erro em vez de code (link expirado). */
  const bounced = params.get('error_code') ?? params.get('error')
  if (bounced) {
    /* Cortado: o valor vem da URL, e log nao e lugar para texto sem limite. */
    logger.warn('auth.callback_rejected', { code: bounced.slice(0, 64) })
    return failure(callbackErrorCode(params.get('error_code') ?? undefined))
  }

  const code = params.get('code')
  const tokenHash = params.get('token_hash')
  const otpType = params.get('type')

  if (!code && !tokenHash) {
    logger.warn('auth.callback_without_credential')
    return failure('link_invalid')
  }

  const supabase = await createSupabaseServerClient()

  /*
   * Nem `code` nem `token_hash` sao logados em nenhum ramo: os dois SAO a
   * credencial, e log nao e lugar para credencial (.claude/rules/security.md).
   */
  const { data, error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await (async () => {
        if (!otpType || !ACCEPTED_OTP_TYPES.has(otpType)) {
          logger.warn('auth.callback_unsupported_type', { type: (otpType ?? '').slice(0, 32) })
          /* Forma do retorno do supabase-js, para os dois ramos convergirem. */
          return { data: { user: null }, error: { code: 'validation_failed', status: 400 } }
        }

        return supabase.auth.verifyOtp({
          type: otpType as 'invite' | 'magiclink' | 'signup' | 'email',
          token_hash: tokenHash as string,
        })
      })()

  if (error || !data.user) {
    logger.warn('auth.exchange_failed', { code: error?.code, status: error?.status })
    return failure(callbackErrorCode(error?.code))
  }

  const result = await recordFirstLogin()

  if (result !== 'promoted' && result !== 'already_active') {
    /*
     * Fail closed por lista de permissao, e nao por lista de recusa: so
     * `promoted` e `already_active` entram. Um resultado novo — `no_session`,
     * ou qualquer outro que a fronteira do banco passe a devolver — cai aqui
     * em vez de escapar por um `else` que ninguem revisou.
     *
     * Sessao trocada, mas a identidade nao autoriza entrada: o `signOut`
     * derruba o cookie na hora, em vez de deixar uma sessao viva que o
     * `requireActor` teria de barrar a cada request.
     */
    await supabase.auth.signOut()

    if (result === 'disabled') return failure('access_revoked')
    return failure('activation_pending')
  }

  /*
   * O destino veio do cookie que a propria action gravou, e nao da URL do
   * e-mail. Revalidado mesmo assim: um cookie e do navegador, e o navegador
   * nao e uma fonte confiavel.
   */
  const store = await cookies()
  const next = safeNextPath(store.get(NEXT_COOKIE)?.value) ?? AFTER_LOGIN_PATH
  store.delete(NEXT_COOKIE)

  return NextResponse.redirect(new URL(next, env.NEXT_PUBLIC_APP_URL), { status: 303 })
}
