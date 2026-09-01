import Image from 'next/image'
import { cn } from '@/lib/cn'

export interface BoopMarkProps {
  /** `primary` para fundo claro, `light` para fundo escuro ou colorido. */
  variant?: 'primary' | 'light'
  className?: string
  priority?: boolean
}

/**
 * Logo oficial da Boop, servida a partir do SVG original e sem alteracao —
 * `reference/brand/README.md` proibe redesenhar ou reinterpretar a marca.
 *
 * O tamanho e sempre do chamador. O componente so fixa a proporcao correta
 * de cada arquivo (365x258 e 343x243) para o Next reservar o espaco e nao
 * causar layout shift.
 */
export function BoopMark({ variant = 'primary', className, priority = false }: BoopMarkProps) {
  const light = variant === 'light'
  const src = light ? '/brand/logo-light.svg' : '/brand/logo-primary.svg'

  return (
    <Image
      src={src}
      alt="Boop"
      width={light ? 343 : 365}
      height={light ? 243 : 258}
      priority={priority}
      /* `self-start` impede que align-items:stretch de um flex-col estique a
         imagem: com w-auto o SVG so se recentralizava dentro da caixa. */
      className={cn('w-auto self-start', className)}
    />
  )
}
