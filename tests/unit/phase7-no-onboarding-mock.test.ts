import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * O onboarding não é mais ilustração.
 *
 * Mesma forma de `phase6-no-demo-project.test.ts`, e pela mesma razão: o mock
 * some do repositório em um commit, e volta por engano num `git revert` ou num
 * merge mal resolvido. Este teste LÊ o código-fonte, então ele quebra no dia em
 * que voltar — não no dia em que alguém perceber.
 *
 * O que ele afirma não é estilo. É que a tela do cliente mostra o que está no
 * banco, e nada além disso.
 */

/*
 * `process.cwd()`, e nao `import.meta.url`: a suite `unit` roda em jsdom, e la
 * o `import.meta.url` do modulo nao e uma URL `file:` — mesma razao do
 * `phase6-no-demo-project.test.ts`.
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

function conteudo(caminho: string) {
  return readFileSync(caminho, 'utf8')
}

/**
 * O código sem os comentários.
 *
 * Este repositório documenta decisões DENTRO do arquivo, e vários comentários
 * citam a chamada que explicam ("por isso não usa `ctx.activity()`"). Um teste
 * que procura chamada no texto cru acusaria a explicação de ser a infração.
 */
function codigo(caminho: string) {
  return conteudo(caminho)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
}

describe('o mock de onboarding morreu', () => {
  it('guarda contra o teste virar tautologia: o varredor acha arquivos', () => {
    expect(TODOS.length).toBeGreaterThan(50)
  })

  it('⚠️ `ONBOARDING` não existe mais em `src/mocks`', () => {
    const mock = conteudo(`${RAIZ}/mocks/hartmann.ts`)

    expect(/export const ONBOARDING\b/.test(mock), 'o mock de onboarding voltou').toBe(false)
    expect(/OnboardingSection/.test(mock)).toBe(false)
  })

  it('⚠️ ninguém importa `hartmann.ONBOARDING`', () => {
    const culpados = TODOS.filter((caminho) => /hartmann\.ONBOARDING/.test(conteudo(caminho)))
    expect(culpados.map(relativo)).toEqual([])
  })

  it('⚠️ `getOnboarding()` não existe: o domínio tem query própria', () => {
    const portal = conteudo(`${RAIZ}/lib/data/portal.ts`)
    expect(/export async function getOnboarding\b/.test(portal)).toBe(false)
  })

  it('nenhum componente ou página importa `src/mocks`', () => {
    /*
     * A regra vale para o repositório inteiro, e não só para o onboarding: a
     * fronteira é `src/lib/data`, e nenhuma tela atravessa ela.
     */
    const culpados = TODOS.filter((caminho) => {
      const eTela = /\/(app|components|domains)\//.test(caminho)
      return eTela && /from '@\/mocks/.test(conteudo(caminho))
    })

    expect(culpados.map(relativo), 'tela importando mock').toEqual([])
  })
})

describe('o protótipo morreu junto', () => {
  it('⚠️ nenhuma tela diz que as respostas não são salvas', () => {
    const culpados = TODOS.filter((caminho) => {
      const texto = conteudo(caminho)
      return /Protótipo: as respostas/.test(texto) || /respostas não são salvas/.test(texto)
    })

    expect(culpados.map(relativo), 'o aviso do protótipo continua na tela').toEqual([])
  })

  it('o componente de protótipo não existe mais', () => {
    const sobrou = TODOS.filter((caminho) => /patterns\/onboarding-flow\.tsx$/.test(caminho))
    expect(sobrou.map(relativo)).toEqual([])
  })

  it('⚠️ o estado de "enviado" NÃO vem de `useState`', () => {
    /*
     * O protótipo tinha `const [done, setDone] = useState(false)` e mostrava
     * "Recebemos tudo" a partir dele: recarregar a página voltava ao
     * formulário. Agora quem responde isso é o `status` da submissão, lido do
     * banco pela página — e por isso a confirmação vive em um componente de
     * SERVIDOR, sem estado nenhum.
     */
    const form = conteudo(`${RAIZ}/domains/onboarding/components/onboarding-form.tsx`)
    expect(/useState[^\n]*\bdone\b/.test(form), 'voltou o `done` local').toBe(false)

    const estados = conteudo(`${RAIZ}/domains/onboarding/components/onboarding-states.tsx`)
    expect(/'use client'/.test(estados), 'a confirmação virou Client Component').toBe(false)
    expect(/Recebemos tudo/.test(estados)).toBe(true)
  })
})

describe('o domínio de onboarding respeita as fronteiras', () => {
  const DOMINIO = TODOS.filter((caminho) => caminho.includes('/domains/onboarding/'))

  it('existe, e é mais do que um arquivo', () => {
    expect(DOMINIO.length).toBeGreaterThan(4)
  })

  it('⚠️ ZERO `service_role` — nenhum arquivo importa o cliente admin', () => {
    const culpados = DOMINIO.filter((caminho) =>
      /from '@\/lib\/supabase\/admin'/.test(conteudo(caminho)),
    )
    expect(culpados.map(relativo), 'onboarding usando service_role').toEqual([])
  })

  it('⚠️ nenhuma leitura usa `select *`', () => {
    const culpados = DOMINIO.filter((caminho) => /\.select\(\s*'\*'/.test(codigo(caminho)))
    expect(culpados.map(relativo)).toEqual([])
  })

  it('toda escrita passa por `defineWorkflow` — a action não decide nada', () => {
    const actions = codigo(`${RAIZ}/domains/onboarding/actions.ts`)

    /* A action só adapta a entrada e delega. Nenhuma consulta, nenhum `can()`. */
    expect(/createSupabaseServerClient|\.from\(|\bcan\(/.test(actions)).toBe(false)

    const mutations = codigo(`${RAIZ}/domains/onboarding/mutations.ts`)
    const workflows = mutations.match(/defineWorkflow\(/g) ?? []
    expect(workflows.length, 'os quatro workflows da fase').toBe(4)
  })

  it('⚠️ o ciclo de vida não é escrito por `supabase-js` em lugar nenhum', () => {
    /*
     * `onboarding_submissions` não tem mais GRANT de INSERT nem de UPDATE. Uma
     * chamada dessas falharia em produção com "permission denied" — e este
     * teste é o que a encontra antes.
     */
    const culpados = TODOS.filter((caminho) =>
      /from\('onboarding_submissions'\)\s*\.\s*(insert|update|upsert|delete)/.test(codigo(caminho)),
    )
    expect(culpados.map(relativo), 'escrita direta na submissão').toEqual([])
  })

  it('o autosave NÃO registra activity', () => {
    /*
     * `ctx.activity()` não é CHAMADA em nenhum dos quatro: os três que mudam o
     * ciclo de vida gravam de dentro da função SQL, e o autosave não grava
     * nada. Uma chamada aqui produziria duas linhas para um evento, ou centenas
     * para um formulário sendo preenchido.
     */
    const mutations = codigo(`${RAIZ}/domains/onboarding/mutations.ts`)

    expect(/ctx\.activity\(/.test(mutations), 'activity duplicada ou ruidosa').toBe(false)
  })
})
