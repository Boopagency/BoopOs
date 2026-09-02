import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * O primeiro login e a unica escrita da FASE 3. O que precisa ser verdade:
 * promove uma vez so, registra `user.joined` uma vez so, e nao ressuscita
 * quem foi desligado.
 */

const logActivity = vi.fn()

vi.mock('@/lib/activity/log', () => ({
  logActivity: (entry: unknown): Promise<void> => logActivity(entry) as Promise<void>,
}))

type QueryResult = { data: unknown; error: unknown }

const calls: { method: string; args: unknown[] }[] = []
let pending: QueryResult[] = []

/** Encadeamento minimo do supabase-js: registra o que foi chamado e devolve o proximo resultado. */
function createBuilder() {
  const result = (): Promise<QueryResult> =>
    Promise.resolve(pending.shift() ?? { data: null, error: null })

  const builder = {
    update: (...args: unknown[]) => {
      calls.push({ method: 'update', args })
      return builder
    },
    select: (...args: unknown[]) => {
      calls.push({ method: 'select', args })
      return builder
    },
    eq: (...args: unknown[]) => {
      calls.push({ method: 'eq', args })
      return builder
    },
    maybeSingle: () => result(),
    /* `update(...).eq(...)` sem `.maybeSingle()` e aguardado direto. */
    then: (onfulfilled: (value: QueryResult) => unknown) => result().then(onfulfilled),
  }

  return builder
}

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from: (table: string) => {
      calls.push({ method: 'from', args: [table] })
      return createBuilder()
    },
  }),
}))

const USER = '10000000-0000-4000-8000-000000000005'

function eqCalls() {
  return calls.filter((call) => call.method === 'eq').map((call) => call.args)
}

beforeEach(() => {
  vi.clearAllMocks()
  calls.length = 0
  pending = []
})

describe('recordFirstLogin', () => {
  it('promove convidado para ativo e registra user.joined', async () => {
    pending = [{ data: { id: USER }, error: null }]

    const { recordFirstLogin } = await import('@/lib/auth/first-login')
    expect(await recordFirstLogin(USER)).toBe('promoted')

    /* A idempotencia mora neste filtro: so quem esta `invited` e promovido. */
    expect(eqCalls()).toContainEqual(['status', 'invited'])
    expect(eqCalls()).toContainEqual(['id', USER])

    expect(logActivity).toHaveBeenCalledTimes(1)
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'user.joined',
        entityType: 'profile',
        actorId: USER,
        entityId: USER,
      }),
    )
  })

  it('nao registra o evento de novo em quem ja estava ativo', async () => {
    pending = [
      { data: null, error: null },
      { data: { status: 'active' }, error: null },
    ]

    const { recordFirstLogin } = await import('@/lib/auth/first-login')
    expect(await recordFirstLogin(USER)).toBe('already_active')
    expect(logActivity).not.toHaveBeenCalled()
  })

  it('nao reativa quem foi desligado', async () => {
    pending = [
      { data: null, error: null },
      { data: { status: 'disabled' }, error: null },
    ]

    const { recordFirstLogin } = await import('@/lib/auth/first-login')
    expect(await recordFirstLogin(USER)).toBe('disabled')
    expect(logActivity).not.toHaveBeenCalled()
  })

  it('nao cria perfil quando ele nao existe', async () => {
    pending = [
      { data: null, error: null },
      { data: null, error: null },
    ]

    const { recordFirstLogin } = await import('@/lib/auth/first-login')
    expect(await recordFirstLogin(USER)).toBe('no_profile')

    expect(logActivity).not.toHaveBeenCalled()
    expect(calls.some((call) => call.method === 'insert')).toBe(false)
  })

  it('devolve falha sem promover quando a escrita da erro', async () => {
    pending = [{ data: null, error: { code: '42501' } }]

    const { recordFirstLogin } = await import('@/lib/auth/first-login')
    expect(await recordFirstLogin(USER)).toBe('failed')
    expect(logActivity).not.toHaveBeenCalled()
  })

  it('nao grava conteudo nem PII no metadata do log', async () => {
    pending = [{ data: { id: USER }, error: null }]

    const { recordFirstLogin } = await import('@/lib/auth/first-login')
    await recordFirstLogin(USER)

    const entry = logActivity.mock.calls[0]?.[0] as { metadata: Record<string, unknown> }
    expect(entry.metadata).toEqual({ status_from: 'invited', status_to: 'active' })
    expect(JSON.stringify(entry.metadata)).not.toMatch(/@/)
  })
})
