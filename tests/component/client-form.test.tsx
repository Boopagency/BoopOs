import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WORKFLOW_MESSAGE } from '@/config/messages'
import { ClientForm } from '@/domains/clients/components/client-form'
import type { ActionState } from '@/lib/workflow/action-state'

/**
 * O formulário de cliente — o único do sistema que escreve `clients.notes`.
 *
 * Além dos quatro estados e da acessibilidade, há dois casos que existem por
 * segurança: o campo de nota precisa DIZER que é interno (senão alguém escreve
 * ali achando que o cliente lê), e o `slug` precisa ser imutável na edição.
 */

const action = vi.fn<(prev: ActionState, formData: FormData) => Promise<ActionState>>()

const CLIENTE = {
  id: '20000000-0000-4000-8000-000000000001',
  name: 'Hartmann',
  slug: 'hartmann',
  notes: 'Nota interna da Boop.',
}

beforeEach(() => {
  vi.clearAllMocks()
  action.mockResolvedValue({ status: 'idle' })
})

/**
 * Preenche `name` e `slug` antes de enviar.
 *
 * Não é cerimônia de teste: os dois são `required`, e o jsdom aplica a
 * validação nativa do HTML igual ao navegador. Clicar em enviar com eles vazios
 * NÃO dispara a action — é o comportamento correto, e é por isso que o
 * formulário precisa deles preenchidos aqui para chegar ao erro do servidor.
 */
async function preencherObrigatorios(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/nome da marca/i), 'Hartmann')
  await userEvent.type(screen.getByLabelText(/identificador/i), 'hartmann')
}

describe('ClientForm — criação', () => {
  it('tem os três campos rotulados e associados', () => {
    render(<ClientForm action={action} submitLabel="Criar cliente" />)

    expect(screen.getByLabelText(/nome da marca/i)).toBeRequired()
    expect(screen.getByLabelText(/identificador/i)).toBeRequired()
    expect(screen.getByLabelText(/notas internas/i)).not.toBeRequired()
    expect(screen.getByRole('button', { name: 'Criar cliente' })).toBeEnabled()
  })

  it('⚠️ avisa, na própria tela, que a nota é interna', () => {
    render(<ClientForm action={action} submitLabel="Criar cliente" />)

    /*
     * O texto não é decoração. É o que impede alguém escrever ali algo
     * destinado ao cliente — a proteção técnica (`ClientPublic` sem o campo)
     * cobre o vazamento, não o mal-entendido.
     */
    expect(screen.getByText(/só a boop vê/i)).toBeInTheDocument()
    expect(screen.getByText(/o cliente nunca tem acesso/i)).toBeInTheDocument()
  })

  it('explica a regra do identificador antes de o erro acontecer', () => {
    render(<ClientForm action={action} submitLabel="Criar cliente" />)
    expect(screen.getByText(/minúsculas e com hífen/i)).toBeInTheDocument()
  })

  it('mostra o erro de domínio em pt-BR', async () => {
    action.mockResolvedValue({ status: 'error', code: 'client.slug_taken' })

    render(<ClientForm action={action} submitLabel="Criar cliente" />)
    await preencherObrigatorios()
    await userEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(WORKFLOW_MESSAGE['client.slug_taken']!)
    })
  })

  it('⚠️ nunca mostra o código cru do erro', async () => {
    action.mockResolvedValue({ status: 'error', code: 'client.slug_taken' })

    render(<ClientForm action={action} submitLabel="Criar cliente" />)
    await preencherObrigatorios()
    await userEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(document.body.textContent).not.toContain('client.slug_taken')
  })

  it('liga o erro de campo ao próprio campo, por aria-describedby', async () => {
    action.mockResolvedValue({
      status: 'error',
      code: 'input.invalid',
      fieldErrors: { slug: ['slug_invalid'] },
    })

    render(<ClientForm action={action} submitLabel="Criar cliente" />)
    await preencherObrigatorios()
    await userEvent.click(screen.getByRole('button', { name: 'Criar cliente' }))

    await waitFor(() => {
      const slug = screen.getByLabelText(/identificador/i)
      expect(slug).toHaveAttribute('aria-invalid', 'true')
      expect(slug.getAttribute('aria-describedby')).toBeTruthy()
    })

    expect(screen.getByText(/apenas letras minúsculas/i)).toBeInTheDocument()
  })
})

describe('ClientForm — edição', () => {
  it('preenche nome e nota do cliente', () => {
    render(<ClientForm action={action} submitLabel="Salvar alterações" client={CLIENTE} />)

    expect(screen.getByLabelText(/nome da marca/i)).toHaveValue('Hartmann')
    expect(screen.getByLabelText(/notas internas/i)).toHaveValue('Nota interna da Boop.')
  })

  it('⚠️ o `slug` NÃO é editável: vira texto, não campo desabilitado', () => {
    render(<ClientForm action={action} submitLabel="Salvar alterações" client={CLIENTE} />)

    /*
     * Campo desabilitado parece quebrado e ainda ocupa a navegação por teclado.
     * Texto simples diz a mesma coisa e não promete o que não cumpre.
     */
    expect(screen.queryByLabelText(/identificador/i)).not.toBeInTheDocument()
    expect(screen.getByText('hartmann')).toBeInTheDocument()
    expect(screen.getByText(/não editável/i)).toBeInTheDocument()
  })

  it('leva o id do cliente no envio, em campo oculto', () => {
    const { container } = render(
      <ClientForm action={action} submitLabel="Salvar alterações" client={CLIENTE} />,
    )

    const hidden = container.querySelector('input[name="clientId"]')
    expect(hidden).toHaveValue(CLIENTE.id)
  })

  it('confirma o sucesso sem recarregar a página', async () => {
    action.mockResolvedValue({ status: 'success', message: 'Alterações salvas.' })

    render(<ClientForm action={action} submitLabel="Salvar alterações" client={CLIENTE} />)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => {
      /*
       * `getByRole('status')` e não `getByText`: o `Callout` é quem anuncia, e
       * procurar pelo texto encontraria também qualquer região viva que
       * repetisse a frase — o que seria anúncio duplicado, não sucesso.
       */
      expect(screen.getByRole('status')).toHaveTextContent('Alterações salvas.')
    })
  })
})
