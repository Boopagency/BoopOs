import type { Metadata } from 'next'
import Link from 'next/link'
import { BoopMark } from '@/components/brand/boop-mark'
import { CloudLayer } from '@/components/brand/cloud-layer'
import { env, integrationStatus, isDevelopment } from '@/config/env'
import { DEMO_PROJECT_ID } from '@/lib/data/portal'

export const metadata: Metadata = { title: 'Protótipo' }

const FLOW = [
  { href: '/login', label: 'Entrar', hint: 'Primeiro contato com a marca' },
  { href: '/bem-vindo', label: 'Bem-vindas', hint: 'Primeiro acesso' },
  { href: `/portal/${DEMO_PROJECT_ID}`, label: 'Portal', hint: 'Dashboard do cliente' },
  { href: '/admin', label: 'Admin', hint: 'Operação interna · a partir da FASE 5' },
] as const

/**
 * Indice do prototipo. Nao faz parte do produto: existe para abrir o fluxo
 * durante a revisao e some quando o portal real ocupar a raiz.
 */
export default function HomePage() {
  const integrations = isDevelopment ? integrationStatus() : null

  return (
    <main
      id="main"
      className="on-inverse bg-navy relative isolate flex min-h-dvh flex-col overflow-hidden"
    >
      <CloudLayer density="pair" className="opacity-25 mix-blend-screen" />

      <div className="content relative flex flex-1 flex-col py-12 md:py-16">
        <BoopMark variant="light" className="h-7 md:h-8" priority />

        <div className="flex flex-1 flex-col justify-center py-16">
          <p className="t-meta fade rise-1 text-sky">Boop OS</p>
          <h1 className="t-display rise rise-2 text-cloud mt-6 max-w-[11ch]">Protótipo visual</h1>
          <p className="t-lead rise rise-3 text-muted-on-inverse mt-8 max-w-[44ch]">
            Sistema visual e fluxo navegável do portal do cliente. Os dados são fictícios e nenhuma
            ação é registrada.
          </p>

          <nav aria-label="Telas do protótipo" className="rise rise-4 mt-14">
            <ul className="divide-rule-inverse border-rule-inverse divide-y border-y">
              {FLOW.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between gap-6 py-5 transition-colors"
                  >
                    <span>
                      <span className="t-title text-cloud group-hover:decoration-accent block group-hover:underline group-hover:underline-offset-[6px]">
                        {item.label}
                      </span>
                      <span className="t-meta text-muted-on-inverse mt-1.5 block">{item.hint}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="t-title text-sky transition-transform duration-[--motion-fast] group-hover:translate-x-1"
                    >
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <p className="t-meta text-muted-on-inverse/70">Environment: {env.NODE_ENV}</p>

          {integrations && (
            <dl className="t-meta text-muted-on-inverse/70 flex flex-wrap gap-x-6 gap-y-2">
              {Object.entries(integrations).map(([name, configured]) => (
                <div key={name} className="flex gap-2">
                  <dt className="capitalize">{name}</dt>
                  <dd className={configured ? 'text-sky' : 'text-muted-on-inverse/50'}>
                    {configured ? 'on' : 'off'}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </main>
  )
}
