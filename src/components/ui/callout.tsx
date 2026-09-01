import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

const TONE: Record<Tone, string> = {
  neutral: 'border-l-rule-strong',
  success: 'border-l-success',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
}

export interface CalloutProps {
  tone?: Tone
  title?: string
  children: ReactNode
  className?: string
}

/**
 * Mensagem de feedback. Barra a esquerda em vez de caixa inteira: menos
 * ruido, e nao vira "mais um card".
 *
 * `danger` e anunciada como alerta; as demais como regiao educada, para nao
 * interromper leitor de tela sem necessidade.
 */
export function Callout({ tone = 'neutral', title, children, className }: CalloutProps) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('bg-surface-soft/60 border-l-2 px-5 py-4', TONE[tone], className)}
    >
      {title && <p className="t-label text-foreground font-semibold">{title}</p>}
      <div className={cn('t-body text-muted', title && 'mt-1')}>{children}</div>
    </div>
  )
}
