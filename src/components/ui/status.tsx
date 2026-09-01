import { CONTENT_STATUS_LABEL, type ContentStatus } from '@/config/enums'
import { cn } from '@/lib/cn'

/*
 * Status como marcador tipografico, nao como pill colorida.
 *
 * "Pills em tudo" e um dos padroes que a direcao proibe explicitamente. Aqui
 * o status e um ponto + rotulo em caixa alta: menos ruido, mesma informacao,
 * e a cor nunca e o unico portador do significado (o texto tambem diz).
 */
const TONE: Record<ContentStatus, string> = {
  idea: 'text-muted',
  planned: 'text-muted',
  in_production: 'text-muted',
  internal_review: 'text-muted',
  awaiting_client: 'text-accent-text',
  changes_requested: 'text-warning',
  approved: 'text-success',
  scheduled: 'text-muted',
  published: 'text-muted',
  archived: 'text-muted',
}

const DOT: Record<ContentStatus, string> = {
  idea: 'bg-muted',
  planned: 'bg-muted',
  in_production: 'bg-muted',
  internal_review: 'bg-muted',
  awaiting_client: 'bg-accent',
  changes_requested: 'bg-warning',
  approved: 'bg-success',
  scheduled: 'bg-muted',
  published: 'bg-muted',
  archived: 'bg-muted',
}

export function StatusMark({
  status,
  className,
  inverse = false,
}: {
  status: ContentStatus
  className?: string
  inverse?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        aria-hidden="true"
        className={cn('size-1.5 rounded-full', inverse ? 'bg-cloud' : DOT[status])}
      />
      <span className={cn('t-meta', inverse ? 'text-on-inverse' : TONE[status])}>
        {CONTENT_STATUS_LABEL[status]}
      </span>
    </span>
  )
}
