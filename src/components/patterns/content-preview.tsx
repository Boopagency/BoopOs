import { CloudLayer } from '@/components/brand/cloud-layer'
import { CONTENT_FORMAT_LABEL } from '@/config/enums'
import type { ContentItem } from '@/lib/data/types'
import { cn } from '@/lib/cn'

/*
 * Preview da peça.
 *
 * Não existe arte real no protótipo, e um retângulo cinza com ícone de imagem
 * quebrada seria a coisa menos Boop possível. Em vez disso o preview compõe
 * a própria peça: o gancho tipografado em escala, sobre a cor do território.
 * É honesto (não finge ser uma foto), é editorial e já mostra o que importa —
 * a frase de abertura.
 *
 * Quando houver mídia real, este componente troca o bloco tipográfico por
 * <Image>/<video> mantendo a mesma proporção. Nada mais muda.
 */

/* Proporção real de cada formato — o preview nunca distorce o enquadramento. */
const ASPECT: Record<string, string> = {
  reel: 'aspect-[9/16]',
  story: 'aspect-[9/16]',
  video: 'aspect-video',
  carousel: 'aspect-[4/5]',
  static: 'aspect-square',
  article: 'aspect-[3/2]',
  other: 'aspect-[4/5]',
}

const TONE: Record<ContentItem['previewTone'], string> = {
  navy: 'bg-navy text-on-inverse',
  slate: 'bg-surface-emphasis text-navy',
  sky: 'bg-sky text-navy',
  bone: 'bg-bone text-navy',
}

export function ContentPreview({
  item,
  className,
  size = 'md',
}: {
  item: ContentItem
  className?: string
  /** `lg` é a página de detalhe, onde a mídia tem protagonismo. */
  size?: 'sm' | 'md' | 'lg'
}) {
  const inverse = item.previewTone === 'navy'

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-sm',
        ASPECT[item.format] ?? ASPECT.other,
        TONE[item.previewTone],
        className,
      )}
    >
      {inverse && <CloudLayer density="single" className="opacity-20 mix-blend-screen" />}

      <div
        className={cn(
          'relative flex h-full flex-col justify-between',
          size === 'lg' ? 'p-7 md:p-10' : size === 'md' ? 'p-5 md:p-6' : 'p-2.5',
        )}
      >
        <p
          className={cn(
            inverse ? 'text-sky' : 'text-navy/60',
            size === 'sm'
              ? 'text-[9px] leading-none font-semibold tracking-[0.14em] uppercase'
              : 't-meta',
          )}
        >
          {CONTENT_FORMAT_LABEL[item.format]}
        </p>

        {/*
          A miniatura tem ~64px uteis de largura: uma frase em corpo de texto
          transbordaria. No tamanho `sm` o gancho entra reduzido e cortado em
          quatro linhas — o suficiente para reconhecer a peca, que e o papel
          da miniatura. Foi um defeito encontrado no QA visual.
        */}
        <p
          className={cn(
            'font-bold tracking-[-0.03em]',
            size === 'lg'
              ? 'text-[clamp(1.5rem,1rem+2.4vw,2.75rem)] leading-[1.02]'
              : size === 'md'
                ? 'text-[clamp(1.05rem,0.9rem+0.9vw,1.5rem)] leading-[1.08]'
                : 'line-clamp-4 text-[11px] leading-[1.2] tracking-[-0.02em]',
          )}
        >
          {item.currentVersion.hook}
        </p>

        {size !== 'sm' && (
          <p className={cn('t-meta', inverse ? 'text-on-inverse/60' : 'text-navy/50')}>
            {item.reference}
          </p>
        )}
      </div>
    </div>
  )
}
