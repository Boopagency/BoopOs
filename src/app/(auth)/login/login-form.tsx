'use client'

import Link from 'next/link'
import { useState } from 'react'
import { BoopEyes } from '@/components/brand/boop-eyes'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/field'
import { DEMO_PROJECT_ID } from '@/lib/data/portal'

/*
 * PROTOTIPO: este formulario nao autentica ninguem.
 *
 * Nao ha chamada de rede, nao ha sessao, nao ha cookie. O envio so troca o
 * estado local para mostrar a tela de "link enviado", e o caminho para o
 * portal e um link explicito marcado como prototipo — nunca um redirect que
 * pudesse ser confundido com login de verdade (§ regra de mock mode).
 *
 * O Magic Link real entra na FASE 3, com @supabase/ssr.
 */
export function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <BoopEyes blink className="w-16" />
        <h2 className="t-section text-foreground mt-8">Link enviado.</h2>
        <p className="t-body text-muted mt-4">
          Se <span className="text-foreground">{email}</span> tiver acesso, o link de entrada chega
          em instantes. Ele vale por 15 minutos e só pode ser usado uma vez.
        </p>

        <div className="border-rule mt-10 border-t pt-6">
          <p className="t-meta text-muted">Protótipo</p>
          <p className="t-label text-muted mt-2">
            Nenhum e-mail foi enviado de verdade. Siga direto para ver o portal.
          </p>
          <Link
            href={`/bem-vindo?p=${DEMO_PROJECT_ID}`}
            className="t-meta bg-navy text-on-inverse hover:bg-navy/90 mt-4 inline-flex h-12 items-center rounded-sm px-5 transition-colors"
          >
            Ir para o portal →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <form
      className="w-full max-w-md"
      onSubmit={(event) => {
        event.preventDefault()
        setSent(true)
      }}
    >
      <h2 className="t-title text-foreground">Acesse seu projeto</h2>
      <p className="t-body text-muted mt-3">
        Enviamos um link de entrada para o seu e-mail. Sem senha para lembrar.
      </p>

      <div className="mt-8">
        <Field label="Seu e-mail" required>
          {({ id, describedBy }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              type="email"
              name="email"
              autoComplete="email"
              required
              placeholder="voce@suamarca.com.br"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          )}
        </Field>
      </div>

      <Button type="submit" size="lg" className="mt-6 w-full">
        Receber link de acesso
      </Button>

      <p className="t-label text-muted mt-8">
        O acesso ao Boop OS é feito por convite. Se você não recebeu o seu, fale com a pessoa que
        cuida do seu projeto.
      </p>
    </form>
  )
}
