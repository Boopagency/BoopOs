import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PORTAL_SECTIONS, portalHref, visibleSections } from '@/config/app'

/*
 * DEEP LINK É O PRINCIPAL CAMINHO DE ENTRADA DO PRODUTO.
 *
 * O cliente chega por um link de e-mail, não pelo menu. `phase8-nav-availability`
 * já prova que ocultar da navegação não muda o slug — mas isso é uma afirmação
 * sobre a CONFIG, e uma config correta apontando para um arquivo que não existe
 * dá 404 do mesmo jeito. Aqui a pergunta é a do sistema de arquivos: cada slug
 * declarado tem rota, cada rota está sob o layout que autoriza, e nenhuma delas
 * inventa conteúdo para não parecer vazia.
 */

const RAIZ = 'src/app/(portal)/portal/[projectId]'

function ler(caminho: string): string {
  return readFileSync(caminho, 'utf8')
}

describe('todo slug declarado tem rota no disco', () => {
  it.each(PORTAL_SECTIONS.map((s) => [s.key, s.slug] as const))(
    '`%s` responde em disco',
    (_key, slug) => {
      const arquivo = slug ? `${RAIZ}/${slug}/page.tsx` : `${RAIZ}/page.tsx`

      expect(existsSync(arquivo), `sem rota para o slug "${slug}": ${arquivo}`).toBe(true)
    },
  )

  it('⚠️ as cinco seções FORA da navegação continuam alcançáveis', () => {
    const escondidas = PORTAL_SECTIONS.filter((s) => !s.available)

    expect(escondidas).toHaveLength(5)

    for (const secao of escondidas) {
      expect(existsSync(`${RAIZ}/${secao.slug}/page.tsx`)).toBe(true)
      expect(portalHref('abc', secao.slug)).toBe(`/portal/abc/${secao.slug}`)
    }
  })

  it('a navegação visível é subconjunto próprio das rotas que existem', () => {
    const visiveis = visibleSections('social').map((s) => s.slug)
    const todas = PORTAL_SECTIONS.map((s) => s.slug)

    expect(visiveis.length).toBeLessThan(todas.length)
    expect(todas).toEqual(expect.arrayContaining(visiveis))
  })
})

describe('⚠️ toda rota do portal herda UM guard, no layout do grupo', () => {
  it('o layout existe e chama o guard que responde tenant e visibilidade', () => {
    const layout = ler(`${RAIZ}/layout.tsx`)

    expect(layout).toMatch(/requireVisiblePortalProject\(projectId\)/)
  })

  it('nenhuma página de seção repete (nem substitui) o guard por conta própria', () => {
    /*
     * Um guard por página é um guard que a próxima página esquece. Se uma
     * seção começar a chamar `requireProjectAccess` sozinha, é sinal de que a
     * fronteira saiu do layout — e a rota seguinte nascerá desprotegida.
     */
    const culpadas = PORTAL_SECTIONS.filter((s) => s.slug).filter((s) =>
      /requireProjectAccess|requireClientAccess/.test(ler(`${RAIZ}/${s.slug}/page.tsx`)),
    )

    expect(culpadas.map((s) => s.slug)).toEqual([])
  })

  it('o 404 do portal não distingue as três recusas', () => {
    const naoEncontrado = ler(`${RAIZ}/not-found.tsx`)

    /* Nada no texto pode confirmar que a linha existe e é de outra pessoa. */
    expect(naoEncontrado).not.toMatch(/outro cliente|não é seu|sem permissão|403/i)
  })
})

describe('⚠️ seção sem domínio não inventa dado para preencher a tela', () => {
  const SEM_DOMINIO = PORTAL_SECTIONS.filter((s) => !s.available)

  it.each(SEM_DOMINIO.map((s) => [s.slug] as const))('%s não lê domínio nenhum', (slug) => {
    const pagina = ler(`${RAIZ}/${slug}/page.tsx`)

    expect(pagina).not.toMatch(/@\/domains\//)
    expect(pagina).not.toMatch(/@\/mocks/)
    expect(pagina).not.toMatch(/supabase/i)
  })

  it.each(SEM_DOMINIO.map((s) => [s.slug] as const))('%s diz o que é verdade hoje', (slug) => {
    const pagina = ler(`${RAIZ}/${slug}/page.tsx`)

    /*
     * Estado vazio nunca diz "nenhum dado": diz o que está acontecendo e o que
     * vem a seguir. O componente que carrega essa voz é um só.
     */
    expect(pagina).toMatch(/EmptyState/)
  })

  it('detalhe de conteúdo responde 404 — não existe conteúdo para detalhar', () => {
    const detalhe = ler(`${RAIZ}/conteudo/[contentId]/page.tsx`)

    expect(detalhe).toMatch(/notFound\(\)/)
  })
})
