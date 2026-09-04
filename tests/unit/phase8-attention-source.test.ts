import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PROJECT_TYPES, type ProjectType } from '@/config/enums'
import type { OnboardingState } from '@/domains/onboarding/types'
import type { ProjectPublic } from '@/domains/projects/types'

/*
 * O dublê é do NOSSO módulo de domínio, não do Supabase.
 *
 * A pergunta aqui é de decisão: qual estado vira atenção. Se a submissão é
 * visível para esta pessoa é pergunta de RLS, e RLS se testa contra Postgres de
 * verdade — `tests/rls/phase8-attention-boundaries.test.ts` faz isso, aos pares.
 */
const estado = vi.hoisted<{ current: OnboardingState }>(() => ({ current: 'not_started' }))

vi.mock('@/domains/onboarding/queries', () => ({
  getOnboardingStateForClient: () => Promise.resolve({ state: estado.current }),
}))

const { onboardingSource } = await import('@/domains/attention/sources/onboarding')

const PROJETO = '30000000-0000-4000-8000-000000000001'

function projeto(type: ProjectType = 'social'): ProjectPublic {
  return {
    id: PROJETO,
    clientId: '20000000-0000-4000-8000-000000000001',
    name: 'Social media',
    type,
    status: 'active',
    cycle: 1,
    startedOn: null,
  }
}

const ctx = (type: ProjectType = 'social') => ({ project: projeto(type) })

beforeEach(() => {
  estado.current = 'not_started'
})

describe('onboarding: só `draft` é a vez do cliente', () => {
  it('`draft` → um item acionável', async () => {
    estado.current = 'draft'

    const itens = await onboardingSource.run(ctx())

    expect(itens).toHaveLength(1)
    expect(itens[0]?.kind).toBe('onboarding.continue')
    expect(itens[0]?.count).toBe(1)
    expect(itens[0]?.cta.label).toBe('Continuar')
  })

  const semAtencao: OnboardingState[] = ['not_started', 'submitted', 'unsupported']

  it.each(semAtencao)('⚠️ `%s` não gera atenção', async (state) => {
    estado.current = state

    expect(await onboardingSource.run(ctx())).toEqual([])
  })

  it('⚠️ `not_started` não cobra o que só a Boop pode fazer', async () => {
    estado.current = 'not_started'

    /* Só a Boop abre a submissão. Sem acionabilidade, sem atenção. */
    expect(await onboardingSource.run(ctx())).toEqual([])
  })
})

describe('o CTA aponta para o projeto real', () => {
  beforeEach(() => {
    estado.current = 'draft'
  })

  it('href é montado com o id da linha verificada', async () => {
    const [item] = await onboardingSource.run(ctx())

    expect(item?.cta.href).toBe(`/portal/${PROJETO}/onboarding`)
  })

  it('⚠️ nenhum slug de protótipo sobreviveu', async () => {
    const [item] = await onboardingSource.run(ctx())

    expect(item?.cta.href).not.toMatch(/hartmann|velmont|demo/i)
  })

  it('o id é estável e deriva do projeto', async () => {
    const [a] = await onboardingSource.run(ctx())
    const [b] = await onboardingSource.run(ctx())

    expect(a?.id).toBe(b?.id)
    expect(a?.id).toBe(`onboarding.continue:${PROJETO}`)
  })

  it('o item não carrega PII nem identificador interno', async () => {
    const [item] = await onboardingSource.run(ctx())
    const texto = JSON.stringify(item)

    expect(texto).not.toMatch(/@/)
    expect(texto).not.toMatch(/template_id|submission_id|internal/i)
  })

  it('a prioridade vem da tabela, não de número solto no código', async () => {
    const { PRIORITY } = await import('@/config/attention')
    const [item] = await onboardingSource.run(ctx())

    expect(item?.priority).toBe(PRIORITY['onboarding.continue'])
  })
})

describe('`appliesTo` deriva do template da jornada', () => {
  it('social tem etapa de onboarding → a source se aplica', () => {
    expect(onboardingSource.appliesTo(ctx('social'))).toBe(true)
  })

  const outros = PROJECT_TYPES.filter((type) => type !== 'social')

  it.each(outros)('⚠️ `%s` não tem a etapa → a source não se aplica', (type) => {
    expect(onboardingSource.appliesTo(ctx(type))).toBe(false)
  })

  it('a decisão não é o literal "social" escrito à mão', async () => {
    /*
     * Se uma jornada nova ganhar etapa de onboarding, `appliesTo` acompanha
     * sozinho. Um `type === 'social'` envelheceria em silêncio, deixando de
     * cobrar um onboarding que passou a existir.
     */
    const fonte = await import('node:fs').then(({ readFileSync }) =>
      readFileSync('src/domains/attention/sources/onboarding.ts', 'utf8'),
    )
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '')

    expect(/===\s*'social'/.test(codigo)).toBe(false)
    expect(/journeyForType/.test(codigo)).toBe(true)
  })
})
