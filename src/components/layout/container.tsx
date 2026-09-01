import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface ContainerProps {
  as?: ElementType
  size?: 'narrow' | 'default'
  className?: string
  children: ReactNode
}

/** Largura de leitura confortavel, com respiro lateral no celular. */
export function Container({
  as: Tag = 'div',
  size = 'default',
  className,
  children,
}: ContainerProps) {
  return (
    <Tag
      className={cn(
        'mx-auto w-full px-5 sm:px-8',
        size === 'narrow' ? 'max-w-2xl' : 'max-w-5xl',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
