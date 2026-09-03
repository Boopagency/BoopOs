import { describe, expect, it } from 'vitest'
import { QUESTION_TYPES } from '@/config/enums'
import {
  isAnswerPresent,
  isAnswerShapeValid,
  isRenderableType,
  missingRequired,
  RENDERABLE_QUESTION_TYPES,
} from '@/domains/onboarding/answers'
import type { OnboardingQuestion } from '@/domains/onboarding/types'
import { ANSWER_CASES } from '../support/answer-cases'

/**
 * A semântica de resposta, do lado do TypeScript.
 *
 * A tabela de casos é a MESMA que `tests/rls/phase7-answer-integrity.test.ts`
 * roda contra o Postgres, e é lá que a paridade entre as duas implementações é
 * afirmada. Aqui provamos o comportamento; lá, que ele é o mesmo dos dois lados.
 */

describe('forma do valor por tipo', () => {
  for (const caso of ANSWER_CASES) {
    it(`${caso.nome} → forma ${caso.valida ? 'válida' : 'inválida'}`, () => {
      expect(isAnswerShapeValid(caso.type, caso.options, caso.value)).toBe(caso.valida)
    })
  }
})

describe('preenchimento por tipo', () => {
  for (const caso of ANSWER_CASES) {
    it(`${caso.nome} → ${caso.presente ? 'preenchida' : 'vazia'}`, () => {
      expect(isAnswerPresent(caso.type, caso.value)).toBe(caso.presente)
    })
  }

  it('⚠️ os dois falsy que SÃO resposta não são recusados por truthiness', () => {
    /*
     * O bug clássico deste formulário, escrito como teste: `if (!value)` diria
     * que uma obrigatória booleana respondida com "Não" está vazia, e barraria
     * o envio de alguém que respondeu.
     */
    expect(isAnswerPresent('boolean', false)).toBe(true)
    expect(isAnswerPresent('number', 0)).toBe(true)

    expect(Boolean(false), 'truthiness discordaria').toBe(false)
    expect(Boolean(0), 'truthiness discordaria').toBe(false)
  })

  it('undefined — a pergunta que ninguém tocou — está vazia em todo tipo', () => {
    for (const type of QUESTION_TYPES) {
      expect(isAnswerPresent(type, undefined), type).toBe(false)
    }
  })
})

describe('tipos renderizáveis', () => {
  it('cobre todo o enum menos `file`', () => {
    const adiados = QUESTION_TYPES.filter((type) => !isRenderableType(type))
    expect(adiados, 'só `file` fica para a FASE 12 (I-05)').toEqual(['file'])
  })

  it('não inventa tipo que o banco não conhece', () => {
    for (const type of RENDERABLE_QUESTION_TYPES) {
      expect(QUESTION_TYPES).toContain(type)
    }
  })

  it('⚠️ um tipo NOVO no enum nasce não-renderizável — fail closed', () => {
    /*
     * O dia em que alguém acrescentar `date` ao enum e esquecer a tela: a
     * pergunta aparece como indisponível, e não como um input que grava lixo.
     */
    expect(isRenderableType('file')).toBe(false)
    expect(isAnswerShapeValid('file', [], 'qualquer coisa')).toBe(false)
  })
})

describe('obrigatórias faltantes', () => {
  const pergunta = (
    id: string,
    type: OnboardingQuestion['type'],
    required: boolean,
  ): OnboardingQuestion => ({
    id,
    key: id,
    label: id,
    help: null,
    type,
    required,
    options: [],
    position: 1,
  })

  it('devolve só as obrigatórias vazias, na ordem do formulário', () => {
    const perguntas = [
      pergunta('a', 'long_text', true),
      pergunta('b', 'short_text', false),
      pergunta('c', 'long_text', true),
      pergunta('d', 'boolean', true),
    ]

    const faltando = missingRequired(perguntas, { a: 'respondida', d: false })

    /* `c` falta; `d` foi respondida com `false`, que é resposta; `b` é opcional. */
    expect(faltando.map((q) => q.id)).toEqual(['c'])
  })

  it('a ORDEM é a do formulário — o foco vai para a primeira, não a última', () => {
    const perguntas = [
      pergunta('primeira', 'long_text', true),
      pergunta('segunda', 'long_text', true),
    ]

    expect(missingRequired(perguntas, {}).map((q) => q.id)).toEqual(['primeira', 'segunda'])
  })

  it('rascunho inteiro vazio: todas as obrigatórias faltam, e nenhuma opcional', () => {
    const perguntas = [
      pergunta('obrigatoria', 'long_text', true),
      pergunta('opcional', 'long_text', false),
    ]

    expect(missingRequired(perguntas, {}).map((q) => q.id)).toEqual(['obrigatoria'])
  })
})
