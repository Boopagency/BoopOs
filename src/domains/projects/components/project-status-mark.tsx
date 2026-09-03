import { PROJECT_STATUS_LABEL, type ProjectStatus } from '@/config/enums'
import { cn } from '@/lib/cn'

/**
 * Status do projeto como ponto + rotulo, no mesmo desenho de
 * `ui/status.tsx` e `clients/components/client-status-mark.tsx`.
 *
 * Terceira lista de tres linhas, e nao uma abstracao sobre as tres: os enums
 * sao vocabularios distintos que so por acaso tem a mesma forma visual, e
 * generalizar acoplaria conteudo, cliente e projeto num tipo comum que nao
 * existe no dominio (a mesma razao escrita em `client-status-mark.tsx`).
 *
 * `draft` merece uma nota: e o unico status que o `client_user` NUNCA ve, em
 * lugar nenhum. Ele aparece so aqui, no admin, e a cor discreta e proposital —
 * um rascunho e trabalho em andamento da Boop, nao um estado do cliente.
 *
 * A cor nunca carrega o significado sozinha: o rotulo em pt-BR esta ao lado.
 */
const TONE: Record<ProjectStatus, string> = {
  draft: 'text-muted',
  active: 'text-success',
  paused: 'text-warning',
  completed: 'text-accent-text',
  archived: 'text-muted',
}

const DOT: Record<ProjectStatus, string> = {
  draft: 'bg-rule-strong',
  active: 'bg-success',
  paused: 'bg-warning',
  completed: 'bg-accent',
  archived: 'bg-muted',
}

export function ProjectStatusMark({
  status,
  className,
}: {
  status: ProjectStatus
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span aria-hidden="true" className={cn('size-1.5 rounded-full', DOT[status])} />
      <span className={cn('t-meta', TONE[status])}>{PROJECT_STATUS_LABEL[status]}</span>
    </span>
  )
}
