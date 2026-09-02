import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as EnvModule from '@/config/env'

/*
 * O que estes casos provam:
 *
 *   - identidade vem SEMPRE da sessao validada, nunca de entrada do cliente;
 *   - fail closed: sem sessao, sem perfil, perfil desligado ou perfil ainda
 *     nao ativo, ninguem entra;
 *   - o Actor carrega identidade — e nao escopo (vinculo e FASE 4).
 *
 * Supabase nao e mockado para testar RLS aqui (isso testaria o mock, e RLS se
 * testa contra Postgres real — ADR-0015). O que se testa e a maquina de
 * decisao da aplicacao em volta da resposta do Auth.
 */

const getUser = vi.fn()
const maybeSingle = vi.fn()
const eq = vi.fn(() => ({ maybeSingle }))
const select = vi.fn(() => ({ eq }))
const from = vi.fn(() => ({ select }))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => Promise.resolve({ auth: { getUser } }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ from }),
}))

const supabaseConfigured = { value: true }

vi.mock('@/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>()
  return {
    ...actual,
    integrationStatus: () => ({
      supabase: supabaseConfigured.value,
      resend: false,
      notion: false,
    }),
  }
})

const readCookies = vi.fn()

vi.mock('next/headers', () => ({
  cookies: () => {
    readCookies()
    return Promise.resolve({ getAll: () => [], set: () => undefined })
  },
}))

/** `redirect` do Next lanca por contrato. O teste imita isso para poder ver o destino. */
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`)
  },
}))

const SESSION_USER = { id: '10000000-0000-4000-8000-000000000005' }

const PROFILE = {
  id: SESSION_USER.id,
  email: 'cecilia@hartmann.example.com',
  full_name: 'Cecilia Hartmann',
  role: 'client_user' as const,
  status: 'active' as const,
}

async function auth() {
  return import('@/lib/auth/actor')
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  supabaseConfigured.value = true
  eq.mockReturnValue({ maybeSingle })
  select.mockReturnValue({ eq })
  from.mockReturnValue({ select })
})

describe('getActor', () => {
  it('devolve null sem sessao — e nem chega a consultar o perfil', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })

    const { getActor } = await auth()
    expect(await getActor()).toBeNull()
    expect(from).not.toHaveBeenCalled()
  })

  it('devolve null quando o Auth recusa o token', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } })

    const { getActor } = await auth()
    expect(await getActor()).toBeNull()
  })

  it('devolve null quando o Supabase nao esta configurado', async () => {
    supabaseConfigured.value = false

    const { getActor } = await auth()
    expect(await getActor()).toBeNull()
    expect(getUser).not.toHaveBeenCalled()
  })

  /*
   * Regressao com nome e endereco: enquanto o atalho de configuracao vinha
   * antes de `cookies()`, o Next prerenderizava a rota protegida com "ninguem
   * logado" e servia um redirect fixo para /login — para todo mundo.
   */
  it('le o cookie antes de qualquer atalho, para a rota nunca virar estatica', async () => {
    supabaseConfigured.value = false

    const { getActor } = await auth()
    await getActor()

    expect(readCookies).toHaveBeenCalled()
  })

  it('monta o Actor a partir do perfil', async () => {
    getUser.mockResolvedValue({ data: { user: SESSION_USER }, error: null })
    maybeSingle.mockResolvedValue({ data: PROFILE, error: null })

    const { getActor } = await auth()

    expect(await getActor()).toEqual({
      userId: PROFILE.id,
      email: PROFILE.email,
      fullName: PROFILE.full_name,
      role: 'client_user',
      status: 'active',
    })
  })

  it('filtra pelo id da sessao e projeta apenas o necessario', async () => {
    getUser.mockResolvedValue({ data: { user: SESSION_USER }, error: null })
    maybeSingle.mockResolvedValue({ data: PROFILE, error: null })

    const { getActor } = await auth()
    await getActor()

    expect(from).toHaveBeenCalledWith('profiles')
    expect(eq).toHaveBeenCalledWith('id', SESSION_USER.id)
    expect(select).toHaveBeenCalledWith('id, email, full_name, role, status')
    /* Sem `select *`: nada de `notes`, `avatar_url` ou coluna futura por acidente. */
    expect(select).not.toHaveBeenCalledWith('*')
  })

  it('nao carrega escopo — vinculo e projeto sao FASE 4', async () => {
    getUser.mockResolvedValue({ data: { user: SESSION_USER }, error: null })
    maybeSingle.mockResolvedValue({ data: PROFILE, error: null })

    const { getActor } = await auth()
    const actor = await getActor()

    expect(actor).not.toHaveProperty('clientIds')
    expect(from).toHaveBeenCalledTimes(1)
    expect(from).not.toHaveBeenCalledWith('client_memberships')
    expect(from).not.toHaveBeenCalledWith('projects')
    expect(from).not.toHaveBeenCalledWith('clients')
  })

  it('devolve null quando existe sessao mas nao existe perfil', async () => {
    getUser.mockResolvedValue({ data: { user: SESSION_USER }, error: null })
    maybeSingle.mockResolvedValue({ data: null, error: null })

    const { getActor } = await auth()
    expect(await getActor()).toBeNull()
  })

  it('devolve null quando a leitura do perfil falha — duvida e negacao', async () => {
    getUser.mockResolvedValue({ data: { user: SESSION_USER }, error: null })
    maybeSingle.mockResolvedValue({ data: null, error: { code: '42501' } })

    const { getActor } = await auth()
    expect(await getActor()).toBeNull()
  })
})

describe('requireActor', () => {
  async function expectRedirect(to: string) {
    const { requireActor } = await auth()
    await expect(requireActor()).rejects.toThrow(`REDIRECT:${to}`)
  }

  it('deixa passar o perfil ativo', async () => {
    getUser.mockResolvedValue({ data: { user: SESSION_USER }, error: null })
    maybeSingle.mockResolvedValue({ data: PROFILE, error: null })

    const { requireActor } = await auth()
    await expect(requireActor()).resolves.toMatchObject({ userId: PROFILE.id, status: 'active' })
  })

  it('manda para o login quem nao tem sessao', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null })
    await expectRedirect('/login')
  })

  it('bloqueia sessao valida sem perfil', async () => {
    getUser.mockResolvedValue({ data: { user: SESSION_USER }, error: null })
    maybeSingle.mockResolvedValue({ data: null, error: null })
    await expectRedirect('/login')
  })

  it('bloqueia perfil desligado, mesmo com sessao valida', async () => {
    getUser.mockResolvedValue({ data: { user: SESSION_USER }, error: null })
    maybeSingle.mockResolvedValue({ data: { ...PROFILE, status: 'disabled' }, error: null })
    await expectRedirect('/login?erro=access_revoked')
  })

  it('bloqueia perfil ainda nao ativado', async () => {
    getUser.mockResolvedValue({ data: { user: SESSION_USER }, error: null })
    maybeSingle.mockResolvedValue({ data: { ...PROFILE, status: 'invited' }, error: null })
    await expectRedirect('/login?erro=activation_pending')
  })
})
