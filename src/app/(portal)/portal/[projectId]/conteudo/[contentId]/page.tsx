import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ApprovalPanel } from '@/components/patterns/approval-panel'
import { ContentPreview } from '@/components/patterns/content-preview'
import { StatusMark } from '@/components/ui/status'
import { CONTENT_CHANNEL_LABEL } from '@/config/enums'
import { portalHref } from '@/config/app'
import { getContentItem } from '@/lib/data/portal'
import { formatDayMonth, formatFullDate } from '@/lib/format'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string; contentId: string }>
}): Promise<Metadata> {
  const { projectId, contentId } = await params
  const item = await getContentItem(projectId, contentId)
  return { title: item?.title ?? 'Conteúdo' }
}

/*
 * Detalhe da peca — media first.
 *
 * O preview ocupa a coluna inteira no celular e quase metade da tela no
 * desktop. Nunca uma miniatura dentro de um card: e a peca que o cliente
 * precisa julgar (§ docs/design-direction.md).
 */
export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; contentId: string }>
}) {
  const { projectId, contentId } = await params
  const item = await getContentItem(projectId, contentId)
  if (!item) notFound()

  const meta = [
    { label: 'Objetivo', value: item.objective },
    { label: 'Território', value: item.territory },
    { label: 'Canal', value: CONTENT_CHANNEL_LABEL[item.channel] },
    ...(item.scheduledFor
      ? [{ label: 'Data prevista', value: formatDayMonth(item.scheduledFor) }]
      : []),
    { label: 'Versão', value: String(item.currentVersion.version) },
  ]

  return (
    <article className="content py-8 md:py-14">
      <Link
        href={portalHref(projectId, 'conteudo')}
        className="t-meta text-muted hover:text-foreground inline-flex items-center gap-2 transition-colors"
      >
        <span aria-hidden="true">←</span> Conteúdo
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-16">
        {/* Midia */}
        {/*
          Em coluna unica o 9:16 ocuparia a largura toda e passaria de 1600px
          de altura. O teto de 26rem mantem a peca com protagonismo sem virar
          um poster de tela cheia; no desktop a coluna do grid ja limita.
        */}
        <div className="lg:sticky lg:top-36 lg:self-start">
          <ContentPreview item={item} size="lg" className="max-w-[26rem] lg:max-w-none" />
        </div>

        {/* Conteudo */}
        <div className="min-w-0">
          {/*
            Quando a peca aguarda o cliente, quem diz isso e o painel de
            decisao, com muito mais clareza. Repetir aqui duplicava a
            informacao — e, depois de aprovar, passava a contradize-la.
          */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {item.status !== 'awaiting_client' && <StatusMark status={item.status} />}
            <span className="t-meta text-muted/70">{item.reference}</span>
          </div>

          <h1 className="t-section text-foreground mt-5">{item.title}</h1>

          <dl className="border-rule mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-y py-7">
            {meta.map((entry) => (
              <div key={entry.label}>
                <dt className="t-meta text-muted">{entry.label}</dt>
                <dd className="t-label text-foreground mt-1.5">{entry.value}</dd>
              </div>
            ))}
          </dl>

          <section aria-labelledby="gancho" className="mt-10">
            <h2 id="gancho" className="t-meta text-muted">
              Gancho
            </h2>
            <p className="t-lead text-foreground mt-3">{item.currentVersion.hook}</p>
          </section>

          <section aria-labelledby="legenda" className="mt-9">
            <h2 id="legenda" className="t-meta text-muted">
              Legenda
            </h2>
            <div className="mt-3 space-y-4">
              {item.currentVersion.caption.split('\n\n').map((paragraph, i) => (
                <p key={i} className="t-body measure text-foreground">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>

          {item.currentVersion.cta && (
            <section aria-labelledby="cta" className="mt-9">
              <h2 id="cta" className="t-meta text-muted">
                Chamada
              </h2>
              <p className="t-body text-foreground mt-3">{item.currentVersion.cta}</p>
            </section>
          )}

          <ApprovalPanel item={item} className="mt-14" />

          {item.comments.length > 0 && (
            <section aria-labelledby="conversa" className="mt-14">
              <h2 id="conversa" className="t-meta text-muted">
                Conversa
              </h2>
              <ul className="border-rule mt-5 space-y-6 border-t pt-6">
                {item.comments.map((comment) => (
                  <li key={comment.id}>
                    <p className="t-meta text-muted">
                      {comment.author} · {formatFullDate(comment.createdOn)}
                    </p>
                    <p className="t-body measure text-foreground mt-2">{comment.body}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </article>
  )
}
