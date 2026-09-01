import type { Metadata } from 'next'
import { ProjectJourney } from '@/components/patterns/project-journey'
import { SectionHeading } from '@/components/patterns/section-heading'
import { getJourney, getMeetings, getNextDelivery, getProject } from '@/lib/data/portal'
import { formatDayMonth, formatFullDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Projeto' }

/*
 * A pagina do projeto responde "o que combinamos, onde estamos e o que vem".
 * Nao e gestao interna: nao ha tarefa, responsavel, prazo interno nem esforco.
 */
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const [project, journey, delivery, meetings] = await Promise.all([
    getProject(projectId),
    getJourney(projectId),
    getNextDelivery(projectId),
    getMeetings(projectId),
  ])

  const past = meetings.filter((m) => m.status === 'completed')

  return (
    <>
      <section className="content py-14 md:py-20">
        <p className="t-meta text-muted">
          {project.clientName} · desde {formatFullDate(project.startedOn)}
        </p>
        <h1 className="t-display text-foreground mt-5 max-w-[12ch]">{project.name}</h1>
      </section>

      <section aria-labelledby="escopo" className="border-rule bg-surface-soft/50 border-y">
        <div className="content grid gap-12 py-14 md:grid-cols-[0.9fr_1.1fr] md:py-20">
          <div>
            <h2 id="escopo" className="t-meta text-muted">
              O que combinamos
            </h2>
            <ul className="mt-6 space-y-4">
              {project.scope.map((line) => (
                <li key={line} className="t-body text-foreground flex gap-4">
                  <span aria-hidden="true" className="bg-accent mt-2.5 h-px w-5 shrink-0" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="md:pl-14">
            <h2 className="t-meta text-muted">Quem está no projeto</h2>
            <ul className="divide-rule border-rule mt-6 divide-y border-y">
              {project.team.map((person) => (
                <li key={person.name} className="flex items-baseline justify-between gap-4 py-4">
                  <span className="t-title text-foreground">{person.name}</span>
                  <span className="t-meta text-muted">{person.role}</span>
                </li>
              ))}
            </ul>
            {delivery && (
              <div className="mt-10">
                <h2 className="t-meta text-muted">Próxima entrega</h2>
                <p className="t-title text-foreground mt-3">{delivery.title}</p>
                <p className="t-title text-accent-text" data-numeric>
                  {formatDayMonth(delivery.dueOn)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="jornada-completa" className="content py-16 md:py-24">
        <SectionHeading
          eyebrow={`Ciclo ${project.cycle}`}
          title="A jornada"
          lead="Cada etapa tem começo, fim e uma entrega. Quando o ciclo fecha, produção, publicação e review recomeçam."
        />
        <h2 id="jornada-completa" className="sr-only">
          Etapas do projeto
        </h2>
        <ProjectJourney stages={journey} detailed className="mt-12 md:mt-16" />
      </section>

      {past.length > 0 && (
        <section aria-labelledby="decisoes" className="content border-rule border-t py-16 md:py-20">
          <h2 id="decisoes" className="t-meta text-muted">
            Encontros que já aconteceram
          </h2>
          <ul className="divide-rule border-rule mt-8 divide-y border-y">
            {past.map((meeting) => (
              <li key={meeting.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-5">
                <span className="t-title text-foreground">{meeting.title}</span>
                <span className="t-meta text-muted">{formatFullDate(meeting.startAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
