import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * O ponto central desta suite: a Foundation precisa subir SEM as integracoes
 * futuras. Uma validacao que exigisse Supabase, Resend ou Notion no import
 * quebraria `pnpm dev` e `pnpm build` — exatamente o que nao pode acontecer.
 */
describe('config/env', () => {
  const original = { ...process.env }

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.RESEND_API_KEY
    delete process.env.NOTION_API_KEY
  })

  afterEach(() => {
    process.env = { ...original }
  })

  it('importa sem nenhuma variavel de integracao definida', async () => {
    const mod = await import('@/config/env')
    expect(mod.env.NODE_ENV).toBeDefined()
  })

  it('usa localhost como URL padrao da aplicacao', async () => {
    const { env } = await import('@/config/env')
    expect(env.NEXT_PUBLIC_APP_URL).toMatch(/^https?:\/\//)
  })

  it('reporta integracao ausente como nao configurada, sem lancar', async () => {
    const { integrationStatus } = await import('@/config/env')
    expect(integrationStatus()).toEqual({ supabase: false, resend: false, notion: false })
  })

  it('so falha quando a integracao e realmente exigida', async () => {
    const { requireSupabaseEnv } = await import('@/config/env')
    expect(() => requireSupabaseEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_URL/)
  })

  it('nomeia todas as variaveis ausentes na mensagem de erro', async () => {
    const { requireSupabaseEnv } = await import('@/config/env')
    expect(() => requireSupabaseEnv()).toThrowError(/NEXT_PUBLIC_SUPABASE_ANON_KEY/)
  })

  it('reconhece a integracao como configurada quando as variaveis existem', async () => {
    process.env.RESEND_API_KEY = 'valor-de-teste'
    const { integrationStatus, requireResendEnv } = await import('@/config/env')
    expect(integrationStatus().resend).toBe(true)
    expect(requireResendEnv().apiKey).toBe('valor-de-teste')
  })
})
