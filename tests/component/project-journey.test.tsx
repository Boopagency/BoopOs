import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProjectJourney } from '@/components/patterns/project-journey'
import type { JourneyStage } from '@/lib/data/types'

const STAGES: JourneyStage[] = [
  { key: 'immersion', label: 'Imersão', state: 'done', summary: 'a', completedOn: '2026-07-24' },
  { key: 'research', label: 'Pesquisa', state: 'done', summary: 'b', completedOn: '2026-08-07' },
  { key: 'production', label: 'Produção', state: 'current', summary: 'c' },
  { key: 'review', label: 'Review', state: 'pending', summary: 'd' },
]

describe('ProjectJourney', () => {
  it('não expressa progresso em porcentagem', () => {
    const { container } = render(<ProjectJourney stages={STAGES} />)
    // A Boop trabalha em fases. "67%" nao responde "em que etapa estamos".
    expect(container.textContent).not.toMatch(/\d+\s*%/)
  })

  it('anuncia o estado de cada etapa para leitor de tela', () => {
    render(<ProjectJourney stages={STAGES} />)
    // Duas composicoes (celular e desktop) renderizam a mesma informacao.
    expect(screen.getAllByText(/em andamento/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/a seguir/i).length).toBeGreaterThan(0)
  })

  it('mostra a data de conclusão sem deslocar o dia', () => {
    render(<ProjectJourney stages={STAGES} />)
    expect(screen.getAllByText('24 de jul').length).toBeGreaterThan(0)
  })

  it('usa lista ordenada — a jornada tem ordem', () => {
    const { container } = render(<ProjectJourney stages={STAGES} />)
    expect(container.querySelectorAll('ol').length).toBeGreaterThan(0)
  })

  it('só mostra o resumo de cada etapa quando pedido', () => {
    const { rerender } = render(<ProjectJourney stages={STAGES} />)
    expect(screen.queryByText('c')).not.toBeInTheDocument()
    rerender(<ProjectJourney stages={STAGES} detailed />)
    expect(screen.getAllByText('c').length).toBeGreaterThan(0)
  })
})
