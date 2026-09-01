import type { Insight } from '@/lib/data/types'
import { cn } from '@/lib/cn'

/*
 * O aprendizado tem mais peso visual que qualquer grafico.
 *
 * E o diferencial declarado da Boop: nao e so execucao, e leitura continua.
 * Por isso o insight vem em escala de titulo, nao em corpo de texto dentro
 * de um card (§ docs/design-direction.md).
 */
export function InsightBlock({
  insight,
  className,
  tone = 'light',
}: {
  insight: Insight
  className?: string
  tone?: 'light' | 'soft'
}) {
  const soft = tone === 'soft'
  return (
    <figure className={cn('border-accent border-l-2 pl-6 md:pl-8', className)}>
      <blockquote>
        <p className={cn('t-section max-w-[18ch]', soft ? 'text-navy' : 'text-foreground')}>
          {insight.headline}
        </p>
      </blockquote>
      {/*
        Sobre a laje slate (#7488A3) o texto secundario precisa ser navy:
        #4E6076 daria menos de 2:1. Navy sobre slate da 4.80:1.
      */}
      <figcaption className="mt-5">
        <p className={cn('t-body max-w-[46ch]', soft ? 'text-navy/85' : 'text-muted')}>
          {insight.detail}
        </p>
        {insight.evidence && (
          <p className={cn('t-meta mt-4', soft ? 'text-navy/60' : 'text-muted/70')}>
            {insight.evidence}
          </p>
        )}
      </figcaption>
    </figure>
  )
}
