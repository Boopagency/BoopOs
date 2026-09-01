import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/cn'

describe('cn', () => {
  it('junta classes validas', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('descarta valores falsos', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('devolve string vazia sem entrada', () => {
    expect(cn()).toBe('')
  })
})
