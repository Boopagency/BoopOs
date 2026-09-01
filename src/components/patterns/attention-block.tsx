import Link from 'next/link'
import { BoopEyes } from '@/components/brand/boop-eyes'
import { CloudLayer } from '@/components/brand/cloud-layer'
import type { AttentionItem } from '@/lib/data/types'
import { padded } from '@/lib/format'

/*
 * "Precisa da sua atenção" — o bloco mais importante do produto.
 *
 * É aqui que a marca e a função se encontram: o símbolo da Boop é um par de
 * olhos, e este é o único lugar em que eles olham para você. O número é
 * enorme porque a pergunta "tem algo esperando por mim?" precisa ser
 * respondida antes da leitura, à distância de um braço.
 *
 * Se não há nada esperando, o bloco NÃO aparece — não vira card de "nenhum
 * item pendente" (CLAUDE.md). Quem decide é `getAttention()`, que já filtra.
 */
export function AttentionBlock({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null

  return (
    <section aria-labelledby="atencao" className="on-inverse bg-navy relative overflow-hidden">
      <CloudLayer density="single" className="opacity-25 mix-blend-screen" />

      <div className="content relative py-14 md:py-20">
        <h2 id="atencao" className="t-meta text-sky">
          Precisa da sua atenção
        </h2>

        <ul className="mt-8 space-y-12">
          {items.map((item) => (
            <li key={item.id} className="md:flex md:items-end md:justify-between md:gap-10">
              <div className="flex items-start gap-5 md:gap-7">
                <BoopEyes gaze="down" blink className="w-14 shrink-0 md:w-20" />
                <p>
                  <span className="t-numeral text-accent block" data-numeric>
                    {padded(item.count)}
                  </span>
                  <span className="t-lead text-on-inverse mt-3 block max-w-[15ch]">
                    {item.label}
                  </span>
                </p>
              </div>

              <Link
                href={item.href}
                className="t-meta bg-accent text-accent-foreground hover:bg-accent-hover mt-8 inline-flex h-14 items-center justify-center rounded-sm px-8 transition-colors duration-[--motion-fast] max-md:w-full md:mt-0"
              >
                {item.cta}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
