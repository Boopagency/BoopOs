import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/layout/container'
import { integrationStatus, env, isDevelopment } from '@/config/env'

export const metadata: Metadata = {
  title: 'Technical Foundation',
}

const ROUTES = [
  { href: '/portal', label: 'Client Portal', hint: 'Portal do cliente' },
  { href: '/admin', label: 'Admin', hint: 'Operacao interna da Boop' },
] as const

/**
 * Pagina de desenvolvimento da FASE 1. Confirma que a fundacao esta de pe.
 * Sai de cena quando o produto real ocupar a raiz.
 */
export default function HomePage() {
  /* Booleans apenas — nunca o valor de nenhuma variavel (docs/security.md). */
  const integrations = isDevelopment ? integrationStatus() : null

  return (
    <main id="main" className="flex min-h-dvh flex-col justify-center py-16">
      <Container size="narrow">
        <p className="text-muted text-sm">BOOP OS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Technical Foundation
        </h1>
        <p className="text-muted mt-4 max-w-prose">
          A fundacao tecnica esta de pe. O sistema visual e as funcionalidades de produto entram nas
          proximas fases.
        </p>

        <p className="text-muted mt-6 text-sm">
          Environment: <span className="text-foreground">{env.NODE_ENV}</span>
        </p>

        <nav aria-label="Contextos da aplicacao" className="mt-10">
          <ul className="grid gap-3 sm:grid-cols-2">
            {ROUTES.map((route) => (
              <li key={route.href}>
                <Link
                  href={route.href}
                  className="border-border bg-surface hover:bg-background block rounded-[--radius] border p-4 transition-colors"
                >
                  <span className="block text-sm font-medium">{route.label}</span>
                  <span className="text-muted mt-1 block text-sm">{route.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {integrations && (
          <section aria-labelledby="integrations-heading" className="mt-12">
            <h2 id="integrations-heading" className="text-sm font-medium">
              Integracoes
            </h2>
            <p className="text-muted mt-1 text-sm">
              Visivel apenas em desenvolvimento. Mostra se a variavel existe, nunca o valor dela.
            </p>
            <dl className="divide-border border-border mt-4 divide-y border-y text-sm">
              {Object.entries(integrations).map(([name, configured]) => (
                <div key={name} className="flex items-center justify-between py-2.5">
                  <dt className="capitalize">{name}</dt>
                  <dd className={configured ? 'text-success' : 'text-muted'}>
                    {configured ? 'configured' : 'not configured'}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </Container>
    </main>
  )
}
