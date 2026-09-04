import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * O motor de atenção não abre caminho paralelo, e o bastidor continua bastidor.
 *
 * Duas regras, um arquivo, porque as duas são sobre a mesma coisa: o que a
 * superfície do cliente tem permissão de tocar.
 *
 * 1. **O motor compõe domínios, não consulta tabelas.** Se uma source pudesse
 *    abrir o cliente do Supabase sozinha, ela viraria uma segunda porta de
 *    autorização — e a segunda porta é sempre a que fica sem uma checagem.
 *
 * 2. **`activity_log` nunca alcança o cliente.** Nem direto, nem agregado, nem
 *    "traduzido" para linguagem de cliente. Ele é auditoria da Boop, e
 *    `listRecentActivityForBoop()` começa com `requireBoop()` por isso. Uma
 *    linha do tempo para o cliente, se um dia existir, é superfície própria com
 *    contrato próprio — nunca uma projeção do log (D-30).
 */

const RAIZ = resolve(process.cwd(), 'src')

function arquivos(dir: string): string[] {
  const encontrados: string[] = []
  for (const entrada of readdirSync(dir)) {
    const caminho = `${dir}/${entrada}`
    if (statSync(caminho).isDirectory()) encontrados.push(...arquivos(caminho))
    else if (/\.tsx?$/.test(entrada)) encontrados.push(caminho)
  }
  return encontrados
}

const semComentarios = (codigo: string) =>
  codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const ATENCAO = arquivos(`${RAIZ}/domains/attention`).map((caminho) => ({
  caminho: caminho.slice(RAIZ.length + 1),
  codigo: semComentarios(readFileSync(caminho, 'utf8')),
}))

const PORTAL = [...arquivos(`${RAIZ}/app/(portal)`), ...arquivos(`${RAIZ}/components`)].map(
  (caminho) => ({
    caminho: caminho.slice(RAIZ.length + 1),
    codigo: semComentarios(readFileSync(caminho, 'utf8')),
  }),
)

describe('o varredor acha os arquivos', () => {
  it('guarda contra o teste virar tautologia', () => {
    expect(ATENCAO.length).toBeGreaterThanOrEqual(5)
    expect(PORTAL.length).toBeGreaterThan(15)
    expect(ATENCAO.map((f) => f.caminho)).toContain('domains/attention/queries.ts')
  })
})

describe('⚠️ o motor compõe domínios, não consulta tabelas', () => {
  it('nenhum arquivo do motor cria cliente do Supabase', () => {
    const culpados = ATENCAO.filter((f) =>
      /createSupabaseServerClient|supabase\s*\./.test(f.codigo),
    )

    expect(
      culpados.map((f) => f.caminho),
      'consulta direta no motor',
    ).toEqual([])
  })

  it('nenhum arquivo do motor escreve SQL nem nomeia tabela', () => {
    const TABELAS = /\.from\(|onboarding_submissions|project_stages|projects'|clients'/
    const culpados = ATENCAO.filter((f) => TABELAS.test(f.codigo))

    expect(culpados.map((f) => f.caminho)).toEqual([])
  })

  it('⚠️ nenhum arquivo do motor importa o cliente `service_role`', () => {
    const culpados = ATENCAO.filter((f) => /supabase\/admin/.test(f.codigo))

    expect(
      culpados.map((f) => f.caminho),
      'service_role no motor',
    ).toEqual([])
  })

  it('a porta do motor guarda antes de qualquer source', () => {
    const queries = ATENCAO.find((f) => f.caminho === 'domains/attention/queries.ts')

    expect(queries?.codigo).toMatch(/requireVisiblePortalProject\(projectId\)/)
  })

  it('⚠️ o guard fica FORA do isolamento de erro', () => {
    const queries = ATENCAO.find((f) => f.caminho === 'domains/attention/queries.ts')?.codigo ?? ''

    /*
     * Capturar o guard transformaria um 404 cross-tenant em estado degradado,
     * com a página montando por cima da recusa. É falha de segurança com
     * aparência de resiliência.
     */
    expect(queries).not.toMatch(/try\s*\{/)
    expect(queries.indexOf('requireVisiblePortalProject')).toBeGreaterThan(-1)
  })

  it('o isolamento relança os sinais de navegação do Next', () => {
    const safety = ATENCAO.find((f) => f.caminho === 'domains/attention/safety.ts')?.codigo ?? ''

    expect(safety).toMatch(/unstable_rethrow\(error\)/)

    /* Tem de ser a PRIMEIRA linha do catch, antes de qualquer log. */
    const catchIdx = safety.indexOf('catch')
    const rethrowIdx = safety.indexOf('unstable_rethrow(error)')
    const logIdx = safety.indexOf('logger.error')

    expect(rethrowIdx).toBeGreaterThan(catchIdx)
    expect(rethrowIdx).toBeLessThan(logIdx)
  })

  it('a falha vira número, nunca erro — nada técnico atravessa o RSC', () => {
    const types = ATENCAO.find((f) => f.caminho === 'domains/attention/types.ts')?.codigo ?? ''

    expect(types).toMatch(/\{ ok: false \}/)
    expect(types).not.toMatch(/error:\s*(Error|unknown)/)
  })
})

describe('⚠️ o activity log continua privado', () => {
  const PROIBIDO = /activity_log|lib\/activity|listRecentActivity/

  it('nenhuma tela ou componente do portal toca o log', () => {
    const culpados = PORTAL.filter((f) => PROIBIDO.test(f.codigo))

    expect(
      culpados.map((f) => f.caminho),
      'activity log na superfície do cliente',
    ).toEqual([])
  })

  it('nenhuma source de atenção toca o log', () => {
    const culpados = ATENCAO.filter((f) => PROIBIDO.test(f.codigo))

    expect(culpados.map((f) => f.caminho)).toEqual([])
  })

  it('a leitura do log continua exigindo papel da Boop', () => {
    const queries = readFileSync(`${RAIZ}/lib/activity/queries.ts`, 'utf8')

    expect(queries).toMatch(/requireBoop\(\)/)
  })
})

describe('⚠️ `service_role` continua com um chamador só', () => {
  it('nada fora do convite importa `@/lib/supabase/admin`', () => {
    const todos = arquivos(RAIZ).map((caminho) => ({
      caminho: caminho.slice(RAIZ.length + 1),
      codigo: semComentarios(readFileSync(caminho, 'utf8')),
    }))

    const importadores = todos
      .filter((f) => /from '@\/lib\/supabase\/admin'/.test(f.codigo))
      .map((f) => f.caminho)

    expect(importadores).toEqual(['domains/people/mutations.ts'])
  })
})
