import Link from 'next/link'
import { ContentPreview } from '@/components/patterns/content-preview'
import { StatusMark } from '@/components/ui/status'
import type { ContentItem } from '@/lib/data/types'
import { formatDayMonthShort } from '@/lib/format'
import { portalHref } from '@/config/app'

/*
 * Linha do feed editorial de conteúdo.
 *
 * Não é card: não tem borda em volta, não tem sombra, não flutua. É uma
 * entrada de sumário — miniatura à esquerda, texto à direita, filete
 * separando de quem vem depois. Doze delas em sequência leem como uma
 * revista, não como um quadro de Trello (docs/design-direction.md).
 */
export function ContentRow({
  projectId,
  item,
  showStatus = true,
}: {
  projectId: string
  item: ContentItem
  /** `false` dentro de um grupo que ja declara o status no titulo. */
  showStatus?: boolean
}) {
  const href = `${portalHref(projectId, 'conteudo')}/${item.id}`

  return (
    <li className="group border-rule border-b">
      <Link
        href={href}
        className="flex items-start gap-5 py-6 transition-colors duration-[--motion-fast] md:gap-8 md:py-8"
      >
        <ContentPreview
          item={item}
          size="sm"
          className="w-24 shrink-0 md:w-32"
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {showStatus && <StatusMark status={item.status} />}
            <span className="t-meta text-muted/70">{item.reference}</span>
          </div>

          <h3 className="t-title text-foreground group-hover:decoration-accent mt-3 group-hover:underline group-hover:underline-offset-[6px]">
            {item.title}
          </h3>

          <p className="t-body text-muted mt-2 line-clamp-2 max-w-[52ch]">
            {item.currentVersion.hook}
          </p>

          <p className="t-meta text-muted/70 mt-4">
            {item.territory}
            {item.scheduledFor && (
              <>
                <span aria-hidden="true" className="mx-2">
                  ·
                </span>
                {formatDayMonthShort(item.scheduledFor)}
              </>
            )}
            {item.versionCount > 1 && (
              <>
                <span aria-hidden="true" className="mx-2">
                  ·
                </span>
                Versão {item.currentVersion.version}
              </>
            )}
          </p>
        </div>

        <span
          aria-hidden="true"
          className="t-title text-muted mt-1 hidden transition-transform duration-[--motion-fast] group-hover:translate-x-1 md:block"
        >
          →
        </span>
      </Link>
    </li>
  )
}
