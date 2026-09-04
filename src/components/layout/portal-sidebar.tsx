import Link from 'next/link'
import { BoopMark } from '@/components/brand/boop-mark'
import { PortalNav } from '@/components/layout/portal-nav'
import { ProjectSwitcher } from '@/components/layout/project-switcher'
import { SignOutButton } from '@/components/patterns/sign-out-button'
import { portalHref, type PortalSection } from '@/config/app'
import { firstName } from '@/lib/format'

export interface PortalSidebarProps {
  projectId: string
  clientName: string
  projectName: string
  sections: readonly PortalSection[]
  projects: readonly { id: string; name: string }[]
  /** Nome de quem está logado. `null` quando o cadastro nunca foi preenchido. */
  fullName: string | null
}

/**
 * A moldura permanente do portal, no desktop.
 *
 * ## Por que ela se paga com duas seções
 *
 * Uma sidebar que oferecesse só "Início / Projeto" pareceria um menu quebrado —
 * e a FASE 1.5 estava certa em recusá-la naquele momento. O que mudou não foi a
 * contagem de links: foi ela absorver **quatro zonas** — marca, cliente com
 * seletor de projeto, seções, e conta. Ao absorvê-las, o cabeçalho de largura
 * total e o rodapé de colofão deixam de ter função e morrem, e é essa troca que
 * transforma "site com coluna à esquerda" em aplicação (ADR-0027).
 *
 * ## O que ela continua não fazendo
 *
 * Não inventa item. A navegação segue a FEATURE (D-25): duas seções hoje, e uma
 * linha em `src/config/app.ts` por fase. Nada de item cinza, riscado ou com
 * cadeado para preencher a coluna — um menu que anuncia sala vazia é pior que
 * um menu curto.
 *
 * Não conhece ciclo, etapa nem equipe. Isso é conteúdo, e conteúdo é da rail e
 * do workspace.
 */
export function PortalSidebar({
  projectId,
  clientName,
  projectName,
  sections,
  projects,
  fullName,
}: PortalSidebarProps) {
  const nome = firstName(fullName)

  return (
    <div className="flex h-full flex-col gap-10 px-6 py-6">
      <Link
        href={portalHref(projectId, '')}
        className="flex min-h-11 items-center"
        aria-label={`${clientName} — início do projeto`}
      >
        <BoopMark className="h-7 w-auto" priority />
      </Link>

      {/*
        Cliente e projeto: a moldura de contexto. O nome do cliente é texto, e
        não link — ele não leva a lugar nenhum, porque o cliente É o portal.
      */}
      <div>
        <p className="t-meta text-foreground max-w-[16ch] leading-relaxed">{clientName}</p>
        {/*
          Com um projeto só, o seletor não renderiza e sobra o nome em texto.
          Com vários, o nome vira o próprio gatilho — nunca os dois ao mesmo
          tempo, que imprimiria o mesmo nome duas vezes na mesma coluna.
        */}
        {projects.length > 1 ? (
          <ProjectSwitcher
            projectId={projectId}
            projectName={projectName}
            projects={projects}
            align="start"
            className="-mt-1"
          />
        ) : (
          <p className="t-meta text-muted mt-1.5 max-w-[16ch] leading-relaxed">{projectName}</p>
        )}
      </div>

      <PortalNav projectId={projectId} sections={sections} orientation="vertical" />

      {/* A conta desce para a base: é onde toda aplicação a procura. */}
      <div className="border-rule mt-auto border-t pt-5">
        {nome && <p className="t-meta text-muted mb-1">{nome}</p>}
        <SignOutButton />
      </div>
    </div>
  )
}
