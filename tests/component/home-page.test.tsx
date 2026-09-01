import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from '@/app/page'

describe('HomePage', () => {
  it('renderiza o titulo da fundacao', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 1, name: /technical foundation/i })).toBeVisible()
  })

  it('oferece navegacao para portal e admin', () => {
    render(<HomePage />)
    expect(screen.getByRole('link', { name: /client portal/i })).toHaveAttribute('href', '/portal')
    expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin')
  })

  it('nunca imprime valor de variavel de ambiente', () => {
    process.env.RESEND_API_KEY = 'segredo-que-nao-pode-vazar'
    const { container } = render(<HomePage />)
    expect(container.textContent).not.toContain('segredo-que-nao-pode-vazar')
    delete process.env.RESEND_API_KEY
  })
})
