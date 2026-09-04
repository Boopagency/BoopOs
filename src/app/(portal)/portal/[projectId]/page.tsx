import type { Metadata } from 'next'
import Link from 'next/link'
import { DashboardHero } from '@/components/patterns/dashboard-hero'
import { ProjectJourney } from '@/components/patterns/project-journey'
import { SectionHeading } from '@/components/patterns/section-heading'
import { portalHref } from '@/config/app'
import { getCurrentStage, getJourney, getProject } from '@/lib/data/portal'

export const metadata: Metadata = { title: 'Início' }

/*
 * Dashboard.
 *
 * ## O que saiu daqui, e por quê
 *
 * Até esta fase a Home compunha SETE leituras. Três vinham do banco — projeto,
 * jornada e etapa corrente. As outras quatro vinham de `src/mocks/hartmann.ts`:
 * "precisa da sua atenção", "próxima entrega", "próximo encontro" e o
 * aprendizado. Elas foram removidas.
 *
 * Não foi decisão de composição: foi correção de defeito. Um cliente real, no
 * ambiente hospedado, lia uma data de entrega que ninguém combinou e um review
 * mensal que ninguém agendou, com a mesma tipografia do dado verdadeiro. E o
 * CTA da laje de atenção apontava para `/portal/hartmann-social/conteudo` — um
 * id que não existe desde a FASE 6 —, então o gesto central do produto levava a
 * um 404.
 *
 * Nenhuma das quatro tem origem no schema hoje: `meetings` e as tabelas de
 * métrica não existem (FASES 13 e 14), e a "próxima entrega" nunca teve coluna
 * em lugar nenhum — é irmã do `project.scope` que a FASE 6 cortou (D-16).
 *
 * O bloco de atenção volta nesta mesma fase, derivado do banco.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  const [project, journey, currentStage] = await Promise.all([
    getProject(projectId),
    getJourney(projectId),
    getCurrentStage(projectId),
  ])

  return (
    <>
      <DashboardHero project={project} currentStage={currentStage} />

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
    </>
  )
}
