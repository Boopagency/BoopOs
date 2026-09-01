import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Callout } from '@/components/ui/callout'

describe('Callout', () => {
  it('anuncia erro como alerta para leitor de tela', () => {
    render(<Callout tone="danger">Falhou</Callout>)
    expect(screen.getByRole('alert')).toHaveTextContent('Falhou')
  })

  it('usa regiao educada nos demais tons', () => {
    render(<Callout tone="success">Pronto</Callout>)
    expect(screen.getByRole('status')).toHaveTextContent('Pronto')
  })
})
