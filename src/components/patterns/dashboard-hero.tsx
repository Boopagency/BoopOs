import { CloudLayer } from '@/components/brand/cloud-layer'
import type { JourneyStage, ProjectSummary } from '@/lib/data/types'
import { greeting } from '@/lib/format'

/*
 * Abertura do dashboard.
 *
 * A pergunta que ela responde é a primeira das dez: "o que está acontecendo
 * agora?". A resposta vem em escala de manchete, não em label de card.
 *
 * A composição é a da apresentação da Boop: laje de cor cheia, tipografia em
 * caixa alta ocupando a largura, nuvens ao fundo como atmosfera, e uma linha
 * de metadados minúscula fazendo contraponto. Alinhada à esquerda — a
 * referência externa centraliza tudo, e centralizar é o que faz uma tela
 * parecer landing page genérica.
 */
export function DashboardHero({
  project,
  currentStage,
}: {
  project: ProjectSummary
  currentStage?: JourneyStage | undefined
}) {
  return (
    <section className="on-emphasis bg-surface-emphasis relative isolate overflow-hidden">
      <CloudLayer density="horizon" className="opacity-45" />

      <div className="content relative py-16 md:py-28">
        <p className="t-meta fade rise-1 text-navy/70">
          {project.clientName} · {project.name} · Ciclo {project.cycle}
        </p>

        <h1 className="t-display rise rise-2 text-cloud mt-6 max-w-[14ch]">
          {greeting()}, {project.clientName}.
        </h1>

        {currentStage && (
          <p className="t-lead rise rise-3 text-navy mt-8 max-w-[34ch]">{currentStage.summary}</p>
        )}
      </div>
    </section>
  )
}
