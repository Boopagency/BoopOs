import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemberList } from '@/domains/people/components/member-list'
import type { AssignablePerson, ClientMember } from '@/domains/people/types'

/**
 * A lista de quem alcança um cliente.
 *
 * Dois casos existem por regra de produto e não por estética: nada de tabela
 * (scroll horizontal no celular é proibido, inclusive no admin) e o estado
 * vazio diz o que vem a seguir em vez de "nenhum item".
 */

vi.mock('@/domains/people/actions', () => ({
  grantClientAccessAction: vi.fn(),
  revokeClientAccessAction: vi.fn(),
}))

const CLIENTE = '20000000-0000-4000-8000-000000000001'

const MEMBROS: ClientMember[] = [
  {
    membershipId: '21000000-0000-4000-8000-000000000001',
    userId: '10000000-0000-4000-8000-000000000002',
    fullName: 'Ana Prado',
    email: 'ana@boop.example.com',
    role: 'boop_member',
    status: 'active',
    grantedAt: '2026-07-01T12:00:00.000Z',
  },
  {
    membershipId: '21000000-0000-4000-8000-000000000002',
    userId: '10000000-0000-4000-8000-000000000005',
    fullName: null,
    email: 'cecilia@hartmann.example.com',
    role: 'client_user',
    status: 'invited',
    grantedAt: '2026-07-02T12:00:00.000Z',
  },
]

const DISPONIVEIS: AssignablePerson[] = [
  {
    id: '10000000-0000-4000-8000-000000000003',
    fullName: 'Rafa Nunes',
    email: 'rafa@boop.example.com',
    role: 'boop_member',
  },
]

describe('MemberList', () => {
  it('mostra cada pessoa com papel em pt-BR', () => {
    render(<MemberList clientId={CLIENTE} members={MEMBROS} assignable={[]} />)

    expect(screen.getByText('Ana Prado')).toBeInTheDocument()
    expect(screen.getByText(/Time Boop/)).toBeInTheDocument()
    expect(screen.getByText(/Cliente/)).toBeInTheDocument()
  })

  it('cai no e-mail quando não há nome', () => {
    render(<MemberList clientId={CLIENTE} members={MEMBROS} assignable={[]} />)
    expect(screen.getByText('cecilia@hartmann.example.com')).toBeInTheDocument()
  })

  it('sinaliza quem ainda não entrou', () => {
    render(<MemberList clientId={CLIENTE} members={MEMBROS} assignable={[]} />)
    expect(screen.getByText(/Convidada/)).toBeInTheDocument()
  })

  it('⚠️ nunca mostra o valor do enum, só o rótulo', () => {
    render(<MemberList clientId={CLIENTE} members={MEMBROS} assignable={[]} />)

    for (const cru of ['boop_member', 'client_user', 'invited', 'active']) {
      expect(document.body.textContent).not.toContain(cru)
    }
  })

  it('⚠️ é lista, nunca tabela: sem scroll horizontal no celular', () => {
    const { container } = render(
      <MemberList clientId={CLIENTE} members={MEMBROS} assignable={[]} />,
    )

    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it('o estado vazio diz o que vem a seguir, não "nenhum item"', () => {
    render(<MemberList clientId={CLIENTE} members={[]} assignable={[]} />)

    expect(screen.getByText(/convide a primeira pessoa/i)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/nenhum item|sem dados|nenhum registro/i)
  })

  it('oferece remover acesso de cada pessoa', () => {
    render(<MemberList clientId={CLIENTE} members={MEMBROS} assignable={[]} />)
    expect(screen.getAllByRole('button', { name: /remover acesso/i })).toHaveLength(2)
  })

  it('mostra o seletor de vínculo só quando há alguém para vincular', () => {
    const { rerender } = render(<MemberList clientId={CLIENTE} members={MEMBROS} assignable={[]} />)

    /* Bloco vazio DESAPARECE — não vira card de "ninguém disponível". */
    expect(screen.queryByLabelText(/dar acesso a alguém/i)).not.toBeInTheDocument()

    rerender(<MemberList clientId={CLIENTE} members={MEMBROS} assignable={DISPONIVEIS} />)
    expect(screen.getByLabelText(/dar acesso a alguém/i)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Rafa Nunes/ })).toBeInTheDocument()
  })

  it('leva o id do cliente no envio, em campo oculto', () => {
    const { container } = render(
      <MemberList clientId={CLIENTE} members={MEMBROS} assignable={DISPONIVEIS} />,
    )
    expect(container.querySelector('input[name="clientId"]')).toHaveValue(CLIENTE)
  })
})
