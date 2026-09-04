import type { ReactNode } from 'react'
import Link from 'next/link'
import { BoopMark } from '@/components/brand/boop-mark'
import { PortalBottomNav } from '@/components/layout/portal-bottom-nav'
import { PortalNav } from '@/components/layout/portal-nav'
import { PortalSidebar } from '@/components/layout/portal-sidebar'
import { ProjectSwitcher } from '@/components/layout/project-switcher'
import { Workspace } from '@/components/layout/workspace'
import { SignOutButton } from '@/components/patterns/sign-out-button'
import { portalHref, showsBottomNav, type PortalSection } from '@/config/app'

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
   * So `id` e `name` — a casca nao precisa de mais nada, e o que nao e
   * necessario nao atravessa a fronteira do RSC.
   */
  projects?: readonly { id: string; name: string }[]
  /** Nome de quem esta logado, para a base da sidebar. Pode ser nulo. */
  fullName?: string | null
  children: ReactNode
}

/**
 * Casca do portal do cliente — um AMBIENTE no desktop, a FASE 8 no celular.
 *
 * ```
 * >= lg (1024px)                        < lg
 * ┌──────────┬─────────────────────┐    ┌────────────────────┐
 * │ SIDEBAR  │  WORKSPACE          │    │ CABEÇALHO sticky   │
 * │ 17rem    │  (+ rail em xl,     │    │ marca · projeto ▾  │
 * │ sticky   │     composta pela   │    │ Início   Projeto   │
 * │ h-dvh    │     página)         │    ├────────────────────┤
 * │          │                     │    │  documento rola    │
 * └──────────┴─────────────────────┘    └────────────────────┘
 * ```
 *
 * ## Duas árvores, um componente
 *
 * A sidebar é `hidden lg:block`; o cabeçalho é `lg:hidden`. O celular renderiza
 * a MESMA árvore da FASE 8 — e a garantia mais cara daquela fase, a resposta de
 * atenção acima da dobra em 375 × 667, é preservada por construção, não por
 * medição. Nenhum chrome novo entra abaixo de `lg`.
 *
 * Não há drawer mobile de propósito: a FASE 9 liga Estratégia, `sections` chega
 * a três, e `showsBottomNav()` acende a barra inferior que já existe e já é
 * testada. Construir um drawer agora seria construir para descartar.
 *
 * ## O documento continua sendo o eixo de scroll
 *
 * Sidebar `sticky`, rail `sticky`, workspace no fluxo. Nenhum `overflow` fixo:
 * o Next pula elementos sticky ao procurar o alvo de scroll da navegação, então
 * restauração de scroll, âncora e barra de URL do celular seguem nativas
 * (ADR-0027).
 *
 * ## O que ela não sabe
 *
 * Ciclo, etapa, equipe, atenção, jornada. A casca é MOLDURA (D-29): ela
 * posiciona `children` e a rail que a página compôs, e não conhece nenhum dos
 * dois por dentro.
 */
export function PortalShell({
  projectId,
  clientName,
  projectName,
  sections,
  projects,
  fullName = null,
  children,
}: PortalShellProps) {
  const todos = projects ?? []

  /*
   * A regra da barra inferior mora em `src/config/app.ts`, ao lado do limiar.
   * Quando ela existe, o `main` reserva a altura; quando não existe, a reserva
   * some junto — senão sobra um rodapé fantasma de 96px no celular.
   */
  const comBarra = showsBottomNav(sections)

  return (
    <div className="bg-background lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
      <aside className="border-rule hidden lg:sticky lg:top-0 lg:block lg:h-dvh lg:border-r">
        <PortalSidebar
          projectId={projectId}
          clientName={clientName}
          projectName={projectName}
          sections={sections}
          projects={todos}
          fullName={fullName}
        />
      </aside>

      <div className="flex min-h-dvh flex-col">
        {/*
          O cabeçalho da FASE 8, intacto, e agora só no celular e no tablet: em
          `lg` a sidebar já carrega marca, cliente, projeto, seções e conta, e
          duas molduras para a mesma informação é ruído.
        */}
        <header className="border-rule bg-background/92 sticky top-0 z-30 border-b backdrop-blur-sm lg:hidden">
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
                <ProjectSwitcher
                  projectId={projectId}
                  projectName={projectName}
                  projects={todos}
                  align="end"
                />
                <SignOutButton />
              </div>
            </div>

            <PortalNav
              projectId={projectId}
              sections={sections}
              className={comBarra ? 'hidden md:block' : ''}
            />
          </div>
        </header>

        <main id="main" className={comBarra ? 'flex-1 pb-24 md:pb-0 lg:pb-0' : 'flex-1'}>
          <Workspace>{children}</Workspace>
        </main>

        {comBarra && <PortalBottomNav projectId={projectId} sections={sections} />}
      </div>
    </div>
  )
}
