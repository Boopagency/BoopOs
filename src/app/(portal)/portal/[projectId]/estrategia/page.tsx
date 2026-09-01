import type { Metadata } from 'next'
import { CloudLayer } from '@/components/brand/cloud-layer'
import { StrategyApproval } from '@/components/patterns/strategy-approval'
import { getStrategy } from '@/lib/data/portal'

export const metadata: Metadata = { title: 'Estratégia' }

/*
 * A estrategia precisa parecer uma ENTREGA, nao um registro de banco.
 *
 * A abertura e uma capa: laje navy, tipografia em escala de cartaz, nuvens ao
 * fundo. Os capitulos vem numerados, com o numero como elemento grafico
 * grande a esquerda — o ritmo da apresentacao da Boop traduzido para scroll.
 *
 * Sem scroll hijacking, sem parallax: o scroll e do usuario.
 */
export default async function StrategyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const strategy = await getStrategy(projectId)

  return (
    <>
      <header className="on-inverse bg-navy relative isolate overflow-hidden">
        <CloudLayer density="horizon" className="opacity-25 mix-blend-screen" />
        <div className="content relative py-20 md:py-32">
          <p className="t-meta fade rise-1 text-sky">{strategy.clientName}</p>
          <h1 className="t-display rise rise-2 text-cloud mt-6 max-w-[11ch]">{strategy.title}</h1>
          <p className="t-lead rise rise-3 text-muted-on-inverse mt-8">
            {strategy.period}
            <span aria-hidden="true" className="text-rule-inverse mx-3">
              /
            </span>
            Versão {strategy.version}
          </p>
        </div>
      </header>

      <div className="content py-16 md:py-24">
        <div className="space-y-20 md:space-y-28">
          {strategy.chapters.map((chapter) => (
            <section key={chapter.number} aria-labelledby={`cap-${chapter.number}`}>
              <div className="grid gap-6 md:grid-cols-[6rem_1fr] md:gap-10 lg:grid-cols-[8rem_1fr]">
                <p
                  aria-hidden="true"
                  className="text-accent text-[clamp(2.5rem,2rem+2vw,4rem)] leading-none font-bold tracking-[-0.04em]"
                  data-numeric
                >
                  {chapter.number}
                </p>

                <div className="min-w-0">
                  <h2 id={`cap-${chapter.number}`} className="t-section text-foreground">
                    <span className="sr-only">Capítulo {chapter.number}. </span>
                    {chapter.title}
                  </h2>

                  <p className="t-lead measure text-foreground mt-6">{chapter.lead}</p>

                  {chapter.body.length > 0 && (
                    <div className="mt-6 space-y-4">
                      {chapter.body.map((paragraph, i) => (
                        <p key={i} className="t-body measure text-muted">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  )}

                  {chapter.items && (
                    <ul className="divide-rule border-rule mt-9 divide-y border-y">
                      {chapter.items.map((entry) => (
                        <li key={entry.label} className="py-5 md:flex md:gap-10">
                          <p className="t-title text-foreground shrink-0 md:w-52">{entry.label}</p>
                          <p className="t-body text-muted mt-1.5 max-w-[46ch] md:mt-0">
                            {entry.description}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        <StrategyApproval status={strategy.status} className="mt-24 md:mt-32" />
      </div>
    </>
  )
}
