import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Abertura de secao: numero/rotulo minusculo em caixa alta + titulo grande.
 *
 * E o ritmo tipografico da apresentacao da Boop — o contraste entre o
 * metadado quase invisivel e o titulo que ocupa a linha inteira e o que faz a
 * composicao parecer editorial em vez de administrativa.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  action,
  className,
  as: Tag = 'h2',
}: {
  eyebrow?: string
  title: string
  lead?: string
  action?: ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3'
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-8 gap-y-4', className)}>
      {/*
        A largura maxima fica em cada elemento, nunca no wrapper: `ch` resolve
        contra o font-size do proprio elemento, e um wrapper em 16px daria
        ~176px para um titulo de 52px. Foi um bug real do QA visual.
      */}
      <div className="min-w-0">
        {eyebrow && <p className="t-meta text-muted">{eyebrow}</p>}
        <Tag className={cn('t-section text-foreground max-w-[16ch]', eyebrow && 'mt-3')}>
          {title}
        </Tag>
        {lead && <p className="t-lead measure text-muted mt-4">{lead}</p>}
      </div>
      {action}
    </div>
  )
}
