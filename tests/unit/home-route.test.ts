import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * A raiz e a unica rota que decide destino sem renderizar nada. O que importa
 * e que a decisao seja server-side (sem piscar tela indevida) e que a duvida
 * caia no login.
 */

const getActor = vi.fn()

vi.mock('@/lib/auth/actor', () => ({ getActor: () => getActor() as Promise<unknown> }))

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`)
  },
}))

async function visit() {
  const { default: HomePage } = await import('@/app/page')
  return HomePage()
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('/', () => {
  it('leva ao portal quem tem sessao ativa', async () => {
    getActor.mockResolvedValue({ userId: 'u1', status: 'active' })
    await expect(visit()).rejects.toThrow('REDIRECT:/portal')
  })

  it('leva ao login quem nao tem sessao', async () => {
    getActor.mockResolvedValue(null)
    await expect(visit()).rejects.toThrow('REDIRECT:/login')
  })

  it('leva ao login quem tem sessao mas perfil desligado', async () => {
    getActor.mockResolvedValue({ userId: 'u1', status: 'disabled' })
    await expect(visit()).rejects.toThrow('REDIRECT:/login')
  })

  it('leva ao login quem ainda nao foi ativado', async () => {
    getActor.mockResolvedValue({ userId: 'u1', status: 'invited' })
    await expect(visit()).rejects.toThrow('REDIRECT:/login')
  })
})
