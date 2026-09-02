import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/config/env'
import { callbackErrorCode, type LoginErrorCode } from '@/lib/auth/errors'
import { recordFirstLogin } from '@/lib/auth/first-login'
import { AFTER_LOGIN_PATH, LOGIN_PATH, NEXT_COOKIE, safeNextPath } from '@/lib/auth/routes'
import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Volta do Magic Link — a troca do `code` do PKCE por sessao.
 *
 * O link do e-mail aponta para o `/auth/v1/verify` do Supabase, que redireciona
 * para ca com `?code=`. O `code` sozinho nao vale nada: so vira sessao junto do
 * verifier que o `signInWithOtp` gravou em cookie no navegador de quem pediu.
 * E o que faz um link encaminhado a terceiro nao entregar a conta.
 *
 * Route Handler, e nao pagina: aqui da para escrever cookie e devolver status
 * HTTP proprio.
 */
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
  if (!code) {
    logger.warn('auth.callback_without_code')
    return failure('link_invalid')
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    /* Codigo do erro, jamais o `code` da URL: ele e credencial. */
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
