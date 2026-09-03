import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WORKFLOW_MESSAGE } from '@/config/messages'
import { ProjectForm } from '@/domains/projects/components/project-form'
import type { ActionState } from '@/lib/workflow/action-state'

/**
 * O formulario de projeto — criar e editar.
 *
 * Alem dos quatro estados e da acessibilidade, ha dois casos que existem por
 * INVARIANTE, e nao por estetica: o tipo tem que ser imutavel na edicao (o
 * banco o recusa desde `20260903010349`), e `journey_key` nao pode aparecer em
 * lugar nenhum — nem como campo escondido.
 */

const action = vi.fn<(prev: ActionState, formData: FormData) => Promise<ActionState>>()

const PROJETO = {
  id: '30000000-0000-4000-8000-000000000001',
  name: 'Social Media 2026',
  type: 'social' as const,
  startedOn: '2026-07-14',
  endsOn: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  action.mockResolvedValue({ status: 'idle' })
})

describe('ProjectForm — criacao', () => {
  it('pede nome e tipo, e o tipo e um campo de escolha', () => {
    render(<ProjectForm action={action} submitLabel="Criar projeto" clientId="c1" />)

    expect(screen.getByLabelText(/nome do projeto/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tipo de projeto/i)).toBeInTheDocument()
  })

  it('oferece os CINCO tipos, dizendo quantas etapas cada jornada tem', () => {
    render(<ProjectForm action={action} submitLabel="Criar" clientId="c1" />)

    const opcoes = screen.getAllByRole('option')
    expect(opcoes).toHaveLength(5)
    /* A consequencia da escolha, e nao a chave tecnica: "8 etapas", nao
       "social.v1". */
    expect(opcoes[0]).toHaveTextContent(/social media\s*—\s*8 etapas/i)
  })

  it('NAO expoe `journey_key` — nem visivel, nem como input escondido', () => {
    const { container } = render(<ProjectForm action={action} submitLabel="Criar" clientId="c1" />)

    expect(container.querySelector('[name="journeyKey"]')).toBeNull()
    expect(container.querySelector('[name="journey_key"]')).toBeNull()
    expect(container.innerHTML).not.toContain('social.v1')
  })

  it('leva o clientId adiante sem pedi-lo a quem preenche', () => {
    const { container } = render(<ProjectForm action={action} submitLabel="Criar" clientId="c1" />)

    const oculto = container.querySelector('input[name="clientId"]')
    expect(oculto).toHaveValue('c1')
  })

  it('NAO pede data de fim na criacao', () => {
    render(<ProjectForm action={action} submitLabel="Criar" clientId="c1" />)
    expect(screen.queryByLabelText(/fim previsto/i)).not.toBeInTheDocument()
  })

  it('a data de inicio e opcional — o banco aceita nulo', () => {
    render(<ProjectForm action={action} submitLabel="Criar" clientId="c1" />)
    expect(screen.getByLabelText(/início/i)).not.toBeRequired()
  })
})

describe('ProjectForm — edicao', () => {
  it('mostra o tipo como TEXTO, e nao como campo desabilitado', () => {
    render(<ProjectForm action={action} submitLabel="Salvar" project={PROJETO} />)

    expect(screen.queryByLabelText(/tipo de projeto/i)).not.toBeInTheDocument()
    expect(screen.getByText('Social media')).toBeInTheDocument()
    /* Campo desabilitado parece defeito; texto explica que e uma decisao. */
    expect(screen.getByText(/definido na criação/i)).toBeInTheDocument()
  })

  it('explica POR QUE o tipo nao muda', () => {
    render(<ProjectForm action={action} submitLabel="Salvar" project={PROJETO} />)
    expect(screen.getByText(/etapas já criadas não podem discordar/i)).toBeInTheDocument()
  })

  it('leva o projectId e pede as duas datas', () => {
    const { container } = render(
      <ProjectForm action={action} submitLabel="Salvar" project={PROJETO} />,
    )

    expect(container.querySelector('input[name="projectId"]')).toHaveValue(PROJETO.id)
    expect(screen.getByLabelText(/início/i)).toHaveValue('2026-07-14')
    expect(screen.getByLabelText(/fim previsto/i)).toBeInTheDocument()
  })
})

describe('ProjectForm — os quatro estados', () => {
  it('sucesso: mostra a mensagem que a action devolveu', async () => {
    action.mockResolvedValue({ status: 'success', message: 'Alterações salvas.' })
    render(<ProjectForm action={action} submitLabel="Salvar" project={PROJETO} />)

    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(screen.getByText('Alterações salvas.')).toBeInTheDocument()
    })
  })

  it('erro: traduz o codigo de dominio para pt-BR, sem vazar o codigo', async () => {
    action.mockResolvedValue({ status: 'error', code: 'project.immutable_field' })
    render(<ProjectForm action={action} submitLabel="Salvar" project={PROJETO} />)

    await userEvent.click(screen.getByRole('button', { name: /salvar/i }))

    await waitFor(() => {
      expect(screen.getByText(WORKFLOW_MESSAGE['project.immutable_field']!)).toBeInTheDocument()
    })
    expect(screen.queryByText('project.immutable_field')).not.toBeInTheDocument()
  })

  it('erro de campo: liga a mensagem ao campo por aria-describedby', async () => {
    action.mockResolvedValue({
      status: 'error',
      code: 'input.invalid',
      fieldErrors: { name: ['name_too_short'] },
    })
    render(<ProjectForm action={action} submitLabel="Criar" clientId="c1" />)

    await userEvent.type(screen.getByLabelText(/nome do projeto/i), 'X')
    await userEvent.click(screen.getByRole('button', { name: /criar/i }))

    await waitFor(() => {
      const campo = screen.getByLabelText(/nome do projeto/i)
      expect(campo).toHaveAttribute('aria-invalid', 'true')
      expect(campo.getAttribute('aria-describedby')).toBeTruthy()
    })
  })

  it('enviando: desabilita o botao — o duplo clique no celular e o caso comum', async () => {
    let liberar: (value: ActionState) => void = () => {}
    action.mockImplementation(
      () =>
        new Promise<ActionState>((resolve) => {
          liberar = resolve
        }),
    )

    render(<ProjectForm action={action} submitLabel="Criar" clientId="c1" />)

    await userEvent.type(screen.getByLabelText(/nome do projeto/i), 'Projeto')
    await userEvent.click(screen.getByRole('button', { name: /criar/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /salvando/i })).toBeDisabled()
    })

    liberar({ status: 'idle' })
  })
})
