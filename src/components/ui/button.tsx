import type { ButtonHTMLAttributes } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'solid' | 'outline' | 'quiet' | 'on-inverse'
type Size = 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  /*
   * Azul da marca com texto navy — 8.42:1. É a mesma combinação da logo, e é
   * a única forma acessível de usar #00C2FF como fundo: off-white sobre ele
   * daria 2.03:1 (docs/design-system.md#contraste).
   */
  primary: 'bg-accent text-accent-foreground hover:bg-accent-hover',
  solid: 'bg-navy text-on-inverse hover:bg-navy/90',
  outline: 'border border-rule-strong text-foreground hover:bg-surface-soft',
  quiet:
    'text-foreground underline decoration-rule-strong underline-offset-[6px] hover:decoration-accent',
  'on-inverse': 'bg-cloud text-navy hover:bg-bone',
}

/* 48px é o alvo de toque mínimo confortável; `lg` é para CTA editorial. */
const SIZE: Record<Size, string> = {
  md: 'h-12 px-5',
  lg: 'h-14 px-7',
}

const BASE =
  'inline-flex items-center justify-center gap-2.5 rounded-sm t-meta transition-colors ' +
  'duration-[--motion-fast] ease-[--ease-standard] disabled:pointer-events-none disabled:opacity-40'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        BASE,
        variant !== 'quiet' && SIZE[size],
        variant === 'quiet' && 'h-auto p-0',
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  )
}

export interface ButtonLinkProps {
  href: string
  variant?: Variant
  size?: Size
  className?: string
  children: React.ReactNode
}

/** Mesma forma do Button, mas navega. Um link nunca deve ser um `<button>`. */
export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        BASE,
        variant !== 'quiet' && SIZE[size],
        variant === 'quiet' && 'h-auto p-0',
        VARIANT[variant],
        className,
      )}
    >
      {children}
    </Link>
  )
}
