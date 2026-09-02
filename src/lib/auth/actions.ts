'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { env, isProduction } from '@/config/env'
import {
  AUTH_CALLBACK_PATH,
  LOGIN_PATH,
  NEXT_COOKIE,
  NEXT_COOKIE_MAX_AGE,
  safeNextPath,
} from '@/lib/auth/routes'
import { sendErrorCode, type LoginErrorCode } from '@/lib/auth/errors'
import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Server Actions de autenticacao.
 *
 * Uma Server Action e um endpoint publico (docs/spec-review.md R-01): qualquer
 * um pode fazer POST nela. Por isso a entrada passa por zod `.strict()` antes
 * de qualquer coisa, e nada do payload vira autoridade — o unico dado que o
 * formulario fornece e o e-mail para quem enviar o link, e quem decide se
 * aquele e-mail pode receber alguma coisa e o Supabase, nao esta funcao.
 *
 * `defineWorkflow` (validar/autenticar/autorizar/executar/auditar) nasce na
 * fase do primeiro workflow de dominio. Aqui nao ha o que autorizar: a acao
 * existe justamente para quem ainda nao tem identidade.
 */

const requestMagicLinkSchema = z
  .object({
    email: z.email({ error: 'invalid_email' }).trim().toLowerCase().max(320),
    next: z.string().max(2048).optional(),
  })
  .strict()

export type MagicLinkState =
  { status: 'idle' } | { status: 'sent'; email: string } | { status: 'error'; code: LoginErrorCode }

/**
 * Dispara o Magic Link.
 *
 * PROTECAO DE ENUMERACAO: o retorno de sucesso e o mesmo exista ou nao a
 * conta. `shouldCreateUser: false` garante que um e-mail desconhecido nao vira
 * cadastro (nao ha signup publico — ADR-0009), e `sendErrorCode` transforma
 * "essa conta nao existe" em silencio. Sem isso, o formulario de login
 * responderia quem e cliente da Boop para qualquer pessoa na internet.
 */
export async function requestMagicLink(
  _previous: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = requestMagicLinkSchema.safeParse({
    email: formData.get('email'),
    ...(formData.get('next') ? { next: formData.get('next') } : {}),
  })

  if (!parsed.success) return { status: 'error', code: 'invalid_email' }

  const { email, next } = parsed.data

  /*
   * O destino do link e montado a partir da origem canonica da aplicacao
   * (`NEXT_PUBLIC_APP_URL`), nunca de header de request: `Host` e
   * `X-Forwarded-Host` sao controlaveis pelo cliente, e um link de entrada
   * apontando para o host que o atacante escolheu entregaria a sessao.
   *
   * A URL e sempre a mesma, sem query: e o que permite cadastrar a Redirect
   * URL do Supabase de forma exata, sem curinga. O destino pedido vai por
   * cookie (ver NEXT_COOKIE).
   */
  const callback = new URL(AUTH_CALLBACK_PATH, env.NEXT_PUBLIC_APP_URL)
  const safeNext = safeNextPath(next)

  try {
    const store = await cookies()

    if (safeNext) {
      store.set(NEXT_COOKIE, safeNext, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: NEXT_COOKIE_MAX_AGE,
      })
    }

    const supabase = await createSupabaseServerClient()

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: callback.toString(),
        /* Sem cadastro publico. Todo acesso nasce de convite (ADR-0009). */
        shouldCreateUser: false,
      },
    })

    if (error) {
      const code = sendErrorCode(error.code, error.status)

      /* Log tecnico: codigo e status, nunca o e-mail nem o link. */
      logger.warn('auth.magic_link_rejected', { code: error.code, status: error.status })

      if (code) return { status: 'error', code }
    }
  } catch (cause) {
    logger.error('auth.magic_link_unavailable', {
      reason: cause instanceof Error ? cause.name : 'unknown',
    })
    return { status: 'error', code: 'unavailable' }
  }

  return { status: 'sent', email }
}

/**
 * Encerra a sessao. Server Action, e nao Route Handler GET, porque sair e uma
 * mutacao: um GET de logout e disparavel por `<img src>` de terceiro.
 */
export async function signOut(): Promise<never> {
  try {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
  } catch (cause) {
    /*
     * Falhar aqui nao pode prender ninguem dentro do produto: o redirect
     * acontece de qualquer forma, e o cookie invalido cai no proximo refresh.
     */
    logger.error('auth.sign_out_failed', {
      reason: cause instanceof Error ? cause.name : 'unknown',
    })
  }

  redirect(LOGIN_PATH)
}
