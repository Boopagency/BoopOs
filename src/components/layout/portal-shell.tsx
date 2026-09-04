import type { ReactNode } from 'react'
import Link from 'next/link'
import { BoopMark } from '@/components/brand/boop-mark'
import { PortalBottomNav } from '@/components/layout/portal-bottom-nav'
import { PortalNav } from '@/components/layout/portal-nav'
import { SignOutButton } from '@/components/patterns/sign-out-button'
import { BOTTOM_NAV_THRESHOLD, portalHref, type PortalSection } from '@/config/app'

export interface PortalShellProps {
  projectId: string
  clientName: string
  projectName: string
  /**
   * As secoes DISPONIVEIS para este projeto — decididas pelo produto, nunca
   * por contagem de linhas (`visibleSections`).
   */
  sections: readonly PortalSection[]
  /**
   * Todos os projetos que esta pessoa alcanca. Com um so, nada muda na tela.
   *
   * So `id` e `name` — o cabecalho nao precisa de mais nada, e o que nao e
   * necessario nao atravessa a fronteira do RSC.
   */
  projects?: readonly { id: string; name: string }[]
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
  sections,
  projects,
  children,
}: PortalShellProps) {
  const others = (projects ?? []).filter((project) => project.id !== projectId)

  /*
   * A barra inferior so se paga com tres destinos ou mais. Abaixo disso ela
   * custaria 56px permanentes mais a area de gestos para oferecer um link que a
   * Home ja da, e o painel "Mais" nao teria o que abrir.
   *
   * Quando ela nao renderiza, a RESERVA de espaco no `main` some junto — senao
   * sobra um rodape fantasma de 96px no celular.
   */
  const comBarra = sections.length >= BOTTOM_NAV_THRESHOLD

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-rule bg-background/92 sticky top-0 z-30 border-b backdrop-blur-sm">
        <div className="content">
          <div className="flex h-14 items-center justify-between gap-4 md:h-16">
            <Link
              href={portalHref(projectId, '')}
              className="flex min-h-11 items-center gap-3"
              aria-label={`${clientName} — início do projeto`}
            >
              <BoopMark className="h-6 w-auto md:h-7" priority />
              <span aria-hidden="true" className="bg-rule-strong hidden h-5 w-px sm:block" />
              <span className="t-meta text-muted hidden sm:block">
                {clientName} · {projectName}
              </span>
            </Link>

            <div className="flex items-center gap-4">
              {/*
                Seletor de projeto — so com mais de um (docs/product.md).

                `details`/`summary` e nao um menu com estado: nao precisa de
                `'use client'`, funciona sem JavaScript, abre e fecha pelo
                teclado e ja e anunciado como expansivel pelo leitor de tela.
                Uma biblioteca de dropdown resolveria o mesmo com um bundle a
                mais (ADR-0018).
              */}
              {others.length > 0 && (
                <details className="relative">
                  <summary className="t-meta text-muted hover:text-foreground flex min-h-11 cursor-pointer list-none items-center gap-1.5 transition-colors marker:content-none">
                    <span className="max-w-[14ch] truncate">{projectName}</span>
                    <span aria-hidden="true" className="text-rule-strong">
                      ▾
                    </span>
                    <span className="sr-only">Trocar de projeto</span>
                  </summary>

                  <div className="border-rule bg-background absolute top-full right-0 z-40 mt-2 min-w-56 border py-2 shadow-sm">
                    <ul>
                      {others.map((project) => (
                        <li key={project.id}>
                          <Link
                            href={portalHref(project.id, '')}
                            className="t-meta text-muted hover:bg-surface-soft hover:text-foreground flex min-h-11 items-center px-4 transition-colors"
                          >
                            {project.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              )}

              {/*
                "Ciclo N" saiu daqui na FASE 8. Ciclo e vocabulario de operacao:
                ele significa alguma coisa DENTRO da jornada, e nada dentro de
                uma barra de aplicacao. Desceu para o bloco "Agora", onde tem
                contexto (D-29, docs/product.md).
              */}
              <SignOutButton />
            </div>
          </div>

          {/*
            A linha de palavras vale nos DOIS breakpoints enquanto a barra
            inferior nao existir. Duas palavras cabem folgado em 375px.
          */}
          <PortalNav
            projectId={projectId}
            sections={sections}
            className={comBarra ? 'hidden md:block' : ''}
          />
        </div>
      </header>

      {/* A reserva de altura existe SO quando a barra inferior existe. */}
      <main id="main" className={comBarra ? 'flex-1 pb-24 md:pb-0' : 'flex-1'}>
        {children}
      </main>

      <footer className="border-rule mt-16 border-t py-8 max-md:hidden">
        <div className="content flex items-center justify-between gap-4">
          {/*
            O rodape dizia "Dados ficticios", e desde a FASE 6 isso deixou de
            ser verdade: projeto e jornada vem do banco. Continuar afirmando
            seria o produto mentindo para o cliente sobre o que ele esta vendo.
          */}
          <p className="t-meta text-muted">Boop OS</p>
          <p className="t-meta text-muted">{clientName}</p>
        </div>
      </footer>

      {comBarra && <PortalBottomNav projectId={projectId} sections={sections} />}
    </div>
  )
}
