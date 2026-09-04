import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BoardCard, BoardColumn, BoardViewport } from '@/components/patterns/board'

/**
 * A geometria do quadro, exercitada com fixture SINTÉTICA.
 *
 * A fixture vive aqui dentro de propósito: ela não é dado de exemplo, não tem
 * arquivo próprio, não é importável, e não existe fora deste teste. As palavras
 * abaixo são deliberadamente sem domínio — "Primeira", "Segunda" — porque um
 * fixture com "Carrossel de setembro" seria a semente do mock que a FASE 8
 * arrancou (ADR-0028).
 */

const COLUNAS = ['Primeira', 'Segunda', 'Terceira'] as const

function quadro(vazias: readonly string[] = []) {
  return render(
    <BoardViewport label="Etapas">
      {COLUNAS.map((nome, i) => (
        <BoardColumn
          key={nome}
          title={nome}
          count={vazias.includes(nome) ? 0 : i + 1}
          emptyLabel="Nada aqui ainda."
        >
          {vazias.includes(nome)
            ? null
            : Array.from({ length: i + 1 }, (_, n) => (
                <BoardCard key={n}>
                  <span>{`${nome} ${n}`}</span>
                </BoardCard>
              ))}
        </BoardColumn>
      ))}
    </BoardViewport>,
  )
}

describe('a faixa horizontal', () => {
  it('é uma região nomeada', () => {
    quadro()

    expect(screen.getByRole('group', { name: 'Etapas' })).toBeInTheDocument()
  })

  it('⚠️ recebe foco — senão o teclado não alcança a terceira coluna', () => {
    quadro()

    expect(screen.getByRole('group', { name: 'Etapas' })).toHaveAttribute('tabindex', '0')
  })

  it('rola no eixo horizontal, e só nele', () => {
    quadro()

    const faixa = screen.getByRole('group', { name: 'Etapas' })

    expect(faixa.className).toContain('overflow-x-auto')
    expect(faixa.className).not.toContain('overflow-y')
  })

  it('prende no celular e solta no desktop', () => {
    quadro()

    const faixa = screen.getByRole('group', { name: 'Etapas' })

    expect(faixa.className).toContain('snap-x')
    expect(faixa.className).toContain('snap-mandatory')
    expect(faixa.className).toContain('md:snap-none')
  })
})

describe('as colunas', () => {
  it('cada uma é uma região com nome e contagem', () => {
    quadro()

    expect(screen.getByRole('region', { name: 'Primeira: 1' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Terceira: 3' })).toBeInTheDocument()
  })

  it('têm largura fixa e não encolhem', () => {
    quadro()

    const coluna = screen.getByRole('region', { name: 'Primeira: 1' })

    expect(coluna.className).toContain('shrink-0')
    expect(coluna.className).toMatch(/w-\[17rem\]/)
  })

  it('o numeral é gráfico: a frase acessível carrega a contagem', () => {
    const { container } = quadro()

    expect(container.querySelector('[data-numeric]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('os cards de uma coluna são uma lista', () => {
    quadro()

    const coluna = screen.getByRole('region', { name: 'Terceira: 3' })

    expect(within(coluna).getAllByRole('listitem')).toHaveLength(3)
  })
})

describe('⚠️ a coluna vazia FICA — ela é eixo, não bloco', () => {
  it('continua na tela, com o zero', () => {
    quadro(['Segunda'])

    expect(screen.getByRole('region', { name: 'Segunda: 0' })).toBeInTheDocument()
  })

  it('diz o que quem chamou mandou dizer', () => {
    quadro(['Segunda'])

    const coluna = screen.getByRole('region', { name: 'Segunda: 0' })

    expect(within(coluna).getByText('Nada aqui ainda.')).toBeInTheDocument()
    expect(within(coluna).queryAllByRole('listitem')).toHaveLength(0)
  })

  it('sem frase, o corpo fica vazio — nunca um card de "nenhum item"', () => {
    render(
      <BoardViewport label="Etapas">
        <BoardColumn title="Primeira" count={0} />
      </BoardViewport>,
    )

    const coluna = screen.getByRole('region', { name: 'Primeira: 0' })

    expect(within(coluna).queryByRole('list')).toBeNull()
  })

  it('o quadro inteiro vazio ainda mostra as colunas', () => {
    quadro([...COLUNAS])

    expect(screen.getAllByRole('region')).toHaveLength(3)
  })
})

describe('a laje', () => {
  it('sem `href` não é clicável', () => {
    render(
      <BoardViewport label="Etapas">
        <BoardColumn title="Primeira" count={1}>
          <BoardCard>estática</BoardCard>
        </BoardColumn>
      </BoardViewport>,
    )

    expect(screen.queryByRole('link')).toBeNull()
  })

  it('com `href` vira link e mantém alvo de toque', () => {
    render(
      <BoardViewport label="Etapas">
        <BoardColumn title="Primeira" count={1}>
          <BoardCard href="/algum/lugar">clicável</BoardCard>
        </BoardColumn>
      </BoardViewport>,
    )

    const link = screen.getByRole('link', { name: 'clicável' })

    expect(link).toHaveAttribute('href', '/algum/lugar')
    expect(link.className).toContain('min-h-11')
  })

  it('⚠️ é laje, não card: sem sombra', () => {
    const { container } = quadro()

    expect(container.innerHTML).not.toMatch(/shadow-/)
  })
})
