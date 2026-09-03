/**
 * FASE 6 — o catalogo de jornadas e a derivacao da jornada.
 *
 * Duas coisas distintas, testadas juntas porque uma so tem sentido com a outra:
 * o TEMPLATE (codigo, ADR-0006) e a INSTANCIA (linhas do banco). O que este
 * arquivo prova sem banco e o contrato do template e a logica pura que le a
 * instancia.
 */
import { describe, expect, it } from 'vitest'
import { PROJECT_TYPES, type ProjectType } from '@/config/enums'
import {
  CREATABLE_JOURNEY_KEYS,
  JOURNEY_BY_TYPE,
  JOURNEY_TEMPLATES,
  journeyByKey,
  journeyForType,
  stageSummary,
} from '@/config/journeys'
import {
  currentStage,
  journeyState,
  nextStage,
  sortStages,
  stageTally,
} from '@/domains/projects/journey'
import type { ProjectStage } from '@/domains/projects/types'

/** Monta uma etapa com o minimo; o resto e default sensato para o caso. */
function etapa(partial: Partial<ProjectStage> & { position: number }): ProjectStage {
  return {
    id: `stage-${partial.position}`,
    key: partial.key ?? `k${partial.position}`,
    label: partial.label ?? `Etapa ${partial.position}`,
    state: partial.state ?? 'pending',
    summary: partial.summary ?? 'resumo',
    completedOn: partial.completedOn ?? null,
    ...partial,
  }
}

describe('catalogo de jornadas', () => {
  it('TODO project_type tem um template, e ele existe no catalogo', () => {
    for (const type of PROJECT_TYPES) {
      const key = JOURNEY_BY_TYPE[type]
      expect(key, `${type} sem journey_key`).toBeTruthy()
      expect(JOURNEY_TEMPLATES[key], `${key} nao esta em JOURNEY_TEMPLATES`).toBeDefined()
    }
  })

  it('cada template declara o tipo que ele serve, sem cruzar', () => {
    for (const type of PROJECT_TYPES) {
      expect(journeyForType(type).type).toBe(type)
    }
  })

  it('as chaves de template sao unicas', () => {
    const keys = Object.values(JOURNEY_TEMPLATES).map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('a chave do template bate com a chave do indice', () => {
    for (const [indice, template] of Object.entries(JOURNEY_TEMPLATES)) {
      expect(template.key).toBe(indice)
    }
  })

  it('nenhum template e vazio: projeto sem etapa nao existe', () => {
    for (const template of Object.values(JOURNEY_TEMPLATES)) {
      expect(template.stages.length, `${template.key} sem etapas`).toBeGreaterThan(0)
    }
  })

  it('stage_key e unica DENTRO de cada template (o banco tem unique)', () => {
    for (const template of Object.values(JOURNEY_TEMPLATES)) {
      const keys = template.stages.map((s) => s.key)
      expect(new Set(keys).size, `${template.key} tem stage_key repetida`).toBe(keys.length)
    }
  })

  it('toda etapa tem label e summary preenchidos', () => {
    for (const template of Object.values(JOURNEY_TEMPLATES)) {
      for (const stage of template.stages) {
        expect(stage.label.trim().length, `${template.key}/${stage.key}`).toBeGreaterThan(0)
        expect(stage.summary.trim().length, `${template.key}/${stage.key}`).toBeGreaterThan(0)
      }
    }
  })

  it('a chave de cada etapa e minuscula com underscore — vocabulario estavel', () => {
    for (const template of Object.values(JOURNEY_TEMPLATES)) {
      for (const stage of template.stages) {
        expect(stage.key).toMatch(/^[a-z][a-z_]*$/)
      }
    }
  })

  it('social.v1 tem as OITO etapas de docs/product.md, na ordem de la', () => {
    /*
     * O mock do prototipo tinha SEIS, sem `kickoff` e sem `onboarding`. Ele era
     * ilustracao de tela; a especificacao e o documento. Este teste e o que
     * impede o mock voltar a decidir a jornada.
     */
    expect(journeyForType('social').stages.map((s) => s.key)).toEqual([
      'kickoff',
      'onboarding',
      'immersion',
      'research',
      'strategy',
      'production',
      'publishing',
      'review',
    ])
  })

  it('os quatro tipos nao-social tem jornada propria — a arquitetura nao depende de social', () => {
    const naoSocial = PROJECT_TYPES.filter((t): t is ProjectType => t !== 'social')

    for (const type of naoSocial) {
      const stages = journeyForType(type).stages
      expect(stages.length, `${type} sem jornada`).toBeGreaterThanOrEqual(3)
      /* Se um deles tivesse copiado social, a arquitetura dependeria dela. */
      expect(stages.map((s) => s.key)).not.toContain('publishing')
    }
  })

  it('CREATABLE_JOURNEY_KEYS cobre exatamente os tipos criaveis', () => {
    expect([...CREATABLE_JOURNEY_KEYS].sort()).toEqual(
      PROJECT_TYPES.map((t) => JOURNEY_BY_TYPE[t]).sort(),
    )
  })

  it('journeyByKey devolve null para chave desconhecida, e nao lanca', () => {
    expect(journeyByKey('nao.existe')).toBeNull()
  })
})

describe('stageSummary — o fallback que nao quebra a tela', () => {
  it('resolve o texto quando a chave existe', () => {
    expect(stageSummary('social.v1', 'kickoff')).toContain('Combinamos')
  })

  it('devolve null para template aposentado — nao inventa texto', () => {
    expect(stageSummary('social.v0', 'kickoff')).toBeNull()
  })

  it('devolve null para etapa removida do template', () => {
    expect(stageSummary('social.v1', 'etapa_que_nao_existe_mais')).toBeNull()
  })

  it('nao vaza etapa de um template para outro', () => {
    /* `publishing` e de social; um projeto de site nao deve receber o texto. */
    expect(stageSummary('website.v1', 'publishing')).toBeNull()
  })
})

describe('derivacao da jornada', () => {
  const jornada: ProjectStage[] = [
    etapa({ position: 1, key: 'a', state: 'done', completedOn: '2026-01-10' }),
    etapa({ position: 2, key: 'b', state: 'skipped' }),
    etapa({ position: 3, key: 'c', state: 'current' }),
    etapa({ position: 4, key: 'd', state: 'pending' }),
    etapa({ position: 5, key: 'e', state: 'pending' }),
  ]

  it('ordena por position, e nao pela ordem de chegada', () => {
    const embaralhada = [jornada[3]!, jornada[0]!, jornada[4]!, jornada[2]!, jornada[1]!]
    expect(sortStages(embaralhada).map((s) => s.position)).toEqual([1, 2, 3, 4, 5])
  })

  it('a etapa corrente vem de state, nao de heuristica', () => {
    expect(currentStage(jornada)?.key).toBe('c')
  })

  it('a proxima e a MENOR position pendente acima da corrente', () => {
    expect(nextStage(jornada)?.key).toBe('d')
  })

  it('uma etapa PULADA nunca e a proxima', () => {
    const comPuladaAdiante: ProjectStage[] = [
      etapa({ position: 1, key: 'a', state: 'current' }),
      etapa({ position: 2, key: 'b', state: 'skipped' }),
      etapa({ position: 3, key: 'c', state: 'pending' }),
    ]
    expect(nextStage(comPuladaAdiante)?.key).toBe('c')
  })

  it('sem corrente NAO ha proxima — a pergunta pressupoe de onde sair', () => {
    const semCorrente = jornada.map((s) => ({ ...s, state: 'pending' as const }))
    expect(nextStage(semCorrente)).toBeUndefined()
  })

  it('na ultima etapa nao ha proxima', () => {
    const naUltima: ProjectStage[] = [
      etapa({ position: 1, state: 'done', completedOn: '2026-01-01' }),
      etapa({ position: 2, state: 'current' }),
    ]
    expect(nextStage(naUltima)).toBeUndefined()
  })
})

describe('journeyState — os quatro estados tem nome', () => {
  it('empty: projeto sem etapas', () => {
    expect(journeyState([])).toBe('empty')
  })

  it('in_progress: ha etapa corrente', () => {
    expect(journeyState([etapa({ position: 1, state: 'current' })])).toBe('in_progress')
  })

  it('complete: sem corrente e sem pendente', () => {
    expect(
      journeyState([
        etapa({ position: 1, state: 'done', completedOn: '2026-01-01' }),
        etapa({ position: 2, state: 'skipped' }),
      ]),
    ).toBe('complete')
  })

  it('stalled: sem corrente e COM pendente — o estado que exige conserto', () => {
    expect(
      journeyState([
        etapa({ position: 1, state: 'done', completedOn: '2026-01-01' }),
        etapa({ position: 2, state: 'pending' }),
      ]),
    ).toBe('stalled')
  })

  it('complete e stalled sao DISTINGUIVEIS — as duas tem zero corrente', () => {
    const completa = [etapa({ position: 1, state: 'done', completedOn: '2026-01-01' })]
    const travada = [etapa({ position: 1, state: 'pending' })]

    expect(currentStage(completa)).toBeUndefined()
    expect(currentStage(travada)).toBeUndefined()
    expect(journeyState(completa)).not.toBe(journeyState(travada))
  })
})

describe('stageTally — contagem, nunca percentual', () => {
  it('conta done e skipped como encerradas', () => {
    expect(
      stageTally([
        etapa({ position: 1, state: 'done', completedOn: '2026-01-01' }),
        etapa({ position: 2, state: 'skipped' }),
        etapa({ position: 3, state: 'current' }),
        etapa({ position: 4, state: 'pending' }),
      ]),
    ).toEqual({ settled: 2, total: 4 })
  })

  it('devolve contagem, e nao razao — o produto proibe percentual', () => {
    const resultado = stageTally([etapa({ position: 1, state: 'done', completedOn: 'x' })])
    /* Se um dia alguem trocar por `{ percent: 100 }`, este teste cai. */
    expect(Object.keys(resultado).sort()).toEqual(['settled', 'total'])
    expect(Number.isInteger(resultado.settled)).toBe(true)
  })

  it('jornada vazia nao divide por zero', () => {
    expect(stageTally([])).toEqual({ settled: 0, total: 0 })
  })
})
