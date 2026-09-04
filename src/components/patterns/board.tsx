import { Children, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { padded } from '@/lib/format'

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * QUADRO — geometria, e só geometria
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A FASE 10 vai desenhar Conteúdo como um quadro, não como uma lista. O que
 * nasce aqui é a GEOMETRIA desse quadro; o domínio nasce lá (ADR-0028).
 *
 * ## O que estas primitivas não podem saber
 *
 * Status de conteúdo, canal, formato, aprovação, versão, item, projeto, tenant,
 * Instagram, social media. Nada disso aparece nem como tipo, nem como nome de
 * prop, nem como string — e há teste de código-fonte que falha se aparecer.
 *
 * A razão não é purismo. Os status reais são decisão da FASE 10, e um
 * componente que já os conhecesse teria decidido o domínio pela geometria: a
 * fase seguinte herdaria um enum que ninguém escolheu, escrito por acidente num
 * arquivo de layout.
 *
 * ## O que elas não fazem
 *
 * Não arrastam. O quadro do cliente é somente-leitura — aprovação é RPC
 * validado, e um arrasto não consegue expressar "pedir ajuste". Movimentação
 * operacional pertence ao admin e ao workflow real, na FASE 10, com `@dnd-kit`
 * e por ADR (ADR-0028).
 *
 * ## Onde elas aparecem hoje
 *
 * Em lugar nenhum. Sem rota, sem navegação, sem dado. São exercitadas por teste
 * de componente com fixture sintética que vive dentro do próprio teste — porque
 * dado falso alcançável por um cliente é exatamente o que a FASE 8 apagou.
 */

/**
 * A faixa horizontal.
 *
 * `tabIndex={0}` com `role="group"` não é enfeite: uma região que rola só
 * responde a seta e Page Up/Down quando pode receber foco. Sem isso, quem
 * navega por teclado não alcança a terceira coluna — o padrão vale para
 * qualquer região rolável, e é o mesmo de uma tabela larga.
 *
 * `snap` só no celular. No desktop o ponteiro rola livre, e prender a rolagem a
 * pontos fixos ali só atrapalha; no celular, sem snap, a pessoa termina o gesto
 * sempre entre duas colunas.
 */
export function BoardViewport({
  label,
  className,
  children,
}: {
  /** Nome acessível da região rolável. */
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div
      role="group"
      aria-label={label}
      tabIndex={0}
      className={cn(
        'flex snap-x snap-mandatory items-stretch gap-4 overflow-x-auto pb-4 md:snap-none md:gap-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Uma coluna.
 *
 * ## A coluna vazia FICA
 *
 * E isso não contradiz "bloco vazio desaparece". Um bloco é conteúdo; uma
 * coluna é EIXO. Ler a esteira exige ver que a etapa existe e está zerada —
 * some-la deixaria o quadro dizendo que a etapa não existe, que é outra coisa.
 *
 * A frase do vazio vem por prop: quem chama sabe do que a coluna trata, e este
 * arquivo não pode saber.
 */
export function BoardColumn({
  title,
  count,
  emptyLabel,
  children,
}: {
  title: string
  /** Quantos itens a coluna tem. É gráfico: a lista abaixo é a informação. */
  count: number
  /** O que dizer quando não há nenhum. Sem isso, o corpo fica só com espaço. */
  emptyLabel?: string
  children?: ReactNode
}) {
  const vazia = Children.count(children) === 0

  return (
    <section
      aria-label={`${title}: ${count}`}
      className="border-rule flex w-[17rem] shrink-0 snap-start flex-col border-t pt-4 sm:w-[19rem]"
    >
      <p className="flex items-baseline justify-between gap-3">
        <span className="t-meta text-foreground">{title}</span>
        <span className="t-meta text-muted" data-numeric aria-hidden="true">
          {padded(count)}
        </span>
      </p>

      {vazia ? (
        emptyLabel ? (
          <p className="t-label text-muted mt-4">{emptyLabel}</p>
        ) : null
      ) : (
        <ul className="mt-4 flex flex-col gap-3">{children}</ul>
      )}
    </section>
  )
}

/**
 * Uma laje dentro de uma coluna.
 *
 * Laje, não card: filete e cor, sem sombra e sem borda em volta de tudo — a
 * mesma linguagem do resto do portal. `min-h-11` porque no celular ela é um
 * alvo de toque, e `href` opcional porque uma laje que não leva a lugar nenhum
 * não deveria parecer clicável.
 */
export function BoardCard({
  href,
  className,
  children,
}: {
  href?: string
  className?: string
  children: ReactNode
}) {
  const base = cn(
    'bg-surface-soft/50 border-rule text-foreground block min-h-11 rounded-sm border p-3',
    className,
  )

  return (
    <li>
      {href ? (
        <Link
          href={href}
          className={cn(
            base,
            'hover:border-rule-strong transition-colors duration-[--motion-fast]',
          )}
        >
          {children}
        </Link>
      ) : (
        <div className={base}>{children}</div>
      )}
    </li>
  )
}
