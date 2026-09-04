import type { Metadata } from 'next'
import Link from 'next/link'
import { AttentionState } from '@/components/patterns/attention-state'
import { CurrentStage } from '@/components/patterns/current-stage'
import { PortalGreeting } from '@/components/patterns/portal-greeting'
import { ProjectJourney } from '@/components/patterns/project-journey'
import { portalHref } from '@/config/app'
import { requireActor } from '@/lib/auth/actor'
import { getClientAttention } from '@/domains/attention/queries'
import { getClientPublic } from '@/domains/clients/queries'
import { currentStage, journeyGlance, journeyState } from '@/domains/projects/journey'
import { getPortalJourney, requireVisiblePortalProject } from '@/domains/projects/queries'

export const metadata: Metadata = { title: 'Início' }

/*
 * A Home do cliente.
 *
 * Ela responde UMA frase, nesta ordem:
 *
 *     quem é você aqui → algo depende de você? → onde estamos → qual é a jornada
 *
 * Quatro blocos, e todos com origem no banco. Nada de próxima entrega, próximo
 * encontro, aprendizado, produção ou atividade: nenhum desses tem origem hoje —
 * três deles nem tabela têm — e bloco sem origem não vira estado vazio bonito,
 * desaparece. É a mesma decisão que a FASE 6 tomou com "o que combinamos" (D-16).
 *
 * ## A ordem não é estética
 *
 * O estado de atenção vem ANTES de tudo que não seja a saudação porque a
 * pergunta "preciso fazer alguma coisa?" é a razão de o cliente ter aberto o
 * portal. Em 375 × 667 ela precisa estar respondida sem rolagem — com o CTA
 * inteiro, ou com a frase de calma, ou com a de degradação.
 *
 * ## Quem diz o `summary` da etapa
 *
 * No estado de calma, o bloco de atenção já carrega a frase oficial da etapa
 * corrente — é o "o que a Boop está fazendo" logo na dobra. Nesse caso o bloco
 * "Agora" não a repete: a mesma frase duas vezes na mesma tela é ruído. A
 * decisão de composição mora aqui, e não dentro dos componentes.
 */
export default async function DashboardPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  /*
   * `requireVisiblePortalProject` roda de novo aqui, e o layout já o chamou: as
   * duas chamadas compartilham o mesmo resultado no request (`cache()` do
   * React). O custo é zero e o ganho é que esta página continua segura se
   * alguém a montar em outro lugar.
   */
  const [actor, project, stages, attention] = await Promise.all([
    requireActor(),
    requireVisiblePortalProject(projectId),
    getPortalJourney(projectId),
    getClientAttention(projectId),
  ])

  const client = await getClientPublic(project.clientId)

  const stage = currentStage(stages)
  const state = journeyState(stages)
  const glance = journeyGlance(stages)
  const summary = stage?.summary ?? null

  return (
    <>
      <PortalGreeting
        fullName={actor.fullName}
        clientName={client.name}
        projectName={project.name}
      />

      <AttentionState result={attention} status={project.status} stageSummary={summary} />

      <CurrentStage
        cycle={project.cycle}
        stage={stage}
        state={state}
        summary={attention.state === 'calm' ? null : summary}
      />

      {glance.length > 0 && (
        <section aria-labelledby="jornada" className="content border-rule border-t py-12 md:py-16">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <h2 id="jornada" className="t-meta text-muted">
              A jornada
            </h2>
            <Link
              href={portalHref(projectId, 'projeto')}
              className="t-meta text-muted decoration-rule-strong hover:text-foreground hover:decoration-accent flex min-h-11 items-center underline underline-offset-[6px]"
            >
              Ver a jornada completa →
            </Link>
          </div>

          <ProjectJourney stages={glance} variant="glance" className="mt-10 md:mt-12" />
        </section>
      )}
    </>
  )
}
