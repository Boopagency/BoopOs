import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recordFirstLogin } from '@/lib/auth/first-login'

/*
 * O primeiro login mudou de lugar na FASE 4.
 *
 * Ate a FASE 3 esta funcao montava o `update` a mao com service role, e o
 * teste conferia o encadeamento — `update(...).eq('status','invited')` — porque
 * era ali que morava a idempotencia.
 *
 * Agora a transicao inteira vive em `public.promote_invited_profile()`:
 * `security definer`, sem parametro, promovendo e registrando `user.joined` na
 * MESMA transacao. A idempotencia e a impossibilidade de apontar a promocao
 * para outra pessoa sao propriedades do BANCO, e sao provadas contra Postgres
 * real em `tests/rls/adversarial.test.ts`.
 *
 * O que sobra para o teste unitario e o que sobrou para o TypeScript: traduzir
 * a resposta da fronteira, e falhar fechado diante de qualquer coisa fora do
 * contrato.
 */

const rpc = vi.fn()
const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: () => Promise.resolve({ rpc }),
}))

vi.mock('@/lib/logging/logger', () => ({
  logger: {
    error: (...args: unknown[]): void => {
      logger.error(...args)
    },
    warn: (...args: unknown[]): void => {
      logger.warn(...args)
    },
    info: (...args: unknown[]): void => {
      logger.info(...args)
    },
  },
}))

beforeEach(() => {
  rpc.mockReset()
  logger.error.mockReset()
})

describe('recordFirstLogin', () => {
  it('chama a fronteira do banco sem nenhum argumento', async () => {
    /*
     * A assinatura E a garantia: sem parametro nao ha `userId` para passar
     * adiante, nem para errar. Quem a funcao promove e sempre `auth.uid()`.
     */
    rpc.mockResolvedValue({ data: 'promoted', error: null })

    await recordFirstLogin()

    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('promote_invited_profile')
  })

  const respostas = ['promoted', 'already_active', 'disabled', 'no_profile', 'no_session'] as const

  for (const resposta of respostas) {
    it(`repassa "${resposta}" sem reinterpretar`, async () => {
      rpc.mockResolvedValue({ data: resposta, error: null })
      expect(await recordFirstLogin()).toBe(resposta)
    })
  }

  it('erro do banco vira `failed`, com o codigo no log e nada mais', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } })

    expect(await recordFirstLogin()).toBe('failed')
    expect(logger.error).toHaveBeenCalledWith('auth.first_login_failed', { code: '42501' })
  })

  it('resposta fora do contrato falha FECHADA, nao aberta', async () => {
    /*
     * O caso que importa: se a funcao do banco mudar e passar a devolver algo
     * novo, o desfecho tem que ser "nao entra", nunca "entra por omissao". O
     * callback so aceita `promoted` e `already_active`, e este teste garante
     * que nada mais chega la disfarcado.
     */
    rpc.mockResolvedValue({ data: 'algo_novo', error: null })
    expect(await recordFirstLogin()).toBe('failed')

    rpc.mockResolvedValue({ data: null, error: null })
    expect(await recordFirstLogin()).toBe('failed')
  })

  it('nao registra o log por fora: a promocao e o evento sao uma transacao so', async () => {
    /*
     * Antes, promover e registrar eram duas chamadas — e entre elas havia uma
     * janela em que a promocao valia e o `user.joined` se perdia. Agora e uma
     * chamada so, e este teste guarda isso: nenhuma segunda ida ao banco.
     */
    rpc.mockResolvedValue({ data: 'promoted', error: null })

    await recordFirstLogin()

    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
