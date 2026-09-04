import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Nenhuma identidade de projeto escrita à mão na superfície do cliente.
 *
 * ## O defeito que este arquivo fecha
 *
 * O CTA mais importante do produto apontava para `/portal/hartmann-social/conteudo`
 * — uma rota literal, com um id que deixou de existir na FASE 6. O guard do
 * layout respondia 404, então a laje "Precisa da sua atenção" levava o cliente
 * a uma página de erro. Passou por revisão humana, por QA hospedado e por uma
 * fase inteira sem ser vista.
 *
 * O que encontra esse tipo de erro é o teste, não a leitura. E o guard fecha a
 * CATEGORIA, não o caso: o próximo atalho não vai se chamar "hartmann-social",
 * vai ser um uuid copiado do staging durante um debug.
 */

const RAIZ = resolve(process.cwd(), 'src')

/**
 * Só a superfície CLIENT-FACING.
 *
 * O admin é a ferramenta da própria Boop e usa nomes de exemplo em
 * `placeholder` de formulário ("Hartmann Advogados"), que é uma dica de
 * preenchimento — não é dado, não é rota e não alcança cliente nenhum. Alargar
 * a varredura para lá derrubaria código que a FASE 8 não deve tocar
 * (Decisão 19: o admin fica intacto).
 */
const CLIENT_FACING = [
  'app/(portal)',
  'components/patterns',
  'components/layout',
  'components/brand',
  'domains/attention',
  'domains/onboarding/components',
  'domains/projects/journey.ts',
  'config/app.ts',
  'config/attention.ts',
  'config/journeys.ts',
]

function arquivos(alvo: string): string[] {
  const caminho = `${RAIZ}/${alvo}`
  if (statSync(caminho).isFile()) return [caminho]

  const encontrados: string[] = []
  for (const entrada of readdirSync(caminho)) {
    const filho = `${caminho}/${entrada}`
    if (statSync(filho).isDirectory()) encontrados.push(...arquivos(`${alvo}/${entrada}`))
    else if (/\.tsx?$/.test(entrada)) encontrados.push(filho)
  }
  return encontrados
}

const FONTES = CLIENT_FACING.flatMap(arquivos).map((caminho) => ({
  caminho: caminho.slice(RAIZ.length + 1),
  /* Comentários explicam a regra; não podem ser acusados de violá-la. */
  codigo: readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, ''),
}))

/**
 * `revalidatePath` recebe um CAMINHO de cache, não um href de navegação: ele
 * nunca vira `<a href>` e nunca chega ao navegador como link.
 */
const REVALIDATE = /revalidatePath\(/

describe('o varredor está lendo alguma coisa', () => {
  it('guarda contra o teste virar tautologia', () => {
    expect(FONTES.length).toBeGreaterThan(15)
    expect(FONTES.map((f) => f.caminho)).toContain('config/app.ts')
  })
})

describe('⚠️ nenhuma identidade fictícia na superfície do cliente', () => {
  it('nenhum arquivo menciona os tenants do seed', () => {
    const culpados = FONTES.filter((f) => /hartmann|velmont/i.test(f.codigo)).map((f) => f.caminho)

    expect(culpados, 'identidade de seed na superfície client-facing').toEqual([])
  })

  it('nenhum uuid literal — o próximo atalho é um id copiado do staging', () => {
    const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    const culpados = FONTES.filter((f) => UUID.test(f.codigo)).map((f) => f.caminho)

    expect(culpados, 'uuid literal em código client-facing').toEqual([])
  })

  it('os tenants continuam no seed e nos fixtures — é lá que eles devem existir', () => {
    const seed = readFileSync(resolve(process.cwd(), 'supabase/seed.sql'), 'utf8')
    const fixtures = readFileSync(resolve(process.cwd(), 'tests/rls/support/fixtures.ts'), 'utf8')

    /* Sem dois tenants distintos não existe suíte de isolamento. */
    expect(seed).toMatch(/Hartmann/)
    expect(seed).toMatch(/Velmont/)
    expect(fixtures).toMatch(/HARTMANN/)
    expect(fixtures).toMatch(/VELMONT/)
  })
})

describe('⚠️ toda rota de projeto é montada por `portalHref`', () => {
  const LITERAL = /['"`]\/portal\//

  it('nenhum href literal de projeto fora do helper', () => {
    const culpados = FONTES.filter(
      (f) => f.caminho !== 'config/app.ts' && LITERAL.test(f.codigo) && !REVALIDATE.test(f.codigo),
    ).map((f) => f.caminho)

    expect(culpados, 'rota literal fora de portalHref').toEqual([])
  })

  it('`portalHref` é o único lugar que monta a string', () => {
    const app = FONTES.find((f) => f.caminho === 'config/app.ts')

    expect(app?.codigo).toMatch(/export function portalHref/)
    expect(app?.codigo).toMatch(/`\/portal\/\$\{projectId\}/)
  })

  it('a source de atenção usa o helper com o id do projeto verificado', () => {
    const source = FONTES.find((f) => f.caminho === 'domains/attention/sources/onboarding.ts')

    expect(source?.codigo).toMatch(/portalHref\(project\.id, 'onboarding'\)/)
    expect(source?.codigo).not.toMatch(LITERAL)
  })
})
