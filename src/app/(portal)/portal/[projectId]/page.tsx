import type { Metadata } from 'next'
import Link from 'next/link'
import { AttentionBlock } from '@/components/patterns/attention-block'
import { DashboardHero } from '@/components/patterns/dashboard-hero'
import { InsightBlock } from '@/components/patterns/insight-block'
import { ProjectJourney } from '@/components/patterns/project-journey'
import { SectionHeading } from '@/components/patterns/section-heading'
import { portalHref } from '@/config/app'
import {
  getAttention,
  getCurrentStage,
  getDashboardInsight,
  getJourney,
  getNextDelivery,
  getNextMeeting,
  getProject,
} from '@/lib/data/portal'
import { formatDateTime, formatDayMonth, formatWeekdayCapitalized } from '@/lib/format'

export const metadata: Metadata = { title: 'Início' }

/*
 * Dashboard.
 *
 * A ordem dos blocos é a ordem das perguntas do cliente (docs/product.md):
 * o que está acontecendo → o que depende de mim → em que etapa estamos →
 * qual é a próxima entrega e o próximo encontro → o que aprendemos.
 *
 * Nenhum gráfico. Nenhum card decorativo. Bloco sem conteúdo desaparece.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  const [project, journey, currentStage, attention, delivery, meeting, insight] = await Promise.all(
    [
      getProject(projectId),
      getJourney(projectId),
      getCurrentStage(projectId),
      getAttention(projectId),
      getNextDelivery(projectId),
      getNextMeeting(projectId),
      getDashboardInsight(projectId),
    ],
  )

  return (
    <>
      <DashboardHero project={project} currentStage={currentStage} />

      <AttentionBlock items={attention} />

      <section aria-labelledby="jornada" className="content py-16 md:py-24">
        <SectionHeading
          eyebrow={`Ciclo ${project.cycle}`}
          title="Onde estamos"
          action={
            <Link
              href={portalHref(projectId, 'projeto')}
              className="t-meta text-muted decoration-rule-strong hover:text-foreground hover:decoration-accent underline underline-offset-[6px]"
            >
              Ver o projeto
            </Link>
          }
        />
        <h2 id="jornada" className="sr-only">
          Jornada do projeto
        </h2>
        <ProjectJourney stages={journey} className="mt-12 md:mt-16" />
      </section>

      {(delivery ?? meeting) && (
        <section aria-labelledby="proximos" className="border-rule bg-surface-soft/50 border-y">
          <h2 id="proximos" className="sr-only">
            Próximos passos
          </h2>
          <div className="content grid gap-px py-14 md:grid-cols-2 md:py-20">
            {delivery && (
              <div className="md:pr-14">
                <p className="t-meta text-muted">Próxima entrega</p>
                <p className="t-section text-foreground mt-4 max-w-[16ch]">{delivery.title}</p>
                <p className="t-body measure text-muted mt-4">{delivery.description}</p>
                <p className="t-title text-accent-text mt-6" data-numeric>
                  {formatDayMonth(delivery.dueOn)}
                </p>
              </div>
            )}

            {meeting && (
              <div className="border-rule mt-12 border-t pt-12 md:mt-0 md:border-t-0 md:border-l md:pt-0 md:pl-14">
                <p className="t-meta text-muted">Próximo encontro</p>
                <p className="t-section text-foreground mt-4 max-w-[16ch]">{meeting.title}</p>
                <p className="t-body text-muted mt-4">
                  {formatWeekdayCapitalized(meeting.startAt)}
                </p>
                <p className="t-title text-foreground mt-1" data-numeric>
                  {formatDateTime(meeting.startAt)}
                </p>
                <Link
                  href={portalHref(projectId, 'encontros')}
                  className="t-meta text-muted decoration-rule-strong hover:text-foreground hover:decoration-accent mt-6 inline-block underline underline-offset-[6px]"
                >
                  Todos os encontros
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {insight && (
        <section aria-labelledby="aprendizado" className="content py-16 md:py-24">
          <p className="t-meta text-muted" id="aprendizado">
            O que estamos aprendendo
          </p>
          <InsightBlock insight={insight} className="mt-8 md:mt-10" />
          <Link
            href={portalHref(projectId, 'resultados')}
            className="t-meta text-muted decoration-rule-strong hover:text-foreground hover:decoration-accent mt-10 inline-block underline underline-offset-[6px]"
          >
            Ver os resultados
          </Link>
        </section>
      )}
    </>
  )
}
