import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AnswerValue, OnboardingQuestion, OnboardingSection } from '@/domains/onboarding/types'
import type { ActionState } from '@/lib/workflow/action-state'

type SaveInput = { projectId: string; questionId: string; value: AnswerValue }

/**
 * O formulário do cliente — o que a FASE 7 promete e o que ela precisa provar.
 *
 * Três coisas, e nenhuma delas é estética:
 *
 *   1. **Nada se perde.** O rascunho volta preenchido, o autosave dispara no
 *      debounce e no blur, e trocar de seção grava o que está pendente.
 *   2. **Obrigatória não se burla.** Enviar incompleto não envia, leva o foco
 *      para a primeira que falta, e NÃO limpa o que já foi escrito.
 *   3. **Falha de gravação não vira sucesso.** Se o autosave falhou, o envio
 *      não acontece.
 *
 * As Server Actions são dubladas: o que está sob teste é o comportamento do
 * formulário, e a autorização de verdade é provada contra Postgres em
 * `tests/rls/phase7-onboarding-boundaries.test.ts`.
 */

/*
 * Os dublês são tipados: `vi.fn()` sem assinatura devolve `any`, e um `any`
 * atravessando o mock é o tipo de coisa que faz o teste continuar passando
 * depois de a action mudar de forma.
 */
const saveAction = vi.fn<(input: SaveInput) => Promise<ActionState>>()
const submitAction = vi.fn<(prev: ActionState, formData: FormData) => Promise<ActionState>>()

vi.mock('@/domains/onboarding/actions', () => ({
  saveOnboardingAnswerAction: (input: SaveInput) => saveAction(input),
  submitOnboardingAction: (prev: ActionState, formData: FormData) => submitAction(prev, formData),
}))

const { OnboardingForm } = await import('@/domains/onboarding/components/onboarding-form')

const pergunta = (over: Partial<OnboardingQuestion> & { id: string }): OnboardingQuestion => ({
  key: over.id,
  label: over.id,
  help: null,
  type: 'long_text',
  required: false,
  options: [],
  position: 1,
  ...over,
})

const SECOES: OnboardingSection[] = [
  {
    id: 's1',
    key: 'brand',
    title: 'A marca',
    lead: 'Antes de falar sobre conteúdo, queremos entender uma coisa.',
    position: 1,
    questions: [
      pergunta({ id: 'q-why', label: 'Por que a marca precisa existir?', required: true }),
      pergunta({ id: 'q-refuse', label: 'O que vocês se recusam a fazer?' }),
    ],
  },
  {
    id: 's2',
    key: 'business',
    title: 'O negócio',
    lead: 'Agora a parte prática.',
    position: 2,
    questions: [
      pergunta({
        id: 'q-revenue',
        label: 'De onde vem a receita?',
        type: 'single_select',
        required: true,
        options: ['Loja física', 'Instagram'],
      }),
      pergunta({ id: 'q-online', label: 'Vocês vendem online?', type: 'boolean', required: true }),
      pergunta({ id: 'q-team', label: 'Quantas pessoas no time?', type: 'number' }),
    ],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  saveAction.mockResolvedValue({ status: 'success' })
  submitAction.mockResolvedValue({ status: 'success' })
})

describe('renderização a partir do schema', () => {
  it('mostra a seção, a fala de abertura e a paginação editorial', () => {
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    expect(screen.getByRole('heading', { name: 'A marca' })).toBeInTheDocument()
    expect(screen.getByText(/queremos entender uma coisa/i)).toBeInTheDocument()
    /* "01 / 02" — paginação de impresso, nunca percentual (ADR de design). */
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('uma seção por vez: a segunda não está na tela', () => {
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    expect(screen.getByLabelText(/por que a marca/i)).toBeInTheDocument()
    expect(screen.queryByText('De onde vem a receita?')).not.toBeInTheDocument()
  })

  it('cada tipo ganha o controle certo, e o obrigatório é identificável', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    await user.click(screen.getByRole('button', { name: /continuar/i }))

    /* Escolha e booleano viram grupo com legenda, não label órfã. */
    const escolha = screen.getByRole('group', { name: /de onde vem a receita/i })
    expect(within(escolha).getByRole('button', { name: 'Instagram' })).toBeInTheDocument()

    const booleano = screen.getByRole('group', { name: /vendem online/i })
    expect(within(booleano).getByRole('button', { name: 'Sim' })).toBeInTheDocument()
    expect(within(booleano).getByRole('button', { name: 'Não' })).toBeInTheDocument()

    expect(screen.getByLabelText(/quantas pessoas/i)).toHaveAttribute('type', 'number')
  })

  it('⚠️ pergunta de tipo ainda não implementado não vira input falso', () => {
    const comArquivo: OnboardingSection[] = [
      {
        ...SECOES[0]!,
        questions: [pergunta({ id: 'q-file', label: 'Envie o manual', type: 'file' })],
      },
    ]

    render(<OnboardingForm projectId="p1" sections={comArquivo} answers={[]} />)

    expect(screen.getByText(/ainda não pode ser respondida por aqui/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

describe('retomada', () => {
  it('⚠️ o rascunho volta PREENCHIDO — é o critério de pronto da fase', () => {
    /* Uma seção só: o que está sob teste é o valor voltar do banco para o
     * campo, não a escolha de onde retomar (que é o caso seguinte). */
    render(
      <OnboardingForm
        projectId="p1"
        sections={SECOES.slice(0, 1)}
        answers={[
          { questionId: 'q-why', value: 'Porque a marca precisa durar.' },
          { questionId: 'q-refuse', value: 'Vender no susto.' },
        ]}
      />,
    )

    expect(screen.getByLabelText(/por que a marca/i)).toHaveValue('Porque a marca precisa durar.')
    expect(screen.getByLabelText(/se recusam/i)).toHaveValue('Vender no susto.')
  })

  it('abre na primeira seção incompleta, e não sempre na primeira', () => {
    render(
      <OnboardingForm
        projectId="p1"
        sections={SECOES}
        answers={[
          { questionId: 'q-why', value: 'respondida' },
          { questionId: 'q-refuse', value: 'respondida' },
        ]}
      />,
    )

    /* A seção 1 está completa: a pessoa volta para onde parou. */
    expect(screen.getByRole('heading', { name: 'O negócio' })).toBeInTheDocument()
  })

  it('sem resposta nenhuma, começa do começo', () => {
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)
    expect(screen.getByRole('heading', { name: 'A marca' })).toBeInTheDocument()
  })

  it('⚠️ opcional pulada não segura a retomada — só obrigatória é pendência', () => {
    render(
      <OnboardingForm
        projectId="p1"
        sections={SECOES}
        answers={[
          /* `q-refuse` é opcional e ficou em branco: mesmo assim a pessoa
           * avança, porque ela não impede o envio. */
          { questionId: 'q-why', value: 'respondida' },
          { questionId: 'q-revenue', value: 'Instagram' },
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'O negócio' })).toBeInTheDocument()
  })
})

describe('autosave', () => {
  it('grava por PERGUNTA, com o valor tipado — nunca o formulário inteiro', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    await user.type(screen.getByLabelText(/por que a marca/i), 'porque sim')
    await user.tab()

    await waitFor(() => expect(saveAction).toHaveBeenCalled())

    expect(saveAction).toHaveBeenCalledWith({
      projectId: 'p1',
      questionId: 'q-why',
      value: 'porque sim',
    })
  })

  it('o blur dispara antes do debounce vencer', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    await user.type(screen.getByLabelText(/se recusam/i), 'x')
    await user.tab()

    await waitFor(() => expect(saveAction).toHaveBeenCalledTimes(1))
  })

  it('⚠️ trocar de seção grava o que estava pendente', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    await user.type(screen.getByLabelText(/por que a marca/i), 'digitado e nao salvo ainda')
    await user.click(screen.getByRole('button', { name: /continuar/i }))

    await waitFor(() =>
      expect(saveAction).toHaveBeenCalledWith(
        expect.objectContaining({ questionId: 'q-why', value: 'digitado e nao salvo ainda' }),
      ),
    )
  })

  it('booleano `false` é gravado como resposta, e não como campo vazio', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.click(screen.getByRole('button', { name: 'Não' }))

    await waitFor(() =>
      expect(saveAction).toHaveBeenCalledWith(
        expect.objectContaining({ questionId: 'q-online', value: false }),
      ),
    )
  })

  it('mostra "Salvando…" e depois "Salvo", sem toast a cada tecla', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    await user.type(screen.getByLabelText(/por que a marca/i), 'a')
    await user.tab()

    await waitFor(() => expect(screen.getByText('Salvo')).toBeInTheDocument())
    expect(screen.queryAllByRole('alert')).toHaveLength(0)
  })

  it('⚠️ falha de gravação aparece, e NÃO é confundida com sucesso', async () => {
    saveAction.mockResolvedValue({ status: 'error', code: 'onboarding.save_failed' })

    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    await user.type(screen.getByLabelText(/por que a marca/i), 'a')
    await user.tab()

    await waitFor(() => expect(screen.getByText(/não foi possível salvar/i)).toBeInTheDocument())
    expect(screen.queryByText('Salvo')).not.toBeInTheDocument()
  })
})

describe('envio', () => {
  const completo = [
    { questionId: 'q-why', value: 'porque sim' },
    { questionId: 'q-revenue', value: 'Instagram' },
    { questionId: 'q-online', value: false },
  ]

  it('⚠️ obrigatória vazia BLOQUEIA o envio e não perde o que foi escrito', async () => {
    const user = userEvent.setup()
    render(
      <OnboardingForm
        projectId="p1"
        sections={SECOES}
        answers={[{ questionId: 'q-refuse', value: 'já escrito' }]}
      />,
    )

    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.click(screen.getByRole('button', { name: /enviar respostas/i }))

    await waitFor(() =>
      expect(screen.getByText(/faltam respostas obrigatórias/i)).toBeInTheDocument(),
    )
    expect(submitAction, 'ENVIOU MESMO FALTANDO OBRIGATORIA').not.toHaveBeenCalled()

    /* Levou de volta para a primeira que falta, sem apagar nada. */
    expect(screen.getByLabelText(/se recusam/i)).toHaveValue('já escrito')
  })

  it('liga o erro ao campo faltante por `aria-describedby`', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    await user.click(screen.getByRole('button', { name: /continuar/i }))
    await user.click(screen.getByRole('button', { name: /enviar respostas/i }))

    await waitFor(() => expect(screen.getByLabelText(/por que a marca/i)).toBeInTheDocument())

    const campo = screen.getByLabelText(/por que a marca/i)
    expect(campo).toHaveAttribute('aria-invalid', 'true')

    const descritoPor = campo.getAttribute('aria-describedby')
    expect(descritoPor).toBeTruthy()
    expect(document.getElementById(descritoPor!.split(' ')[0]!)).toHaveTextContent(/obrigatória/i)
  })

  it('⚠️ `false` numa obrigatória booleana NÃO conta como vazia', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={completo} />)

    await user.click(screen.getByRole('button', { name: /enviar respostas/i }))

    await waitFor(() => expect(submitAction).toHaveBeenCalled())
    expect(screen.queryByText(/faltam respostas obrigatórias/i)).not.toBeInTheDocument()
  })

  it('com tudo preenchido, envia com o projectId', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={completo} />)

    await user.click(screen.getByRole('button', { name: /enviar respostas/i }))

    await waitFor(() => expect(submitAction).toHaveBeenCalledTimes(1))
    const formData = submitAction.mock.calls[0]?.[1]
    expect(formData?.get('projectId')).toBe('p1')
  })

  it('⚠️ se o autosave falhou, o envio NÃO acontece', async () => {
    saveAction.mockResolvedValue({ status: 'error', code: 'onboarding.save_failed' })

    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={completo} />)

    /* Campo da seção em que a retomada deixou a pessoa — a última. */
    await user.type(screen.getByLabelText(/quantas pessoas/i), '4')
    await user.click(screen.getByRole('button', { name: /enviar respostas/i }))

    await waitFor(() => expect(saveAction).toHaveBeenCalled())
    expect(submitAction, 'ENVIOU COM RESPOSTA NAO GRAVADA').not.toHaveBeenCalled()
  })

  it('mostra o erro de domínio do servidor em pt-BR', async () => {
    submitAction.mockResolvedValue({ status: 'error', code: 'onboarding.already_submitted' })

    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={completo} />)

    await user.click(screen.getByRole('button', { name: /enviar respostas/i }))

    await waitFor(() => expect(screen.getByText(/já foi enviado/i)).toBeInTheDocument())
  })
})

describe('acessibilidade e mobile', () => {
  it('a lista de progresso marca a seção corrente com `aria-current`', () => {
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    const passos = screen.getByRole('list', { name: /seção 1 de 2/i })
    expect(within(passos).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step')
  })

  it('o retorno do autosave é anunciado por leitor de tela, sem interromper', () => {
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    const aviso = screen.getByText(/salvam sozinhas/i)
    expect(aviso).toHaveAttribute('aria-live', 'polite')
  })

  it('os botões de escolha têm 48px de altura — acima do mínimo de 44', async () => {
    const user = userEvent.setup()
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    await user.click(screen.getByRole('button', { name: /continuar/i }))

    /* `h-12` = 3rem = 48px. O teste lê a classe porque jsdom não faz layout. */
    expect(screen.getByRole('button', { name: 'Instagram' }).className).toContain('h-12')
  })

  it('⚠️ nenhum vestígio do protótipo: nada diz que as respostas não são salvas', () => {
    render(<OnboardingForm projectId="p1" sections={SECOES} answers={[]} />)

    expect(screen.queryByText(/protótipo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/não são salvas/i)).not.toBeInTheDocument()
  })
})
