import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

export interface CalloutProps {
  tone?: Tone
  title?: string
  children: ReactNode
  className?: string
}

const TONE: Record<Tone, string> = {
  neutral: 'border-border text-foreground',
  success: 'border-success text-foreground',
  warning: 'border-warning text-foreground',
  danger: 'border-danger text-foreground',
}

/**
 * Mensagem de feedback. `danger` e anunciada como alerta; as demais como
 * regiao educada, para nao interromper leitor de tela sem necessidade.
 */
export function Callout({ tone = 'neutral', title, children, className }: CalloutProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'bg-surface rounded-[--radius] border-l-2 px-4 py-3 text-sm',
        TONE[tone],
        className,
      )}
    >
      {title && <p className="font-medium">{title}</p>}
      <div className={cn(title && 'mt-1', 'text-muted')}>{children}</div>
    </div>
  )
}
