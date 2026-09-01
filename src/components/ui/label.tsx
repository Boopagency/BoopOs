import type { LabelHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Marca visual e semantica de campo obrigatorio. */
  required?: boolean
}

export function Label({ required = false, className, children, ...props }: LabelProps) {
  return (
    <label className={cn('text-foreground block text-sm font-medium', className)} {...props}>
      {children}
      {required && (
        <span className="text-danger ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </label>
  )
}
