import type { ReactNode } from 'react'
import Link from 'next/link'
import { BoopMark } from '@/components/brand/boop-mark'
import { PortalBottomNav } from '@/components/layout/portal-bottom-nav'
import { PortalNav } from '@/components/layout/portal-nav'
import { SignOutButton } from '@/components/patterns/sign-out-button'
import { portalHref } from '@/config/app'

export interface PortalShellProps {
  projectId: string
  clientName: string
  projectName: string
  cycle: number
  children: ReactNode
}

/**
 * Casca do portal do cliente.
 *
 * A referência é o cabeçalho de uma revista, não o de um SaaS: identificação
 * discreta em cima, sumário em linha embaixo, e uma régua separando. Nenhuma
 * caixa, nenhuma sombra, nenhum ícone — a hierarquia vem do tamanho e do
 * espaço (docs/design-direction.md).
 */
export function PortalShell({
  projectId,
  clientName,
  projectName,
  cycle,
  children,
}: PortalShellProps) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-rule bg-background/92 sticky top-0 z-30 border-b backdrop-blur-sm">
        <div className="content">
          <div className="flex h-16 items-center justify-between gap-4 md:h-20">
            <Link
              href={portalHref(projectId, '')}
              className="flex items-center gap-3"
              aria-label={`${clientName} — início do projeto`}
            >
              <BoopMark className="h-6 w-auto md:h-7" priority />
              <span aria-hidden="true" className="bg-rule-strong hidden h-5 w-px sm:block" />
              <span className="t-meta text-muted hidden sm:block">
                {clientName} · {projectName}
              </span>
            </Link>

            <div className="flex items-center gap-4">
              <p className="t-meta text-muted text-right">
                <span className="text-foreground">Ciclo {cycle}</span>
                {/* O rotulo de prototipo cede espaco no celular, como ja
                    acontece com o nome do cliente ao lado da marca. */}
                <span aria-hidden="true" className="text-rule-strong mx-2 max-sm:hidden">
                  /
                </span>
                <span title="Todos os dados desta tela são fictícios" className="max-sm:hidden">
                  Protótipo
                </span>
              </p>

              <span aria-hidden="true" className="bg-rule-strong h-5 w-px" />

              <SignOutButton />
            </div>
          </div>

          <PortalNav projectId={projectId} />
        </div>
      </header>

      {/* pb-20 no celular reserva a altura da barra inferior fixa */}
      <main id="main" className="flex-1 pb-24 md:pb-0">
        {children}
      </main>

      <footer className="border-rule mt-16 border-t py-8 max-md:hidden">
        <div className="content flex items-center justify-between gap-4">
          <p className="t-meta text-muted">Boop OS · Protótipo visual · Dados fictícios</p>
          <p className="t-meta text-muted">{clientName}</p>
        </div>
      </footer>

      <PortalBottomNav projectId={projectId} />
    </div>
  )
}
