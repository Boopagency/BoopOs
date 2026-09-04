import { describe, expect, it } from 'vitest'
import { journeyGlance, journeyState } from '@/domains/projects/journey'
import type { StageState } from '@/config/enums'
import type { ProjectStage } from '@/domains/projects/types'

/**
 * Os recortes da jornada resumida.
 *
 * Todos deriváveis de `project_stages` — nenhum inventa estado. A janela é por
 * POSIÇÃO, e não por estado: uma etapa pulada entra no resumo com o rótulo
 * dela, porque esconder do cliente uma etapa que a Boop decidiu pular seria
 * editar a história do projeto na tela dele.
 */

function jornada(estados: StageState[]): ProjectStage[] {
  return estados.map((state, i) => ({
    id: `s${i}`,
    key: `etapa-${i}`,
    label: `Etapa ${i}`,
    position: i + 1,
    state,
    summary: null,
    completedOn: null,
  }))
}

const chaves = (stages: readonly ProjectStage[]) => stages.map((s) => s.key)

describe('a janela acompanha a etapa corrente', () => {
  it('no meio: anterior · atual · próxima', () => {
    const stages = jornada(['done', 'done', 'current', 'pending', 'pending'])

    expect(chaves(journeyGlance(stages))).toEqual(['etapa-1', 'etapa-2', 'etapa-3'])
  })

  it('na primeira: encosta no começo, sem anterior', () => {
    const stages = jornada(['current', 'pending', 'pending', 'pending'])

    expect(chaves(journeyGlance(stages))).toEqual(['etapa-0', 'etapa-1', 'etapa-2'])
  })

  it('na última: encosta no fim, sem próxima', () => {
    const stages = jornada(['done', 'done', 'done', 'current'])

    expect(chaves(journeyGlance(stages))).toEqual(['etapa-1', 'etapa-2', 'etapa-3'])
  })

  it('⚠️ etapa pulada entra no resumo — não se esconde etapa do cliente', () => {
    const stages = jornada(['done', 'skipped', 'current', 'pending'])

    expect(chaves(journeyGlance(stages))).toEqual(['etapa-1', 'etapa-2', 'etapa-3'])
    expect(journeyGlance(stages)[0]?.state).toBe('skipped')
  })
})

describe('sem etapa corrente, a janela se apoia no que é verdade', () => {
  it('jornada concluída → as três últimas', () => {
    const stages = jornada(['done', 'done', 'done', 'done', 'done'])

    expect(journeyState(stages)).toBe('complete')
    expect(chaves(journeyGlance(stages))).toEqual(['etapa-2', 'etapa-3', 'etapa-4'])
  })

  it('nada começou → as três primeiras', () => {
    const stages = jornada(['pending', 'pending', 'pending', 'pending'])

    expect(journeyState(stages)).toBe('stalled')
    expect(chaves(journeyGlance(stages))).toEqual(['etapa-0', 'etapa-1', 'etapa-2'])
  })

  it('entre etapas → a primeira que falta, com a anterior', () => {
    const stages = jornada(['done', 'done', 'pending', 'pending', 'pending'])

    expect(journeyState(stages)).toBe('stalled')
    expect(chaves(journeyGlance(stages))).toEqual(['etapa-1', 'etapa-2', 'etapa-3'])
  })

  it('tudo pulado conta como resolvido → encosta no fim', () => {
    const stages = jornada(['skipped', 'skipped', 'skipped', 'skipped'])

    expect(journeyState(stages)).toBe('complete')
    expect(chaves(journeyGlance(stages))).toEqual(['etapa-1', 'etapa-2', 'etapa-3'])
  })
})

describe('bordas de tamanho', () => {
  it('jornada vazia → nada, e o bloco some da Home', () => {
    expect(journeyGlance([])).toEqual([])
    expect(journeyState([])).toBe('empty')
  })

  it('uma etapa só → ela mesma', () => {
    expect(chaves(journeyGlance(jornada(['current'])))).toEqual(['etapa-0'])
  })

  it('duas etapas → as duas, sem preencher com nada', () => {
    expect(chaves(journeyGlance(jornada(['done', 'current'])))).toEqual(['etapa-0', 'etapa-1'])
  })

  it('nunca devolve mais que o tamanho pedido', () => {
    const stages = jornada(['done', 'done', 'current', 'pending', 'pending', 'pending', 'pending'])

    expect(journeyGlance(stages)).toHaveLength(3)
  })

  it('a ordem é sempre a de posição, mesmo com a entrada embaralhada', () => {
    const stages = jornada(['done', 'done', 'current', 'pending', 'pending'])
    const embaralhada = [...stages].reverse()

    expect(chaves(journeyGlance(embaralhada))).toEqual(['etapa-1', 'etapa-2', 'etapa-3'])
  })

  it('a jornada completa da social (8 etapas) cabe em 3 na Home', () => {
    const social = jornada([
      'done',
      'done',
      'done',
      'current',
      'pending',
      'pending',
      'pending',
      'pending',
    ])

    expect(journeyGlance(social)).toHaveLength(3)
    expect(chaves(journeyGlance(social))).toEqual(['etapa-2', 'etapa-3', 'etapa-4'])
  })
})
