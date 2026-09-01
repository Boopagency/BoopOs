import type { Metadata } from 'next'
import { EmptyState } from '@/components/patterns/empty-state'
import { InsightBlock } from '@/components/patterns/insight-block'
import { SectionHeading } from '@/components/patterns/section-heading'
import { getResults } from '@/lib/data/portal'

export const metadata: Metadata = { title: 'Resultados' }

/*
 * Resultados como narrativa, nao como painel financeiro.
 *
 * A ordem e fixa e e a mesma do review mensal: o que aconteceu → o que
 * funcionou → o que nao funcionou → o que aprendemos → o que muda.
 *
 * Os numeros aparecem primeiro porque sao a pergunta que o cliente traz. Mas
 * o bloco que recebe mais peso visual e o aprendizado, nao a metrica — e o
 * diferencial declarado da Boop (§ docs/design-direction.md).
 */
export default async function ResultsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const results = await getResults(projectId)

  if (!results) {
    return (
      <div className="content">
        <EmptyState title="Ainda não temos resultados por aqui.">
          Estamos coletando os primeiros sinais. Depois da primeira publicação, esta página começa a
          contar a história.
        </EmptyState>
      </div>
    )
  }

  return (
    <>
      <section className="content py-14 md:py-20">
        <p className="t-meta text-muted">{results.period}</p>
        <h1 className="t-display text-foreground mt-5 max-w-[11ch]">O que aconteceu</h1>
        <p className="t-lead measure text-muted mt-8">{results.whatHappened}</p>
      </section>

      <section aria-labelledby="numeros" className="border-rule bg-surface-soft/50 border-y">
        <h2 id="numeros" className="sr-only">
          Números do período
        </h2>
        <dl className="content grid gap-12 py-14 sm:grid-cols-3 md:py-18">
          {results.metrics.map((metric) => (
            <div key={metric.key}>
              <dd className="t-numeral text-foreground" data-numeric>
                {metric.value}
              </dd>
              <dt className="t-label text-foreground mt-4">{metric.label}</dt>
              {metric.delta && <p className="t-meta text-muted mt-2">{metric.delta}</p>}
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="funcionou" className="content py-16 md:py-24">
        <SectionHeading eyebrow="Leitura do período" title="O que funcionou" />
        <h2 id="funcionou" className="sr-only">
          O que funcionou
        </h2>
        <ul className="divide-rule border-rule mt-10 divide-y border-y">
          {results.whatWorked.map((entry) => (
            <li key={entry.title} className="py-7 md:flex md:gap-12">
              <p className="t-title text-foreground shrink-0 md:w-72">{entry.title}</p>
              <p className="t-body text-muted mt-2 max-w-[50ch] md:mt-0">{entry.detail}</p>
            </li>
          ))}
        </ul>

        {results.whatDidNot.length > 0 && (
          <>
            <h2 className="t-meta text-muted mt-16">O que não funcionou</h2>
            <ul className="divide-rule border-rule mt-6 divide-y border-y">
              {results.whatDidNot.map((entry) => (
                <li key={entry.title} className="py-7 md:flex md:gap-12">
                  <p className="t-title text-foreground shrink-0 md:w-72">{entry.title}</p>
                  <p className="t-body text-muted mt-2 max-w-[50ch] md:mt-0">{entry.detail}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="aprendemos" className="bg-surface-emphasis">
        <div className="content py-16 md:py-24">
          <h2 id="aprendemos" className="t-meta text-navy/70">
            O que aprendemos
          </h2>
          <div className="mt-10 space-y-14">
            {results.learnings.map((insight) => (
              <InsightBlock key={insight.id} insight={insight} tone="soft" />
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="muda" className="content py-16 md:py-24">
        <SectionHeading title="O que muda agora" />
        <h2 id="muda" className="sr-only">
          O que muda agora
        </h2>
        <ul className="mt-10 space-y-5">
          {results.whatChanges.map((line) => (
            <li key={line} className="t-title text-foreground flex gap-5">
              <span aria-hidden="true" className="bg-accent mt-4 h-px w-8 shrink-0 md:w-12" />
              <span className="max-w-[38ch]">{line}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
