import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import HomePage from '@/app/page'

describe('HomePage', () => {
  it('renderiza o título do protótipo', () => {
    render(<HomePage />)
    expect(screen.getByRole('heading', { level: 1, name: /protótipo visual/i })).toBeVisible()
  })

  it('abre o fluxo completo do protótipo', () => {
    render(<HomePage />)
    expect(screen.getByRole('link', { name: /entrar/i })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: /bem-vindas/i })).toHaveAttribute('href', '/bem-vindo')
    expect(screen.getByRole('link', { name: /^portal/i })).toHaveAttribute(
      'href',
      expect.stringContaining('/portal/'),
    )
    expect(screen.getByRole('link', { name: /admin/i })).toHaveAttribute('href', '/admin')
  })

  it('deixa explícito que os dados são fictícios', () => {
    render(<HomePage />)
    expect(screen.getByText(/dados são fictícios/i)).toBeVisible()
  })

  it('nunca imprime valor de variável de ambiente', () => {
    process.env.RESEND_API_KEY = 'segredo-que-nao-pode-vazar'
    const { container } = render(<HomePage />)
    expect(container.textContent).not.toContain('segredo-que-nao-pode-vazar')
    delete process.env.RESEND_API_KEY
  })
})
