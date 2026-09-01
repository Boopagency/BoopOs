import { cn } from '@/lib/cn'

export interface SpinnerProps {
  className?: string
  /** Texto lido por leitor de tela enquanto carrega. */
  label?: string
}

export function Spinner({ className, label = 'Carregando' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex items-center', className)}>
      <span
        aria-hidden="true"
        className="border-border border-t-accent size-4 animate-spin rounded-full border-2"
      />
      <span className="sr-only">{label}</span>
    </span>
  )
}
