import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'
import type * as EnvModule from '@/config/env'

/*
 * O callback e a unica rota que transforma um link de e-mail em sessao. Cada
 * caso abaixo e um jeito de aquilo dar errado — e nenhum deles pode terminar
 * com a pessoa dentro do produto.
 */

const cookieStore = new Map<string, string>()
const deleted: string[] = []

vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
      delete: (name: string) => {
        deleted.push(name)
        cookieStore.delete(name)
      },
    }),
}))

const exchangeCodeForSession = vi.fn()
const verifyOtp = vi.fn()
const signOut = vi.fn()
const recordFirstLogin = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () =>
    Promise.resolve({ auth: { exchangeCodeForSession, verifyOtp, signOut } }),
}))

vi.mock('@/lib/auth/first-login', () => ({
  /* Sem argumento desde a FASE 4: quem a fronteira do banco promove e sempre
   * `auth.uid()`, entao nao ha `userId` para o callback passar adiante. */
  recordFirstLogin: (): Promise<string> => recordFirstLogin() as Promise<string>,
}))

vi.mock('@/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof EnvModule>()
  return { ...actual, env: { ...actual.env, NEXT_PUBLIC_APP_URL: 'https://boop.example' } }
})

const USER = { id: '10000000-0000-4000-8000-000000000005' }

function request(query: string): NextRequest {
  /* A rota so le `request.url`; um NextRequest inteiro nao acrescenta nada. */
  return { url: `https://boop.example/auth/callback${query}` } as NextRequest
}

async function get(query: string) {
  const { GET } = await import('@/app/(auth)/auth/callback/route')
  const response = await GET(request(query))
  return { status: response.status, location: response.headers.get('location') }
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  cookieStore.clear()
  deleted.length = 0
  signOut.mockResolvedValue({ error: null })
})

describe('GET /auth/callback', () => {
  it('troca o code por sessao e leva ao destino padrao', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: USER }, error: null })
    recordFirstLogin.mockResolvedValue('promoted')

    const { status, location } = await get('?code=abc')

    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc')
    /* A ausencia de argumento E a asserção: se um `userId` voltasse a
     * atravessar essa fronteira, voltaria junto a pergunta "de onde ele veio". */
    expect(recordFirstLogin).toHaveBeenCalledWith()
    expect(status).toBe(303)
    expect(location).toBe('https://boop.example/portal')
  })

  it('respeita o destino guardado em cookie e o descarta depois', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: USER }, error: null })
    recordFirstLogin.mockResolvedValue('already_active')
    cookieStore.set('boop-auth-next', '/portal/p1/conteudo')

    const { location } = await get('?code=abc')

    expect(location).toBe('https://boop.example/portal/p1/conteudo')
    expect(deleted).toContain('boop-auth-next')
  })

  it('ignora destino externo — cookie tambem e entrada do navegador', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: USER }, error: null })
    recordFirstLogin.mockResolvedValue('already_active')
    cookieStore.set('boop-auth-next', 'https://evil.example')

    const { location } = await get('?code=abc')

    expect(location).toBe('https://boop.example/portal')
  })

  it('ignora destino protocol-relative vindo do cookie', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: USER }, error: null })
    recordFirstLogin.mockResolvedValue('already_active')
    cookieStore.set('boop-auth-next', '//evil.example')

    const { location } = await get('?code=abc')

    expect(location).toBe('https://boop.example/portal')
  })

  /*
   * O destino nunca viaja na URL do e-mail: la ele obrigaria a cadastrar
   * curinga na lista de Redirect URLs do Supabase, e pertenceria a quem
   * abrisse o e-mail em vez de a quem pediu o link.
   */
  it('nao aceita destino vindo da query string', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: USER }, error: null })
    recordFirstLogin.mockResolvedValue('already_active')

    const { location } = await get('?code=abc&next=%2Fportal%2Fp1%2Fconteudo')

    expect(location).toBe('https://boop.example/portal')
  })

  it('recusa chamada sem code', async () => {
    const { status, location } = await get('')

    expect(status).toBe(303)
    expect(location).toBe('https://boop.example/login?erro=link_invalid')
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('traduz o erro que o proprio Supabase devolve na URL', async () => {
    const { location } = await get('?error=access_denied&error_code=otp_expired')

    expect(location).toBe('https://boop.example/login?erro=link_expired')
    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('trata falha na troca do code', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: { code: 'bad_code_verifier', status: 401 },
    })

    const { location } = await get('?code=abc')

    expect(location).toBe('https://boop.example/login?erro=link_invalid')
  })

  it('derruba a sessao de quem esta desligado', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: USER }, error: null })
    recordFirstLogin.mockResolvedValue('disabled')

    const { location } = await get('?code=abc')

    expect(signOut).toHaveBeenCalled()
    expect(location).toBe('https://boop.example/login?erro=access_revoked')
  })

  it('derruba a sessao quando nao existe perfil — nunca cria um', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: USER }, error: null })
    recordFirstLogin.mockResolvedValue('no_profile')

    const { location } = await get('?code=abc')

    expect(signOut).toHaveBeenCalled()
    expect(location).toBe('https://boop.example/login?erro=activation_pending')
  })

  it('derruba a sessao quando a promocao falha', async () => {
    exchangeCodeForSession.mockResolvedValue({ data: { user: USER }, error: null })
    recordFirstLogin.mockResolvedValue('failed')

    const { location } = await get('?code=abc')

    expect(signOut).toHaveBeenCalled()
    expect(location).toBe('https://boop.example/login?erro=activation_pending')
  })
})

/**
 * A SEGUNDA PORTA — `?token_hash=&type=`, o link nascido no servidor (FASE 5).
 *
 * O convite (`inviteUserByEmail`) e disparado pelo servidor, entao nao existe
 * verifier PKCE no navegador de quem foi convidado: a pessoa nunca chamou
 * `signInWithOtp`. Sem esta porta o GoTrue cai no fluxo implicito e devolve a
 * sessao no FRAGMENTO da URL, que nunca chega ao servidor — e o convite morre
 * com "link invalido".
 *
 * `verifyOtp` resolve inteiramente no servidor e grava o cookie pelo mesmo
 * caminho da primeira porta.
 */
describe('GET /auth/callback — link de convite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieStore.clear()
    deleted.length = 0
    recordFirstLogin.mockResolvedValue('promoted')
  })

  it('troca o token do convite por sessao e leva ao portal', async () => {
    verifyOtp.mockResolvedValue({ data: { user: USER }, error: null })

    const { location } = await get('?token_hash=abc123&type=invite')

    expect(verifyOtp).toHaveBeenCalledWith({ type: 'invite', token_hash: 'abc123' })
    expect(location).toBe('https://boop.example/portal')
  })

  it('promove `invited -> active` como qualquer outra entrada', async () => {
    verifyOtp.mockResolvedValue({ data: { user: USER }, error: null })

    await get('?token_hash=abc123&type=invite')

    expect(recordFirstLogin).toHaveBeenCalled()
  })

  it('⚠️ NAO usa o caminho do PKCE: `exchangeCodeForSession` fica intacto', async () => {
    verifyOtp.mockResolvedValue({ data: { user: USER }, error: null })

    await get('?token_hash=abc123&type=invite')

    expect(exchangeCodeForSession).not.toHaveBeenCalled()
  })

  it('⚠️ `type` fora da lista de permissao e recusado sem chamar o Supabase', async () => {
    /*
     * Lista de permissao, e nao de recusa: `recovery` e `email_change` abririam
     * fluxos que o produto nao tem — nao existe senha (D-06, ADR-0009).
     */
    const { location } = await get('?token_hash=abc123&type=recovery')

    expect(verifyOtp).not.toHaveBeenCalled()
    expect(location).toBe('https://boop.example/login?erro=link_invalid')
  })

  it('⚠️ `token_hash` sem `type` e recusado', async () => {
    const { location } = await get('?token_hash=abc123')

    expect(verifyOtp).not.toHaveBeenCalled()
    expect(location).toBe('https://boop.example/login?erro=link_invalid')
  })

  it('convite expirado explica o que houve', async () => {
    verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { code: 'otp_expired', status: 401 },
    })

    const { location } = await get('?token_hash=abc123&type=invite')

    expect(location).toBe('https://boop.example/login?erro=link_expired')
  })

  it('⚠️ quem foi desligado nao entra por um convite antigo', async () => {
    verifyOtp.mockResolvedValue({ data: { user: USER }, error: null })
    recordFirstLogin.mockResolvedValue('disabled')

    const { location } = await get('?token_hash=abc123&type=invite')

    expect(signOut).toHaveBeenCalled()
    expect(location).toBe('https://boop.example/login?erro=access_revoked')
  })

  it('⚠️ sem `code` E sem `token_hash`, nada acontece', async () => {
    const { location } = await get('')

    expect(exchangeCodeForSession).not.toHaveBeenCalled()
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(location).toBe('https://boop.example/login?erro=link_invalid')
  })
})
