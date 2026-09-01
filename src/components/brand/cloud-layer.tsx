import Image from 'next/image'
import { cn } from '@/lib/cn'

type Density = 'single' | 'pair' | 'horizon'

export interface CloudLayerProps {
  density?: Density
  className?: string
}

/*
 * Nuvens como ATMOSFERA, nunca como adesivo.
 *
 * Regras (reference/brand/README.md e docs/design-direction.md):
 * — so em limiares: login, boas-vindas, abertura de estrategia, aprovacao,
 *   estados vazios e conclusao. Nunca em area operacional densa;
 * — sempre atras do conteudo, com opacidade baixa e `pointer-events-none`;
 * — deriva de 34-52s e amplitude < 2%: percebe-se de canto de olho, nunca
 *   compete com a leitura;
 * — `aria-hidden`: nao carregam informacao.
 *
 * A imagem e o asset oficial (reference/brand/ChatGPT Image…png), servido
 * como /brand/cloud.png. Nao foi redesenhada.
 */
const LAYOUTS: Record<Density, { className: string; width: number; drift: string }[]> = {
  single: [{ className: 'right-[-16%] top-[4%] w-[52%] opacity-25', width: 640, drift: 'drift' }],
  pair: [
    { className: 'left-[-20%] top-[2%] w-[46%] opacity-20', width: 560, drift: 'drift' },
    {
      className: 'right-[-14%] bottom-[-6%] w-[38%] opacity-16',
      width: 460,
      drift: 'drift-slow',
    },
  ],
  horizon: [
    { className: 'left-[-24%] bottom-[-22%] w-[62%] opacity-28', width: 760, drift: 'drift' },
    {
      className: 'right-[-20%] bottom-[-28%] w-[54%] opacity-20',
      width: 660,
      drift: 'drift-slow',
    },
  ],
}

export function CloudLayer({ density = 'pair', className }: CloudLayerProps) {
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0', className)}>
      {LAYOUTS[density].map((cloud, i) => (
        <Image
          key={i}
          src="/brand/cloud.png"
          alt=""
          width={cloud.width}
          height={Math.round(cloud.width * (465 / 764))}
          sizes="(max-width: 768px) 90vw, 60vw"
          className={cn('absolute h-auto select-none', cloud.className, cloud.drift)}
        />
      ))}
    </div>
  )
}
