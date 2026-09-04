import Link from 'next/link'
import { portalHref } from '@/config/app'
import { cn } from '@/lib/cn'

export interface ProjectSwitcherProps {
  projectId: string
  projectName: string
  /**
   * Todos os projetos que esta pessoa alcanca. So `id` e `name` — a troca de
   * contexto nao precisa de mais nada, e o que nao e necessario nao atravessa a
   * fronteira do RSC.
   */
  projects: readonly { id: string; name: string }[]
  /** De que lado o painel abre. `start` na sidebar, `end` no cabecalho. */
  align?: 'start' | 'end'
  className?: string
}

/**
 * Troca de contexto entre projetos.
 *
 * `details`/`summary` e nao um menu com estado: nao precisa de `'use client'`,
 * funciona sem JavaScript, abre e fecha pelo teclado e ja e anunciado como
 * expansivel pelo leitor de tela. Uma biblioteca de dropdown resolveria o mesmo
 * com um bundle a mais (ADR-0018).
 *
 * O seletor **so aparece com mais de um projeto** — com um so, a complexidade
 * fica invisivel (docs/product.md). Nao e um oitavo item de navegacao: e
 * contexto, e por isso mora ao lado do nome do cliente, nunca na lista de
 * secoes.
 *
 * A autorizacao nao passa por aqui. `listPortalProjects()` ja devolveu, sob
 * RLS, so o que esta pessoa alcanca; trocar de projeto e seguir um link, e o
 * layout do destino chama `requireVisiblePortalProject()` de novo. Um id vindo
 * do navegador nunca teve autoridade sobre nada.
 */
export function ProjectSwitcher({
  projectId,
  projectName,
  projects,
  align = 'end',
  className,
}: ProjectSwitcherProps) {
  const others = projects.filter((project) => project.id !== projectId)

  if (others.length === 0) return null

  return (
    <details className={cn('relative', className)}>
      <summary className="t-meta text-muted hover:text-foreground flex min-h-11 cursor-pointer list-none items-center gap-1.5 transition-colors duration-[--motion-fast] marker:content-none">
        <span className="max-w-[14ch] truncate">{projectName}</span>
        <span aria-hidden="true" className="text-rule-strong">
          ▾
        </span>
        <span className="sr-only">Trocar de projeto</span>
      </summary>

      <div
        className={cn(
          'border-rule bg-background absolute top-full z-40 mt-2 min-w-56 border py-2 shadow-sm',
          align === 'end' ? 'right-0' : 'left-0',
        )}
      >
        <ul>
          {others.map((project) => (
            <li key={project.id}>
              <Link
                href={portalHref(project.id, '')}
                className="t-meta text-muted hover:bg-surface-soft hover:text-foreground flex min-h-11 items-center px-4 transition-colors duration-[--motion-fast]"
              >
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
