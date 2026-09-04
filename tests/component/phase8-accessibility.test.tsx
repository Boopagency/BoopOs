import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PortalShell } from '@/components/layout/portal-shell'
import { SignOutButton } from '@/components/patterns/sign-out-button'
import { visibleSections } from '@/config/app'
import { AttentionState } from '@/components/patterns/attention-state'
import { CurrentStage } from '@/components/patterns/current-stage'
import { PortalGreeting } from '@/components/patterns/portal-greeting'
import { ProjectJourney } from '@/components/patterns/project-journey'
import type { AttentionResult } from '@/domains/attention/types'
import type { ProjectStage } from '@/domains/projects/types'
import { PROJETO, item } from '../support/attention-items'

/* O cabeçalho usa `usePathname` para marcar a seção corrente. */
vi.mock('next/navigation', () => ({ usePathname: () => `/portal/${PROJETO}` }))

/* `signOut` é Server Action: fora do Next, o `form action` só precisa existir. */
vi.mock('@/lib/auth/actions', () => ({ signOut: () => Promise.resolve() }))

/**
 * O que a Home precisa garantir para quem não usa mouse, não enxerga cor ou
 * pediu para o sistema reduzir movimento.
 *
 * A meta de 375 × 667 nunca justifica regressão aqui: se a resposta não coubesse
 * acima da dobra, a saída seria reduzir CHROME — cabeçalho, barra, respiro —
 * nunca fonte, alvo de toque ou contraste.
 */

const atencao: AttentionResult = {
  state: 'attention',
  items: [item()],
  complete: true,
  evaluated: 1,
  failed: 0,
}

const calma: AttentionResult = { ...atencao, state: 'calm', items: [] }
const degradado: AttentionResult = { ...calma, state: 'degraded', complete: false, failed: 1 }

const etapas: ProjectStage[] = [
  {
    id: '1',
    key: 'a',
    label: 'Onboarding',
    position: 1,
    state: 'done',
    summary: null,
    completedOn: '2026-08-01',
  },
  {
    id: '2',
    key: 'b',
    label: 'Imersão',
    position: 2,
    state: 'current',
    summary: null,
    completedOn: null,
  },
  {
    id: '3',
    key: 'c',
    label: 'Pesquisa',
    position: 3,
    state: 'pending',
    summary: null,
    completedOn: null,
  },
]

describe('hierarquia de títulos', () => {
  it('a saudação é o único h1 da Home', () => {
    render(<PortalGreeting fullName="Ana" clientName="Marca" projectName="Social" />)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })

  it('os blocos seguintes são h2 — sem pulo de nível', () => {
    render(<AttentionState result={atencao} status="active" stageSummary={null} />)
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
  })

  it('o bloco "Agora" também é h2', () => {
    render(
      <CurrentStage cycle={2} stage={etapas[1]} state="in_progress" summary="Resumo oficial." />,
    )

    expect(screen.getByRole('heading', { level: 2, name: 'Imersão' })).toBeInTheDocument()
  })
})

describe('alvo de toque', () => {
  it('o CTA da atenção tem 56px de altura', () => {
    render(<AttentionState result={atencao} status="active" stageSummary={null} />)

    expect(screen.getByRole('link', { name: 'Continuar' }).className).toContain('h-14')
  })

  it('o CTA ocupa a largura toda no celular — alcance do polegar', () => {
    render(<AttentionState result={atencao} status="active" stageSummary={null} />)

    expect(screen.getByRole('link', { name: 'Continuar' }).className).toContain('max-md:w-full')
  })

  it('itens secundários mantêm altura mínima de toque', () => {
    const varios: AttentionResult = {
      ...atencao,
      items: [item({ id: 'a' }), item({ id: 'b', title: 'Segundo' })],
    }

    render(<AttentionState result={varios} status="active" stageSummary={null} />)

    const link = screen.getByRole('link', { name: /Segundo/ })
    expect(link.className).toContain('min-h-14')
  })

  /*
   * O cabeçalho do portal também é client-facing, e foi lá que a medição em
   * Chromium achou o único controle abaixo do mínimo: "Sair" renderizava com
   * 13.2px de altura em 375px, porque herdava só a altura da linha do texto.
   * O par de casos abaixo mede a mesma coisa que a régua mediu.
   */
  it('⚠️ "Sair" tem área de toque, e não a altura da linha do texto', () => {
    render(<SignOutButton />)

    expect(screen.getByRole('button', { name: 'Sair' }).className).toContain('min-h-11')
  })

  it('todo controle do cabeçalho do portal declara altura de toque', () => {
    render(
      <PortalShell
        projectId={PROJETO}
        clientName="Hartmann"
        projectName="Social Media"
        sections={visibleSections('social')}
      >
        <p>conteúdo</p>
      </PortalShell>,
    )

    const controles = [...screen.getAllByRole('link'), ...screen.getAllByRole('button')]

    const curtos = controles
      .filter((el) => !/min-h-11|min-h-14|h-14/.test(el.className))
      .map((el) => el.textContent?.trim() ?? el.getAttribute('aria-label'))

    expect(curtos, `sem altura de toque: ${curtos.join(', ')}`).toEqual([])
  })
})

describe('⚠️ cor nunca é o único portador de significado', () => {
  it('cada etapa anuncia o próprio estado por extenso', () => {
    render(<ProjectJourney stages={etapas} />)

    /* Duas listas — celular e desktop — então o rótulo aparece duas vezes. */
    expect(screen.getAllByText(/Em andamento/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/A seguir/).length).toBeGreaterThan(0)
  })

  it('a variante resumida herda a mesma semântica da completa', () => {
    const { container: resumida } = render(<ProjectJourney stages={etapas} variant="glance" />)
    expect(resumida.querySelectorAll('.sr-only').length).toBeGreaterThan(0)
  })
})

describe('⚠️ o numeral é gráfico, não informação', () => {
  it('está escondido do leitor de tela', () => {
    const { container } = render(
      <AttentionState result={atencao} status="active" stageSummary={null} />,
    )

    expect(container.querySelector('[data-numeric]')).toHaveAttribute('aria-hidden', 'true')
  })

  it('a frase carrega o significado sozinha', () => {
    render(<AttentionState result={atencao} status="active" stageSummary={null} />)

    expect(screen.getByText('Seu onboarding está esperando você.')).toBeInTheDocument()
  })
})

describe('nada grita sem motivo', () => {
  it.each([
    ['atenção', atencao],
    ['calma', calma],
    ['degradado', degradado],
  ])('%s não usa `role="alert"` nem `aria-live`', (_nome, result) => {
    const { container } = render(
      <AttentionState result={result} status="active" stageSummary={null} />,
    )

    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeNull()
  })

  it('⚠️ o degradado não tem cor de perigo', () => {
    const { container } = render(
      <AttentionState result={degradado} status="active" stageSummary={null} />,
    )

    expect(container.innerHTML).not.toMatch(/text-danger|bg-danger|border-danger/)
  })
})

describe('toda seção tem nome acessível', () => {
  it.each([
    ['atenção', atencao],
    ['calma', calma],
    ['degradado', degradado],
  ])('%s é uma section rotulada', (_nome, result) => {
    const { container } = render(
      <AttentionState result={result} status="active" stageSummary={null} />,
    )

    const section = container.querySelector('section')
    expect(section).toHaveAttribute('aria-labelledby')

    const id = section?.getAttribute('aria-labelledby')
    expect(container.querySelector(`#${id}`)).not.toBeNull()
  })
})
