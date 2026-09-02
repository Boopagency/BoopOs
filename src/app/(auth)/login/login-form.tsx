'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { BoopEyes } from '@/components/brand/boop-eyes'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Field, Input } from '@/components/ui/field'
import { requestMagicLink, type MagicLinkState } from '@/lib/auth/actions'
import { LOGIN_ERROR_MESSAGE, type LoginErrorCode } from '@/lib/auth/errors'

const INITIAL: MagicLinkState = { status: 'idle' }

/**
 * Formulario de entrada — Magic Link de verdade (FASE 3).
 *
 * O desenho e o da FASE 1.5, intacto. O que mudou esta embaixo dele: o envio
 * agora e uma Server Action, e os quatro estados (idle, enviando, enviado,
 * erro) sao reais.
 *
 * `useActionState` mantem o estado no servidor: sem `useEffect`, sem fetch, e
 * o formulario continua funcionando enquanto o JavaScript carrega.
 */
export function LoginForm({
  next,
  initialError,
}: {
  next?: string | undefined
  initialError?: LoginErrorCode | null | undefined
}) {
  const [state, formAction, isPending] = useActionState(requestMagicLink, INITIAL)

  /* Erro do envio vence o erro que veio do callback pela URL. */
  const errorCode = state.status === 'error' ? state.code : (initialError ?? null)
  const fieldError = errorCode === 'invalid_email' ? LOGIN_ERROR_MESSAGE.invalid_email : undefined
  const calloutError = errorCode && errorCode !== 'invalid_email' ? errorCode : null

  if (state.status === 'sent') {
    return (
      <div className="w-full max-w-md">
        <BoopEyes blink className="w-16" />
        <h2 className="t-section text-foreground mt-8">Link enviado.</h2>
        {/*
         * A frase e condicional de proposito: "se tiver acesso". A tela nao
         * pode confirmar que o e-mail existe, senao vira um consultor de
         * quem e cliente da Boop (docs/security.md).
         */}
        <p className="t-body text-muted mt-4">
          Se <span className="text-foreground">{state.email}</span> tiver acesso, o link de entrada
          chega em instantes. Ele vale por 15 minutos e só pode ser usado uma vez.
        </p>

        <p className="t-label text-muted mt-8">
          O link é pessoal: quem abrir, entra. Não encaminhe esse e-mail.
        </p>

        <div className="border-rule mt-10 border-t pt-6">
          <Link
            href="/login"
            className="t-meta text-foreground decoration-rule-strong hover:decoration-accent underline underline-offset-[6px]"
          >
            Usar outro e-mail
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form className="w-full max-w-md" action={formAction}>
      <h2 className="t-title text-foreground">Acesse seu projeto</h2>
      <p className="t-body text-muted mt-3">
        Enviamos um link de entrada para o seu e-mail. Sem senha para lembrar.
      </p>

      {calloutError && (
        <Callout tone="warning" className="mt-6">
          {LOGIN_ERROR_MESSAGE[calloutError]}
        </Callout>
      )}

      {next && <input type="hidden" name="next" value={next} />}

      <div className="mt-8">
        <Field label="Seu e-mail" required {...(fieldError ? { error: fieldError } : {})}>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              type="email"
              name="email"
              autoComplete="email"
              required
              disabled={isPending}
              placeholder="voce@suamarca.com.br"
            />
          )}
        </Field>
      </div>

      <Button type="submit" size="lg" className="mt-6 w-full" disabled={isPending}>
        {isPending ? 'Enviando…' : 'Receber link de acesso'}
      </Button>

      {/* O estado de envio precisa chegar a quem nao ve o botao mudar. */}
      <p aria-live="polite" className="sr-only">
        {isPending ? 'Enviando o link de acesso.' : ''}
      </p>

      <p className="t-label text-muted mt-8">
        O acesso ao Boop OS é feito por convite. Se você não recebeu o seu, fale com a pessoa que
        cuida do seu projeto.
      </p>
    </form>
  )
}
