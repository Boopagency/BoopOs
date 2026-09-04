import Link from 'next/link'
import { BoopEyes } from '@/components/brand/boop-eyes'
import { CloudLayer } from '@/components/brand/cloud-layer'
import type { AttentionItem } from '@/domains/attention/types'
import { padded } from '@/lib/format'

/*
 * "Precisa da sua atenção" — o bloco mais importante do produto.
 *
 * É aqui que a marca e a função se encontram: o símbolo da Boop é um par de
 * olhos, e este é o único lugar em que eles olham para você. O número é enorme
 * porque a pergunta "tem algo esperando por mim?" precisa ser respondida antes
 * da leitura, à distância de um braço.
 *
 * ## O que mudou na FASE 8
 *
 * A composição não. O que mudou foi de onde vêm os itens: eram uma constante em
 * `src/mocks/hartmann.ts`, com um `href` literal apontando para um projeto que
 * deixou de existir na FASE 6 — o CTA mais importante do produto respondia 404.
 * Agora vêm de `getClientAttention()`, derivados do banco a cada request.
 *
 * ## Hierarquia: o primeiro item domina
 *
 * Um numeral gigante por item viraria uma lista de números, e uma lista de
 * números não responde nada. O primeiro — o de maior prioridade — leva o
 * numeral e o CTA em escala; os demais viram linhas compactas na mesma laje.
 * Na FASE 8 existe uma source, então na prática há no máximo um.
 */

/** Teto do que aparece. O excedente é resumido, não rolável. */
const VISIVEIS = 3

export function AttentionBlock({
  items,
  complete = true,
}: {
  items: readonly AttentionItem[]
  /**
   * Alguma source não pôde ser verificada?
   *
   * Com item na tela, o estado continua sendo `attention` — mostrar o que se
   * sabe é melhor do que esconder por causa do que não se sabe. O que não se
   * pode é afirmar completude, e é isso que a linha discreta abaixo diz.
   */
  complete?: boolean
}) {
  if (items.length === 0) return null

  const [primeiro, ...resto] = items
  const visiveis = resto.slice(0, VISIVEIS - 1)
  const excedente = resto.length - visiveis.length

  return (
    <section aria-labelledby="atencao" className="on-inverse bg-navy relative overflow-hidden">
      <CloudLayer density="single" className="opacity-25 mix-blend-screen" />

      <div className="content relative py-14 md:py-20">
        <h2 id="atencao" className="t-meta text-sky">
          Precisa da sua atenção
        </h2>

        <div className="mt-8 md:flex md:items-end md:justify-between md:gap-10">
          <div className="flex items-start gap-5 md:gap-7">
            <BoopEyes gaze="down" blink className="w-14 shrink-0 md:w-20" />
            <p>
              {/*
                O numeral é gráfico: quem usa leitor de tela recebe a frase, que
                é a informação. "01" sozinho não diz nada.
              */}
              <span className="t-numeral text-accent block" data-numeric aria-hidden="true">
                {padded(primeiro!.count)}
              </span>
              <span className="t-lead text-on-inverse mt-3 block max-w-[19ch]">
                {primeiro!.title}
              </span>
              {primeiro!.description && (
                <span className="t-body text-muted-on-inverse mt-3 block max-w-[34ch]">
                  {primeiro!.description}
                </span>
              )}
            </p>
          </div>

          <Link
            href={primeiro!.cta.href}
            className="t-meta bg-accent text-accent-foreground hover:bg-accent-hover mt-8 inline-flex h-14 items-center justify-center rounded-sm px-8 transition-colors duration-[--motion-fast] max-md:w-full md:mt-0"
          >
            {primeiro!.cta.label}
          </Link>
        </div>

        {visiveis.length > 0 && (
          <ul className="divide-rule-inverse border-rule-inverse mt-10 divide-y border-t">
            {visiveis.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.cta.href}
                  className="text-on-inverse hover:text-sky flex min-h-14 items-center justify-between gap-6 py-4 transition-colors"
                >
                  <span className="t-body">{item.title}</span>
                  <span aria-hidden="true" className="text-sky">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {excedente > 0 && <p className="t-meta text-muted-on-inverse mt-6">e mais {excedente}</p>}

        {!complete && (
          <p className="t-meta text-muted-on-inverse mt-8 max-w-[46ch]">
            Pode haver outras pendências que não conseguimos verificar agora.
          </p>
        )}
      </div>
    </section>
  )
}
