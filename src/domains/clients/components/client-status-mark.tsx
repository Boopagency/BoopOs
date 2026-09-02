import { CLIENT_STATUS_LABEL, type ClientStatus } from '@/config/enums'
import { cn } from '@/lib/cn'

/**
 * Status do cliente como ponto + rotulo, no mesmo desenho de `ui/status.tsx`.
 *
 * Nao reaproveita `StatusMark` porque aquele e tipado em `ContentStatus`, e
 * abrir o tipo dele para servir os dois enums acoplaria conteudo a cliente sem
 * necessidade — sao dois vocabularios que so por acaso tem a mesma forma
 * visual. Duas listas de tres linhas custam menos do que uma abstracao.
 *
 * A cor nunca carrega o significado sozinha: o rotulo em pt-BR esta sempre ao
 * lado (.claude/rules/frontend.md).
 */
const TONE: Record<ClientStatus, string> = {
  active: 'text-success',
  paused: 'text-warning',
  archived: 'text-muted',
}

const DOT: Record<ClientStatus, string> = {
  active: 'bg-success',
  paused: 'bg-warning',
  archived: 'bg-muted',
}

export function ClientStatusMark({
  status,
  className,
}: {
  status: ClientStatus
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT[status])} />
      <span className={cn('t-meta', TONE[status])}>{CLIENT_STATUS_LABEL[status]}</span>
    </span>
  )
}
