import Link from 'next/link'
import { PROJECT_TYPE_LABEL } from '@/config/enums'
import { ProjectStatusMark } from '@/domains/projects/components/project-status-mark'
import type { ProjectListItem } from '@/domains/projects/types'
import { formatFullDate } from '@/lib/format'

/**
 * Os projetos de um cliente, no admin.
 *
 * **Lista, nunca tabela.** A regra de mobile-first proibe scroll horizontal no
 * celular, e uma tabela de cinco colunas so cabe la virando exatamente isso.
 * Cada linha empilha e continua legivel a 360px (.claude/rules/frontend.md).
 *
 * Sem `<Suspense>` e sem estado de carregamento proprio: quem carrega e o
 * Server Component da pagina, e o `loading.tsx` da rota cobre o intervalo.
 */
export function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  if (projects.length === 0) {
    return (
      <p className="t-body text-muted measure">
        Este cliente ainda não tem projeto. O primeiro projeto é o que faz o portal existir para ele
        — antes disso, ele entra e encontra uma tela de espera.
      </p>
    )
  }

  return (
    <ul className="divide-rule border-rule divide-y border-y">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            href={`/admin/projetos/${project.id}`}
            className="group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-5"
          >
            <span className="min-w-0">
              <span className="t-title text-foreground group-hover:text-accent-text block transition-colors">
                {project.name}
              </span>
              <span className="t-label text-muted mt-1 block">
                {PROJECT_TYPE_LABEL[project.type]} · Ciclo {project.cycle}
                {project.startedOn && ` · desde ${formatFullDate(project.startedOn)}`}
              </span>
            </span>

            <ProjectStatusMark status={project.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
