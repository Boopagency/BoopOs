import { describe, expect, it } from 'vitest'
import { redact } from '@/lib/logging/logger'

/**
 * docs/security.md: nunca registrar token, senha, cookie, service role ou
 * signed URL. Este teste protege a rede de seguranca do logger.
 */
describe('logger/redact', () => {
  it('mascara chaves sensiveis por nome', () => {
    expect(redact({ accessToken: 'abc', password: '123', SERVICE_KEY: 'x' })).toEqual({
      accessToken: '[redacted]',
      password: '[redacted]',
      SERVICE_KEY: '[redacted]',
    })
  })

  it('mascara em profundidade', () => {
    expect(redact({ user: { id: '1', authorization: 'Bearer x' } })).toEqual({
      user: { id: '1', authorization: '[redacted]' },
    })
  })

  it('mascara dentro de arrays', () => {
    expect(redact([{ cookie: 'a' }, { id: 2 }])).toEqual([{ cookie: '[redacted]' }, { id: 2 }])
  })

  it('preserva valores nao sensiveis', () => {
    expect(redact({ clientId: 'c1', count: 3, active: true })).toEqual({
      clientId: 'c1',
      count: 3,
      active: true,
    })
  })

  it('nao quebra com null e primitivos', () => {
    expect(redact(null)).toBeNull()
    expect(redact('texto')).toBe('texto')
  })
})
