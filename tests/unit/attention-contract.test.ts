import { describe, expect, it } from 'vitest'
import { resolveAttention } from '@/domains/attention/resolve'
import type { SourceOutcome } from '@/domains/attention/types'
import { item } from '../support/attention-items'

/**
 * As invariantes do contrato.
 *
 * Elas não são documentação com teste: são o teste. A regra que separa calma de
 * degradação é a regra de honestidade da fase, e ela mora em um lugar só —
 * `resolveAttention()` — justamente para poder ser cercada aqui.
 */

const ok = (...items: ReturnType<typeof item>[]): SourceOutcome => ({ ok: true, items })
const falhou: SourceOutcome = { ok: false }

describe('calma exige verificação completa', () => {
  it('SUCCESS + zero itens → calm', () => {
    const r = resolveAttention([ok()], 1)

    expect(r.state).toBe('calm')
    expect(r.items).toEqual([])
    expect(r.complete).toBe(true)
    expect(r.failed).toBe(0)
  })

  it('⚠️ FALHA + zero itens → degraded, NUNCA calm', () => {
    const r = resolveAttention([falhou], 1)

    expect(r.state).toBe('degraded')
    expect(r.items).toEqual([])
    expect(r.complete).toBe(false)
    expect(r.failed).toBe(1)
  })

  it('sucesso + item → attention', () => {
    const r = resolveAttention([ok(item())], 1)

    expect(r.state).toBe('attention')
    expect(r.items).toHaveLength(1)
    expect(r.complete).toBe(true)
  })

  it('⚠️ item de uma source + falha de outra → attention com complete=false', () => {
    /*
     * Mostrar o que se sabe é melhor do que esconder por causa do que não se
     * sabe — desde que não se afirme completude. A UI acrescenta um aviso
     * discreto quando `complete` é falso; ela NÃO some com o item verdadeiro.
     */
    const r = resolveAttention([ok(item()), falhou], 2)

    expect(r.state).toBe('attention')
    expect(r.items).toHaveLength(1)
    expect(r.complete).toBe(false)
    expect(r.failed).toBe(1)
  })

  it('nenhuma source relevante → calm, não degraded', () => {
    /*
     * Projeto pausado, concluído, ou sem source aplicável: não há o que
     * verificar, então não há incerteza a comunicar.
     */
    const r = resolveAttention([], 0)

    expect(r.state).toBe('calm')
    expect(r.evaluated).toBe(0)
    expect(r.failed).toBe(0)
    expect(r.complete).toBe(true)
  })

  it('todas as sources falham → degraded, com a contagem', () => {
    const r = resolveAttention([falhou, falhou], 2)

    expect(r.state).toBe('degraded')
    expect(r.failed).toBe(2)
    expect(r.evaluated).toBe(2)
  })
})

describe('as invariantes valem para toda combinação', () => {
  const combinacoes: SourceOutcome[][] = [
    [],
    [ok()],
    [falhou],
    [ok(item())],
    [ok(item()), falhou],
    [ok(), falhou],
    [falhou, falhou],
    [ok(item()), ok(item({ projectId: 'outro' }))],
    [ok(item()), ok()],
  ]

  it.each(combinacoes.map((c, i) => [i, c] as const))(
    'combinação %i respeita as cinco invariantes',
    (_i, outcomes) => {
      const r = resolveAttention(outcomes, outcomes.length)

      if (r.state === 'calm') {
        expect(r.items).toHaveLength(0)
        expect(r.complete).toBe(true)
        expect(r.failed).toBe(0)
      }

      if (r.state === 'degraded') {
        expect(r.items).toHaveLength(0)
        expect(r.complete).toBe(false)
        expect(r.failed).toBeGreaterThan(0)
      }

      if (r.state === 'attention') {
        expect(r.items.length).toBeGreaterThan(0)
      }

      expect(r.complete).toBe(r.failed === 0)
      expect(r.evaluated).toBeGreaterThanOrEqual(r.failed)
    },
  )
})
