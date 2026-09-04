import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AttentionState } from '@/components/patterns/attention-state'
import type { AttentionItem, AttentionResult } from '@/domains/attention/types'
import { item } from '../support/attention-items'

/**
 * As três formas são conteúdos diferentes, não variações de estilo.
 *
 * O caso que vale por todos está no bloco `degraded`: as frases de calma não
 * podem aparecer em lugar nenhum daquela árvore. É a regra de honestidade da
 * fase virando asserção — se alguém simplificar a decisão do domínio para
 * `items.length === 0 ? calm : attention`, este teste é o que quebra.
 */

function resultado(over: Partial<AttentionResult> = {}): AttentionResult {
  const items: readonly AttentionItem[] = over.items ?? []
  const failed = over.failed ?? 0

  return {
    state: over.state ?? 'calm',
    items,
    complete: over.complete ?? failed === 0,
    evaluated: over.evaluated ?? 1,
    failed,
  }
}

const CALMA = ['Tudo certo por aqui', 'não precisa fazer nada']

describe('attention — há algo esperando', () => {
  const result = resultado({ state: 'attention', items: [item()] })

  it('mostra o título do item e o CTA com href real', () => {
    render(<AttentionState result={result} status="active" stageSummary={null} />)

    expect(screen.getByText('Seu onboarding está esperando você.')).toBeInTheDocument()

    const cta = screen.getByRole('link', { name: 'Continuar' })
    expect(cta).toHaveAttribute('href', expect.stringContaining('/onboarding'))
  })

  it('⚠️ o numeral é gráfico — a frase é o texto acessível', () => {
    const { container } = render(
      <AttentionState result={result} status="active" stageSummary={null} />,
    )

    const numeral = container.querySelector('[data-numeric]')
    expect(numeral).toHaveTextContent('01')
    expect(numeral).toHaveAttribute('aria-hidden', 'true')
  })

  it('a laje é anunciada como seção com nome', () => {
    render(<AttentionState result={result} status="active" stageSummary={null} />)

    expect(screen.getByRole('heading', { name: 'Precisa da sua atenção' })).toBeInTheDocument()
  })

  it('não mostra frase de calma quando há pendência', () => {
    render(<AttentionState result={result} status="active" stageSummary={null} />)

    for (const frase of CALMA) {
      expect(screen.queryByText(new RegExp(frase, 'i'))).not.toBeInTheDocument()
    }
  })

  it('só o primeiro item leva numeral; os demais viram lista', () => {
    const varios = resultado({
      state: 'attention',
      items: [item({ id: 'a', title: 'Primeiro' }), item({ id: 'b', title: 'Segundo' })],
    })

    const { container } = render(
      <AttentionState result={varios} status="active" stageSummary={null} />,
    )

    expect(container.querySelectorAll('[data-numeric]')).toHaveLength(1)
    expect(screen.getByText('Segundo')).toBeInTheDocument()
  })

  it('com verificação incompleta, avisa sem esconder o item verdadeiro', () => {
    const parcial = resultado({
      state: 'attention',
      items: [item()],
      complete: false,
      failed: 1,
      evaluated: 2,
    })

    render(<AttentionState result={parcial} status="active" stageSummary={null} />)

    expect(screen.getByText('Seu onboarding está esperando você.')).toBeInTheDocument()
    expect(screen.getByText(/não conseguimos verificar agora/i)).toBeInTheDocument()
  })
})

describe('calm — nada esperando, e é verdade', () => {
  it('projeto ativo diz que está tudo certo', () => {
    render(<AttentionState result={resultado()} status="active" stageSummary={null} />)

    expect(screen.getByText('Tudo certo por aqui.')).toBeInTheDocument()
    expect(screen.getByText('Você não precisa fazer nada agora.')).toBeInTheDocument()
  })

  it('⚠️ não há CTA nenhum — não existe ação a cobrar', () => {
    render(<AttentionState result={resultado()} status="active" stageSummary={null} />)

    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('acrescenta a frase oficial da etapa corrente quando existe', () => {
    render(
      <AttentionState
        result={resultado()}
        status="active"
        stageSummary="Estudamos a categoria e as concorrentes."
      />,
    )

    expect(screen.getByText('Estudamos a categoria e as concorrentes.')).toBeInTheDocument()
  })

  it('sem etapa corrente, a terceira linha simplesmente some', () => {
    const { container } = render(
      <AttentionState result={resultado()} status="active" stageSummary={null} />,
    )

    expect(container.querySelectorAll('p')).toHaveLength(1)
  })

  it('⚠️ projeto pausado não diz "tudo certo" — diz que está pausado', () => {
    render(<AttentionState result={resultado()} status="paused" stageSummary="Pesquisa." />)

    expect(screen.getByText('Este projeto está pausado no momento.')).toBeInTheDocument()
    expect(screen.queryByText('Tudo certo por aqui.')).not.toBeInTheDocument()
  })

  it('⚠️ pausado não repete a etapa corrente — seria afirmar trabalho parado', () => {
    render(<AttentionState result={resultado()} status="paused" stageSummary="Pesquisa." />)

    expect(screen.queryByText('Pesquisa.')).not.toBeInTheDocument()
  })

  it('concluído fala no passado', () => {
    render(<AttentionState result={resultado()} status="completed" stageSummary={null} />)

    expect(screen.getByText('Este projeto foi concluído.')).toBeInTheDocument()
  })

  it('arquivado fala de histórico', () => {
    render(<AttentionState result={resultado()} status="archived" stageSummary={null} />)

    expect(screen.getByText('Este projeto está arquivado.')).toBeInTheDocument()
  })
})

describe('⚠️ degraded — não deu para verificar', () => {
  const degradado = resultado({ state: 'degraded', failed: 1, complete: false })

  it('diz que não conseguiu verificar', () => {
    render(<AttentionState result={degradado} status="active" stageSummary={null} />)

    expect(
      screen.getByText('Não conseguimos verificar todas as suas pendências agora.'),
    ).toBeInTheDocument()
  })

  it('⚠️ NENHUMA frase de calma aparece na árvore', () => {
    const { container } = render(
      <AttentionState result={degradado} status="active" stageSummary="Pesquisa." />,
    )

    for (const frase of CALMA) {
      expect(container.textContent).not.toMatch(new RegExp(frase, 'i'))
    }
  })

  it('não é alerta: sem role="alert"', () => {
    render(<AttentionState result={degradado} status="active" stageSummary={null} />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('não oferece botão de tentar de novo — o cliente não causou nada', () => {
    render(<AttentionState result={degradado} status="active" stageSummary={null} />)

    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('⚠️ nenhum detalhe técnico atravessa a fronteira', () => {
    const { container } = render(
      <AttentionState result={degradado} status="active" stageSummary={null} />,
    )

    const texto = container.textContent ?? ''
    for (const proibido of [
      'error',
      'Error',
      'supabase',
      'onboarding_submissions',
      'digest',
      'PGRST',
      'select',
    ]) {
      expect(texto).not.toContain(proibido)
    }
  })

  it('a Home continua: o texto convida a acompanhar o projeto abaixo', () => {
    render(<AttentionState result={degradado} status="active" stageSummary={null} />)

    expect(screen.getByText(/acompanhar o andamento do projeto abaixo/i)).toBeInTheDocument()
  })
})

describe('a resposta nunca falta', () => {
  const estados: AttentionResult[] = [
    resultado({ state: 'attention', items: [item()] }),
    resultado({ state: 'calm' }),
    resultado({ state: 'degraded', failed: 1, complete: false }),
  ]

  it.each(estados)('estado `$state` sempre renderiza uma seção com título', (result) => {
    render(<AttentionState result={result} status="active" stageSummary={null} />)

    expect(screen.getAllByRole('heading').length).toBeGreaterThan(0)
  })
})
