import { describe, expect, it } from 'vitest'
import { byPriority, resolveAttention } from '@/domains/attention/resolve'
import { PRIORITY } from '@/config/attention'
import type { AttentionKind } from '@/domains/attention/types'
import { item } from '../support/attention-items'

describe('a ordem é determinística', () => {
  it('prioridade menor vem primeiro', () => {
    const urgente = item({ id: 'a', priority: 10 })
    const depois = item({ id: 'b', priority: 30 })

    expect([depois, urgente].sort(byPriority).map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('empatada a prioridade, prazo mais próximo vem primeiro', () => {
    const cedo = item({ id: 'a', dueAt: '2026-09-10' })
    const tarde = item({ id: 'b', dueAt: '2026-09-20' })

    expect([tarde, cedo].sort(byPriority).map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('item sem prazo vai por último', () => {
    const semPrazo = item({ id: 'a', dueAt: null })
    const comPrazo = item({ id: 'b', dueAt: '2026-09-20' })

    expect([semPrazo, comPrazo].sort(byPriority).map((i) => i.id)).toEqual(['b', 'a'])
  })

  it('empatado tudo, o id desempata — a ordem nunca fica ambígua', () => {
    const a = item({ id: 'a' })
    const b = item({ id: 'b' })

    expect([b, a].sort(byPriority).map((i) => i.id)).toEqual(['a', 'b'])
    expect([a, b].sort(byPriority).map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('⚠️ a mesma entrada embaralhada produz a mesma saída', () => {
    /*
     * As sources rodam em `Promise.all`: a ordem de chegada não é garantida.
     * Sem desempate total, este teste falharia de vez em quando — e teste
     * intermitente é pior que teste ausente.
     */
    const itens = [
      item({ id: 'c', priority: 30 }),
      item({ id: 'a', priority: 10, dueAt: '2026-09-01' }),
      item({ id: 'b', priority: 10, dueAt: null }),
      item({ id: 'd', priority: 30 }),
    ]

    const esperado = ['a', 'b', 'c', 'd']

    expect([...itens].sort(byPriority).map((i) => i.id)).toEqual(esperado)
    expect(
      [...itens]
        .reverse()
        .sort(byPriority)
        .map((i) => i.id),
    ).toEqual(esperado)
  })

  it('o resultado já vem ordenado — o componente não ordena nada', () => {
    const r = resolveAttention(
      [
        { ok: true, items: [item({ id: 'z', priority: 30 })] },
        { ok: true, items: [item({ id: 'a', priority: 10 })] },
      ],
      2,
    )

    expect(r.items.map((i) => i.id)).toEqual(['a', 'z'])
  })
})

describe('a tabela de prioridade', () => {
  const kinds = Object.keys(PRIORITY) as AttentionKind[]

  it('tem exatamente os kinds que existem na FASE 8', () => {
    expect(kinds).toEqual(['onboarding.continue'])
  })

  it('⚠️ nenhum kind foi antecipado de fase futura', () => {
    const futuros = ['strategy.approve', 'content.approve', 'file.requested', 'meeting.upcoming']

    for (const futuro of futuros) {
      expect(kinds).not.toContain(futuro)
    }
  })

  it('nenhuma prioridade repetida', () => {
    const valores = Object.values(PRIORITY)
    expect(new Set(valores).size).toBe(valores.length)
  })

  it('onboarding fica na faixa que destrava o projeto (00–19)', () => {
    expect(PRIORITY['onboarding.continue']).toBeGreaterThanOrEqual(0)
    expect(PRIORITY['onboarding.continue']).toBeLessThan(20)
  })
})

describe('o id é estável e não carrega PII', () => {
  it('deriva de kind + projeto, e é o mesmo entre chamadas', () => {
    expect(item().id).toBe(item().id)
    expect(item().id).toMatch(/^onboarding\.continue:/)
  })

  it('ids são únicos dentro de um resultado', () => {
    const r = resolveAttention([{ ok: true, items: [item({ id: 'a' }), item({ id: 'b' })] }], 1)

    expect(new Set(r.items.map((i) => i.id)).size).toBe(r.items.length)
  })

  it('⚠️ o id não contém e-mail nem nome', () => {
    expect(item().id).not.toMatch(/@/)
    expect(item().id).not.toMatch(/[Hh]artmann|[Vv]elmont/)
  })
})
