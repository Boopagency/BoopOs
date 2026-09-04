import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * A composição da Home, lida do código-fonte.
 *
 * A Home é um Server Component que consulta o banco: renderizá-la em jsdom
 * exigiria dublar Supabase, e um dublê de Supabase não prova composição — prova
 * o dublê. O que importa aqui é o que ela monta e em que ordem, e isso o
 * arquivo responde.
 *
 * Os testes de comportamento dos blocos estão em
 * `tests/component/attention-state.test.tsx` e nos irmãos.
 */

const HOME = resolve(process.cwd(), 'src/app/(portal)/portal/[projectId]/page.tsx')

const fonte = readFileSync(HOME, 'utf8')
/* Comentários explicam a regra; não podem ser acusados de violá-la. */
const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

describe('o varredor está lendo o arquivo certo', () => {
  it('a Home existe e tem conteúdo', () => {
    expect(fonte.length).toBeGreaterThan(500)
    expect(codigo).toContain('export default async function DashboardPage')
  })
})

describe('os quatro blocos, nesta ordem', () => {
  const BLOCOS = ['PortalGreeting', 'AttentionState', 'CurrentStage', 'ProjectJourney'] as const

  it.each(BLOCOS)('renderiza `<%s>`', (bloco) => {
    expect(codigo).toContain(`<${bloco}`)
  })

  it('⚠️ a atenção vem logo depois da saudação', () => {
    const saudacao = codigo.indexOf('<PortalGreeting')
    const atencao = codigo.indexOf('<AttentionState')
    const agora = codigo.indexOf('<CurrentStage')
    const jornada = codigo.indexOf('<ProjectJourney')

    expect(saudacao).toBeLessThan(atencao)
    expect(atencao).toBeLessThan(agora)
    expect(agora).toBeLessThan(jornada)
  })
})

describe('⚠️ nenhum bloco sem origem no banco', () => {
  const SEM_ORIGEM = [
    'DashboardHero',
    'InsightBlock',
    'ContentRow',
    'Próxima entrega',
    'Próximo encontro',
    'aprendendo',
    'activity',
    'Activity',
  ] as const

  it.each(SEM_ORIGEM)('a Home não menciona `%s`', (termo) => {
    expect(codigo).not.toContain(termo)
  })
})

describe('as leituras da Home vêm de domínio, não da camada de mock', () => {
  it('lê atenção, projeto e jornada dos domínios', () => {
    expect(codigo).toContain("from '@/domains/attention/queries'")
    expect(codigo).toContain("from '@/domains/projects/queries'")
  })

  it('⚠️ não importa mais `@/lib/data/portal`', () => {
    expect(codigo).not.toContain('@/lib/data/portal')
  })

  it('a rota do link é montada por `portalHref`, nunca literal', () => {
    expect(codigo).toContain('portalHref(')
    expect(codigo).not.toMatch(/href="\/portal\//)
  })
})

describe('a etapa não é dita duas vezes na mesma tela', () => {
  it('a Home decide quem carrega o `summary`', () => {
    expect(codigo).toMatch(/attention\.state === 'calm' \? null : summary/)
  })
})
