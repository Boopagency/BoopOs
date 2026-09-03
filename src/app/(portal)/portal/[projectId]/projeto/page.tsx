import type { Metadata } from 'next'
import { ProjectJourney } from '@/components/patterns/project-journey'
import { SectionHeading } from '@/components/patterns/section-heading'
import { listClientTeam, requireVisiblePortalProject } from '@/domains/projects/queries'
import { getJourney, getMeetings, getNextDelivery, getProject } from '@/lib/data/portal'
import { formatDayMonth, formatFullDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Projeto' }

/*
 * A pagina do projeto responde "onde estamos e o que vem".
 * Nao e gestao interna: nao ha tarefa, responsavel, prazo interno nem esforco.
 *
 * ## O bloco "O que combinamos" saiu (D-16)
 *
 * Ele listava `project.scope`, que era um array de quatro frases no mock e
 * **nao tem coluna no banco** — nem entrou, nem esta entre as tabelas adiadas
 * de `docs/data-model.md`. Com dado real havia tres saidas: inventar colunas
 * para um acordo comercial que ninguem especificou, manter o mock ao lado de
 * dado verdadeiro na mesma tela, ou tirar o bloco. A terceira e a unica que
 * nao mente. Bloco sem origem desaparece (.claude/rules/frontend.md).
 *
 * ## "Quem esta no projeto" ficou, e agora e real
 *
 * Vem de `client_memberships` cruzado com `profiles`: as pessoas da Boop com
 * VINCULO EXPLICITO neste cliente. Um `boop_admin` alcanca todos os clientes
 * por D-08 e isso nao o coloca na equipe de nenhum — acesso nao e alocacao.
 *
 * Sem cargo. A V0 nao guarda cargo, e transformar `boop_member` em
 * "Estrategista" seria escrever ficcao na tela do cliente. Sem ninguem
 * vinculado, o bloco some.
 */
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const scoped = await requireVisiblePortalProject(projectId)

  const [project, journey, delivery, meetings, team] = await Promise.all([
    getProject(projectId),
    getJourney(projectId),
    getNextDelivery(projectId),
    getMeetings(projectId),
    listClientTeam(scoped.clientId),
  ])

  const past = meetings.filter((m) => m.status === 'completed')

  return (
    <>
      <section className="content py-14 md:py-20">
        <p className="t-meta text-muted">
          {project.clientName}
          {/* `starts_on` e nullable: sem data combinada, a linha simplesmente
              nao a menciona — nunca "desde hoje" inventado. */}
          {project.startedOn && ` · desde ${formatFullDate(project.startedOn)}`}
        </p>
        <h1 className="t-display text-foreground mt-5 max-w-[12ch]">{project.name}</h1>
      </section>

      {(team.length > 0 || delivery) && (
        <section aria-labelledby="equipe" className="border-rule bg-surface-soft/50 border-y">
          <div className="content grid gap-12 py-14 md:grid-cols-2 md:py-20">
            {team.length > 0 && (
              <div>
                <h2 id="equipe" className="t-meta text-muted">
                  Quem está no projeto
                </h2>
                <ul className="divide-rule border-rule mt-6 divide-y border-y">
                  {team.map((person) => (
                    <li key={person.name} className="t-title text-foreground py-4">
                      {person.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {delivery && (
              <div className={team.length > 0 ? 'md:pl-14' : undefined}>
                <h2 className="t-meta text-muted">Próxima entrega</h2>
                <p className="t-title text-foreground mt-3">{delivery.title}</p>
                <p className="t-title text-accent-text" data-numeric>
                  {formatDayMonth(delivery.dueOn)}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

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
