import { BoopEyes } from '@/components/brand/boop-eyes'
import { cn } from '@/lib/cn'

export interface SpinnerProps {
  className?: string
  label?: string
}

/**
 * Espera com identidade: os olhos da marca piscando devagar.
 *
 * Nao existe atraso artificial em lugar nenhum do produto — este componente
 * so aparece enquanto o dado realmente nao chegou (docs/motion.md).
 */
export function Spinner({ className, label = 'Carregando' }: SpinnerProps) {
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex items-center', className)}>
      <BoopEyes blink className="w-10" />
      <span className="sr-only">{label}</span>
    </span>
  )
}
