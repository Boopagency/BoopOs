import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PortalGreeting } from '@/components/patterns/portal-greeting'

/**
 * A saudação cumprimenta a PESSOA.
 *
 * O caso que importa é o negativo: sem nome preenchido, a saudação fica sem
 * nome — e nunca cai para a razão social. Cumprimentar uma empresa como se
 * fosse gente é o gesto que faz um portal parecer um CRM (D-28).
 */
describe('com nome', () => {
  it('usa o primeiro nome da pessoa', () => {
    render(
      <PortalGreeting fullName="Cecilia Hartmann" clientName="Hartmann" projectName="Social" />,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Cecilia\.$/)
  })

  it('usa só o primeiro nome, não o nome inteiro', () => {
    render(
      <PortalGreeting fullName="Cecilia Hartmann" clientName="Hartmann" projectName="Social" />,
    )

    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toContain('Cecilia Hartmann')
  })

  it('aguenta espaço sobrando sem cumprimentar o vazio', () => {
    render(
      <PortalGreeting fullName="  Joao   Velmont " clientName="Velmont" projectName="Social" />,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/, Joao\.$/)
  })
})

describe('⚠️ sem nome', () => {
  it('cumprimenta sem nome quando `full_name` é nulo', () => {
    render(<PortalGreeting fullName={null} clientName="Hartmann" projectName="Social" />)

    const h1 = screen.getByRole('heading', { level: 1 })

    expect(h1.textContent).toMatch(/^(Bom dia|Boa tarde|Boa noite)\.$/)
  })

  it('⚠️ NUNCA usa a razão social no lugar do nome da pessoa', () => {
    render(<PortalGreeting fullName={null} clientName="Hartmann" projectName="Social" />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toContain('Hartmann')
  })

  it('nome em branco é o mesmo que nome ausente', () => {
    render(<PortalGreeting fullName="   " clientName="Hartmann" projectName="Social" />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/\.$/)
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toContain('Hartmann')
  })
})

describe('o contexto vem separado da saudação', () => {
  it('cliente e projeto aparecem como metadado, não como frase', () => {
    render(
      <PortalGreeting fullName="Cecilia Hartmann" clientName="Hartmann" projectName="Social" />,
    )

    expect(screen.getByText('Hartmann · Social')).toBeInTheDocument()
  })

  it('a Home tem UM h1, e é a saudação', () => {
    render(
      <PortalGreeting fullName="Cecilia Hartmann" clientName="Hartmann" projectName="Social" />,
    )

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
