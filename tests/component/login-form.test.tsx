import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from '@/app/(auth)/login/login-form'
import { LOGIN_ERROR_MESSAGE } from '@/lib/auth/errors'
import type { MagicLinkState } from '@/lib/auth/actions'

const requestMagicLink = vi.fn()

vi.mock('@/lib/auth/actions', () => ({
  requestMagicLink: (previous: MagicLinkState, formData: FormData) =>
    requestMagicLink(previous, formData) as Promise<MagicLinkState>,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoginForm', () => {
  it('comeca no estado inicial, com campo rotulado e acessivel', () => {
    render(<LoginForm />)

    expect(screen.getByRole('heading', { name: 'Acesse seu projeto' })).toBeInTheDocument()

    const email = screen.getByLabelText(/seu e-mail/i)
    expect(email).toHaveAttribute('type', 'email')
    expect(email).toBeRequired()

    expect(screen.getByRole('button', { name: /receber link de acesso/i })).toBeEnabled()
  })

  it('mostra o erro que veio do callback, em pt-BR', () => {
    render(<LoginForm initialError="link_expired" />)

    const alert = screen.getByRole('status')
    expect(alert).toHaveTextContent(LOGIN_ERROR_MESSAGE.link_expired)
  })

  it('liga o erro de e-mail ao proprio campo', async () => {
    /*
     * O erro chega do servidor, nao do navegador: `type="email"` ja barra o
     * obviamente malformado, e o que sobra (dominio inexistente, tamanho
     * acima do limite) so o zod da action rejeita.
     */
    requestMagicLink.mockResolvedValue({ status: 'error', code: 'invalid_email' })
    const user = userEvent.setup()

    render(<LoginForm />)
    await user.type(screen.getByLabelText(/seu e-mail/i), 'cecilia@hartmann.example.com')
    await user.click(screen.getByRole('button', { name: /receber link/i }))

    await waitFor(() => {
      const email = screen.getByLabelText(/seu e-mail/i)
      expect(email).toHaveAttribute('aria-invalid', 'true')
      expect(email).toHaveAccessibleDescription(LOGIN_ERROR_MESSAGE.invalid_email)
    })
  })

  it('confirma o envio sem afirmar que a conta existe', async () => {
    requestMagicLink.mockResolvedValue({ status: 'sent', email: 'cecilia@hartmann.example.com' })
    const user = userEvent.setup()

    render(<LoginForm />)
    await user.type(screen.getByLabelText(/seu e-mail/i), 'cecilia@hartmann.example.com')
    await user.click(screen.getByRole('button', { name: /receber link/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Link enviado.' })).toBeInTheDocument()
    })

    /*
     * A frase e condicional — "SE tiver acesso". Uma confirmacao seca diria a
     * qualquer visitante quem e cliente da Boop.
     */
    expect(screen.getByText(/tiver acesso/i)).toBeInTheDocument()
    expect(screen.getByText(/15 minutos/)).toBeInTheDocument()
    expect(screen.getByText(/não encaminhe/i)).toBeInTheDocument()
  })

  it('leva adiante o destino pedido, sem exibi-lo como campo editavel', () => {
    const { container } = render(<LoginForm next="/portal/p1/conteudo" />)

    const hidden = container.querySelector('input[name="next"]')
    expect(hidden).toHaveValue('/portal/p1/conteudo')
    expect(hidden).toHaveAttribute('type', 'hidden')
  })

  it('nao mostra caminho de protótipo para dentro do portal', () => {
    render(<LoginForm />)

    expect(screen.queryByRole('link', { name: /ir para o portal/i })).not.toBeInTheDocument()
  })
})
