import { describe, expect, it } from 'vitest'
import {
  BOTTOM_NAV_THRESHOLD,
  PORTAL_SECTIONS,
  portalHref,
  showsBottomNav,
  visibleSections,
} from '@/config/app'
import { PROJECT_TYPES, type ProjectType } from '@/config/enums'

/**
 * A navegação segue o PRODUTO, nunca a contagem de linhas.
 *
 * O caso que este arquivo existe para travar é o negativo: nada aqui consulta
 * dados. Se alguém um dia fizer o menu depender de "tem conteúdo?", a
 * arquitetura do sistema passa a piscar na cara de quem só queria acompanhar o
 * próprio projeto — e o teste que quebra é este.
 */

describe('na FASE 8, duas seções existem de verdade', () => {
  it('`visibleSections` devolve exatamente Início e Projeto', () => {
    expect(visibleSections('social').map((s) => s.key)).toEqual(['home', 'project'])
  })

  it.each(PROJECT_TYPES)('vale para o projeto do tipo `%s`', (type: ProjectType) => {
    expect(visibleSections(type).map((s) => s.key)).toEqual(['home', 'project'])
  })

  it('⚠️ nenhuma feature de fase futura está ligada', () => {
    const futuras = ['strategy', 'content', 'files', 'meetings', 'results']

    for (const key of futuras) {
      const section = PORTAL_SECTIONS.find((s) => s.key === key)
      expect(section, `seção ${key}`).toBeDefined()
      expect(section?.available, `${key} não pode estar disponível na F8`).toBe(false)
    }
  })
})

describe('as rotas continuam existindo mesmo fora da navegação', () => {
  it('toda seção mantém o slug, disponível ou não', () => {
    const slugs = PORTAL_SECTIONS.map((s) => s.slug)

    expect(slugs).toContain('conteudo')
    expect(slugs).toContain('estrategia')
    expect(slugs).toContain('resultados')
    expect(slugs).toContain('encontros')
    expect(slugs).toContain('arquivos')
  })

  it('ocultar da navegação não invalida o deep link', () => {
    const conteudo = PORTAL_SECTIONS.find((s) => s.key === 'content')

    expect(conteudo?.available).toBe(false)
    expect(portalHref('abc', conteudo!.slug)).toBe('/portal/abc/conteudo')
  })
})

describe('⚠️ disponibilidade não olha para dados', () => {
  it('`visibleSections` recebe o TIPO do projeto, e nada mais', () => {
    /*
     * A assinatura é a garantia: sem `projectId`, sem contagem, sem client.
     * Não há como fazer o menu depender de linhas sem mudar o contrato.
     */
    expect(visibleSections.length).toBe(1)
  })

  it('a decisão é constante entre chamadas', () => {
    expect(visibleSections('social')).toEqual(visibleSections('social'))
  })

  it('o código de `visibleSections` não consulta banco', async () => {
    const { readFileSync } = await import('node:fs')
    const fonte = readFileSync('src/config/app.ts', 'utf8')

    expect(fonte).not.toMatch(/supabase|from\('|createClient/i)
  })
})

describe('o teto de sete continua valendo', () => {
  it('sete chaves, nem uma a mais', () => {
    expect(PORTAL_SECTIONS).toHaveLength(7)
  })

  it('nenhuma chave repetida', () => {
    const keys = PORTAL_SECTIONS.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('nenhum slug repetido', () => {
    const slugs = PORTAL_SECTIONS.map((s) => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('⚠️ onboarding NÃO é uma seção — é uma tarefa', () => {
    expect(PORTAL_SECTIONS.map((s) => s.slug)).not.toContain('onboarding')
  })
})

describe('a barra inferior espera ter o que oferecer', () => {
  it('o limiar é três destinos', () => {
    expect(BOTTOM_NAV_THRESHOLD).toBe(3)
  })

  it('⚠️ com duas seções, a barra não é renderizada', () => {
    expect(visibleSections('social').length).toBeLessThan(BOTTOM_NAV_THRESHOLD)
  })

  /*
   * A FASE 8.5 mudou o ENDEREÇO desta regra, não a regra.
   *
   * Até aqui os dois casos abaixo liam o código-fonte de `portal-shell.tsx`
   * atrás de duas strings literais — uma comparação e uma expressão de classe.
   * Isso travava a implementação da casca, não o comportamento do produto: a
   * reescrita da casca em ADR-0027 os quebraria mesmo mantendo a regra intacta,
   * que é o sinal de que a asserção estava no lugar errado.
   *
   * A decisão virou `showsBottomNav()`, em `src/config/app.ts`, ao lado do
   * limiar que a define — e agora é testável como função pura, sem ler arquivo.
   * A reserva de altura continua conferida, e continua conferida onde ela de
   * fato existe.
   *
   * O terceiro caso da FASE 8 — "Ciclo N" saiu do shell — NÃO mudou, e é ele
   * que força a rail contextual a ser um slot opaco: uma casca que recebesse
   * `cycle` por prop voltaria a falhar aqui.
   */
  it('a decisão é da CONFIG, e é pura', () => {
    const duas = visibleSections('social')
    expect(duas.length).toBe(2)
    expect(showsBottomNav(duas)).toBe(false)

    /* Uma terceira seção — a FASE 9 — acende a barra sem tocar em layout. */
    expect(showsBottomNav([...duas, PORTAL_SECTIONS[2]!])).toBe(true)
  })

  it('sem barra, sem reserva de altura no `main`', async () => {
    const { readFileSync } = await import('node:fs')
    const fonte = readFileSync('src/components/layout/portal-shell.tsx', 'utf8')

    /* A casca consome a decisão; não a reimplementa. */
    expect(fonte).toContain('showsBottomNav(sections)')
    expect(fonte).not.toContain('sections.length >=')

    /* A reserva é condicionada — senão sobra rodapé fantasma no celular. */
    expect(fonte).toMatch(/comBarra \? '[^']*pb-24[^']*' : 'flex-1'/)
  })
})

describe('o cabeçalho é moldura', () => {
  it('⚠️ "Ciclo N" saiu do shell', async () => {
    const { readFileSync } = await import('node:fs')
    const fonte = readFileSync('src/components/layout/portal-shell.tsx', 'utf8')
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

    expect(codigo).not.toContain('Ciclo {')
    expect(codigo).not.toContain('cycle')
  })
})
