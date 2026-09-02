import type { ReactNode } from 'react'
import { Container } from '@/components/layout/container'

export interface ShellProps {
  /** Contexto em que o usuario esta: "Client Portal", "Admin". */
  context: string
  /** Acao do canto direito — hoje "Sair", passada pelo layout autenticado. */
  action?: ReactNode
  /**
   * Navegacao do contexto, abaixo do cabecalho. Entrou na FASE 5, quando o
   * admin passou a ter mais de uma tela: ate ali `/admin` era uma pagina so, e
   * uma barra de navegacao com um item seria decoracao.
   */
  nav?: ReactNode
  children: ReactNode
}

/**
 * Casca compartilhada entre portal e admin. Deliberadamente magra: e apenas
 * cabecalho + regiao principal + rodape, sem navegacao e sem sidebar.
 *
 * A arquitetura visual (sidebar, seletor de projeto, navegacao de sete itens)
 * e decidida na FASE 2 — ver docs/product.md. Cada contexto tem seu proprio
 * layout, entao divergir daqui depois nao exige refatorar o outro.
 */
export function Shell({ context, action, nav, children }: ShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* `border-rule`, e nao `border-border`: nao existe token `--color-border`,
          entao a hairline do cabecalho nunca chegou a aparecer (FASE 1). */}
      <header className="border-rule bg-surface border-b">
        <Container className="flex h-14 items-center gap-3">
          <span className="text-sm font-semibold tracking-tight">BOOP OS</span>
          <span aria-hidden="true" className="text-rule-strong">
            /
          </span>
          <span className="text-muted text-sm">{context}</span>
          {action && <div className="ml-auto">{action}</div>}
        </Container>
        {nav}
      </header>

      <main id="main" className="flex-1 py-10 sm:py-16">
        {children}
      </main>

      <footer className="border-rule border-t py-6">
        <Container>
          <p className="text-muted t-label">BOOP OS · uso interno</p>
        </Container>
      </footer>
    </div>
  )
}
