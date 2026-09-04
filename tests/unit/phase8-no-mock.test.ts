import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A ficção não alcança o cliente.
 *
 * Mesma forma de `phase6-no-demo-project.test.ts` e de
 * `phase7-no-onboarding-mock.test.ts`, e pela mesma razão: o mock some do
 * repositório em um commit e volta por engano num `git revert` ou num merge mal
 * resolvido. Este teste LÊ o código-fonte, então ele quebra no dia em que a
 * ficção voltar — não no dia em que um cliente a lê no ambiente hospedado.
 *
 * O que ele afirma não é estilo. É a regra da FASE 8:
 *
 *     CLIENT-FACING DATA MUST BE REAL.
 */

/*
 * `process.cwd()`, e nao `import.meta.url`: a suite `unit` roda em jsdom, e la
 * o `import.meta.url` do modulo nao e uma URL `file:`.
 */
const RAIZ = resolve(process.cwd(), 'src')

function arquivos(dir: string): string[] {
  const encontrados: string[] = []

  for (const entrada of readdirSync(dir)) {
    const caminho = `${dir}/${entrada}`
    if (statSync(caminho).isDirectory()) {
      encontrados.push(...arquivos(caminho))
    } else if (/\.tsx?$/.test(entrada)) {
      encontrados.push(caminho)
    }
  }

  return encontrados
}

const TODOS = arquivos(RAIZ)
const relativo = (caminho: string) => caminho.slice(RAIZ.length + 1)
const conteudo = (caminho: string) => readFileSync(caminho, 'utf8')

const HOME = `${RAIZ}/app/(portal)/portal/[projectId]/page.tsx`

describe('o varredor funciona', () => {
  it('guarda contra o teste virar tautologia: acha arquivos de verdade', () => {
    expect(TODOS.length).toBeGreaterThan(50)
    expect(TODOS).toContain(HOME)
  })
})

describe('a Home não lê ficção', () => {
  /*
   * Os quatro loaders que liam `src/mocks/hartmann.ts` e desenhavam a Home
   * como se fossem dado real. Cada um tem um motivo próprio para não voltar:
   * atenção passou a ser derivada, e os outros três não têm origem no schema.
   */
  const MOCKADOS = [
    'getAttention',
    'getNextDelivery',
    'getNextMeeting',
    'getDashboardInsight',
  ] as const

  it.each(MOCKADOS)('⚠️ a Home não chama `%s()`', (loader) => {
    expect(new RegExp(`\\b${loader}\\b`).test(conteudo(HOME))).toBe(false)
  })

  it('⚠️ a Home não importa `src/mocks`', () => {
    expect(/from '@\/mocks/.test(conteudo(HOME))).toBe(false)
  })

  it('nenhuma tela importa `src/mocks` — a fronteira é `src/lib/data`', () => {
    const culpados = TODOS.filter((caminho) => {
      const eTela = /\/(app|components|domains)\//.test(caminho)
      return eTela && /from '@\/mocks/.test(conteudo(caminho))
    })

    expect(culpados.map(relativo), 'tela importando mock').toEqual([])
  })
})
