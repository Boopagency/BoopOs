import type { Metadata } from 'next'
import { ContentRow } from '@/components/patterns/content-row'
import { EmptyState } from '@/components/patterns/empty-state'
import { SectionHeading } from '@/components/patterns/section-heading'
import { getContentList } from '@/lib/data/portal'
import { padded } from '@/lib/format'

export const metadata: Metadata = { title: 'Conteúdo' }

/*
 * Feed editorial, nao quadro kanban e nao planilha.
 *
 * A unica separacao que existe e a que importa para o cliente: o que espera
 * por ele vem primeiro, o resto vem depois em ordem. Sem colunas, sem
 * arrastar, sem filtro que ninguem pediu.
 */
export default async function ContentPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const all = await getContentList(projectId)

  const awaiting = all.filter((item) => item.status === 'awaiting_client')
  const rest = all.filter((item) => item.status !== 'awaiting_client')

  if (all.length === 0) {
    return (
      <div className="content">
        <EmptyState title="O primeiro ciclo ainda está em produção.">
          Assim que houver conteúdo pronto para você ver, ele aparece aqui — e avisamos por e-mail.
        </EmptyState>
      </div>
    )
  }

  return (
    <section className="content py-14 md:py-20">
      <SectionHeading
        as="h1"
        eyebrow="Conteúdo"
        title={awaiting.length > 0 ? 'Comece por aqui' : 'Tudo em dia'}
        lead={
          awaiting.length > 0
            ? 'Estas peças estão esperando a sua leitura. As outras ficam logo abaixo.'
            : 'Nada esperando por você no momento. Abaixo, tudo que já passou por aqui.'
        }
      />

      {awaiting.length > 0 && (
        <section aria-labelledby="aguardando" className="mt-14">
          <h2 id="aguardando" className="t-meta text-accent-text flex items-baseline gap-3">
            <span data-numeric>{padded(awaiting.length)}</span>
            aguardando você
          </h2>
          <ul className="border-rule mt-4 border-t">
            {awaiting.map((item) => (
              <ContentRow key={item.id} projectId={projectId} item={item} showStatus={false} />
            ))}
          </ul>
        </section>
      )}

      {rest.length > 0 && (
        <section aria-labelledby="restante" className="mt-16">
          <h2 id="restante" className="t-meta text-muted">
            No ciclo
          </h2>
          <ul className="border-rule mt-4 border-t">
            {rest.map((item) => (
              <ContentRow key={item.id} projectId={projectId} item={item} />
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
