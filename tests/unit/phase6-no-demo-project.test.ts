import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A identidade falsa do portal nao volta.
 *
 * Ate a FASE 5, `DEMO_PROJECT_ID` era `hartmann.PROJECT.id` e decidia QUEM via
 * O QUE: `/portal` redirecionava para ele, `assertProject()` comparava com ele,
 * e `/bem-vindo` mostrava "Hartmann · Social Media" para qualquer pessoa
 * autenticada. Nao era mock de dado — era mock de IDENTIDADE.
 *
 * Este teste le o codigo-fonte, e nao uma lista transcrita, pela mesma razao de
 * `phase5-messages`: uma lista envelheceria no dia em que alguem reintroduzisse
 * a constante, que e exatamente o dia em que o teste precisa falhar.
 *
 * COMENTARIOS CONTAM COMO PROSA. O que o teste procura e a constante VIVA —
 * declaracao, importacao ou uso — e nao a palavra escrita numa explicacao
 * historica. Por isso ele casa contra o codigo com os comentarios removidos.
 */

/*
 * `process.cwd()`, e nao `import.meta.url`: a suite `unit` roda em jsdom, e la
 * o `import.meta.url` do modulo nao e uma URL `file:` no momento em que o
 * arquivo e avaliado. O Vitest roda a partir da raiz do repositorio.
 */
const SRC = join(process.cwd(), 'src')

function arquivosDe(dir: string, exts = ['.ts', '.tsx']): string[] {
  const saida: string[] = []

  for (const nome of readdirSync(dir)) {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) {
      saida.push(...arquivosDe(caminho, exts))
    } else if (exts.some((ext) => nome.endsWith(ext))) {
      saida.push(caminho)
    }
  }

  return saida
}

/** Remove comentarios de bloco e de linha, e strings de template JSX. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const FONTES = arquivosDe(SRC).map((caminho) => ({
  caminho: caminho.slice(SRC.length + 1),
  codigo: semComentarios(readFileSync(caminho, 'utf8')),
}))

describe('DEMO_PROJECT_ID foi removido', () => {
  it('a suite esta lendo arquivos de verdade', () => {
    /* Guarda contra o teste virar tautologia se a varredura quebrar. */
    expect(FONTES.length).toBeGreaterThan(40)
  })

  it('nenhum arquivo declara, importa ou usa a constante', () => {
    const culpados = FONTES.filter((f) => f.codigo.includes('DEMO_PROJECT_ID')).map(
      (f) => f.caminho,
    )
    expect(culpados, `DEMO_PROJECT_ID vivo em: ${culpados.join(', ')}`).toEqual([])
  })

  it('nenhum id de projeto hardcoded sobrou nas superficies do portal', () => {
    const culpados = FONTES.filter(
      (f) => f.caminho.startsWith('app/') && /['"`]hartmann-social['"`]/.test(f.codigo),
    ).map((f) => f.caminho)

    expect(culpados).toEqual([])
  })
})

describe('as superficies desta fase nao falam com os mocks', () => {
  /**
   * As telas que passaram a ler o banco. As de conteudo, estrategia, arquivos,
   * reunioes, resultados e onboarding continuam em mock ate a fase de cada
   * dominio, e por isso NAO estao nesta lista.
   */
  const SUPERFICIES_REAIS = [
    'app/(portal)/portal/page.tsx',
    'app/(portal)/portal/[projectId]/layout.tsx',
    'app/(portal)/portal/[projectId]/not-found.tsx',
    'app/(auth)/bem-vindo/page.tsx',
    'domains/projects/queries.ts',
    'domains/projects/mutations.ts',
  ]

  it.each(SUPERFICIES_REAIS)('%s nao importa src/mocks', (caminho) => {
    const arquivo = FONTES.find((f) => f.caminho === caminho.replaceAll('/', '/'))
    expect(arquivo, `arquivo nao encontrado: ${caminho}`).toBeDefined()
    expect(arquivo!.codigo).not.toContain('@/mocks')
  })

  /*
   * Na FASE 6 a fronteira unica era `lib/data/portal.ts`: um arquivo so podia
   * tocar os mocks. Na FASE 8 os mocks morreram e a camada foi junto, entao a
   * afirmacao passou de "so um importa" para "ninguem importa".
   */
  it('⚠️ NINGUEM importa os mocks — eles nao existem mais', () => {
    const importadores = FONTES.filter((f) => f.codigo.includes("from '@/mocks")).map(
      (f) => f.caminho,
    )
    expect(importadores).toEqual([])
  })

  it('nenhuma TELA importa os mocks direto (a regra do CLAUDE.md)', () => {
    const telas = FONTES.filter(
      (f) => f.caminho.startsWith('app/') && f.codigo.includes("from '@/mocks"),
    ).map((f) => f.caminho)

    expect(telas).toEqual([])
  })
})

describe('a jornada nao virou percentual', () => {
  it('nenhum componente de jornada calcula porcentagem', () => {
    const suspeitos = FONTES.filter(
      (f) =>
        (f.caminho.includes('journey') || f.caminho.includes('project-journey')) &&
        /\/\s*(stages|total)\.length\s*\)?\s*\*\s*100|Math\.round\([^)]*100/.test(f.codigo),
    ).map((f) => f.caminho)

    expect(suspeitos, 'a jornada e o progresso; percentual nao entra').toEqual([])
  })
})
