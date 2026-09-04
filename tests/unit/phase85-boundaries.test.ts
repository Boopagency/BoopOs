import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * As fronteiras da FASE 8.5, lidas do código-fonte.
 *
 * Mesma forma dos varredores da FASE 6, 7 e 8, e pela mesma razão: uma casca é
 * o arquivo que mais gente edita sem abrir o ADR. Estes casos quebram no dia em
 * que a fronteira for cruzada — não no dia em que alguém percebe na tela.
 */

const RAIZ = resolve(process.cwd(), 'src')

function arquivos(dir: string): string[] {
  const achados: string[] = []
  for (const entrada of readdirSync(dir)) {
    const caminho = `${dir}/${entrada}`
    if (statSync(caminho).isDirectory()) achados.push(...arquivos(caminho))
    else if (/\.tsx?$/.test(entrada)) achados.push(caminho)
  }
  return achados
}

const TODOS = arquivos(RAIZ)
const relativo = (c: string) => c.slice(RAIZ.length + 1)
const ler = (c: string) => readFileSync(c, 'utf8')

/** Sem comentários: uma explicação da regra não pode ser acusada de violá-la. */
const codigo = (c: string) =>
  ler(c)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\/.*$/gm, '')

const CASCA = `${RAIZ}/components/layout`
const SHELL = `${CASCA}/portal-shell.tsx`
const SIDEBAR = `${CASCA}/portal-sidebar.tsx`
const RAIL = `${CASCA}/context-rail.tsx`
const BOARD = `${RAIZ}/components/patterns/board.tsx`

describe('o varredor funciona', () => {
  it('acha arquivos de verdade', () => {
    expect(TODOS.length).toBeGreaterThan(50)
    expect(TODOS).toContain(SHELL)
    expect(TODOS).toContain(BOARD)
  })
})

describe('⚠️ a casca continua no servidor', () => {
  /*
   * O modo de falhar é conhecido: alguém torna a sidebar cliente "só para
   * animar o item ativo", e a casca inteira — com marca, cliente, projetos e
   * seções — atravessa para o bundle. As folhas cliente são declaradas aqui.
   */
  const CLIENTE_PERMITIDO = [
    'workspace.tsx',
    'portal-nav.tsx',
    'portal-bottom-nav.tsx',
    /* Do admin, e anterior a esta fase: também só por `usePathname`. */
    'admin-nav.tsx',
  ]

  it.each([SHELL, SIDEBAR, RAIL, `${CASCA}/project-switcher.tsx`])(
    '`%s` não é Client Component',
    (arquivo) => {
      expect(ler(arquivo)).not.toMatch(/^'use client'/m)
    },
  )

  it('só as folhas declaradas são cliente', () => {
    const clientes = arquivos(CASCA)
      .filter((c) => /^'use client'/m.test(ler(c)))
      .map((c) => c.split('/').pop()!)

    expect(clientes.sort()).toEqual([...CLIENTE_PERMITIDO].sort())
  })

  it('o seletor de projeto continua sem JavaScript', () => {
    expect(codigo(`${CASCA}/project-switcher.tsx`)).toContain('<details')
  })
})

describe('⚠️ a rail é opaca ao domínio', () => {
  it('não importa domínio, supabase nem banco', () => {
    const fonte = codigo(RAIL)

    expect(fonte).not.toMatch(/@\/domains\//)
    expect(fonte).not.toMatch(/@\/lib\/supabase/)
    expect(fonte).not.toMatch(/supabase/i)
  })

  it('recebe `ReactNode`, e não dado', () => {
    expect(codigo(RAIL)).toMatch(/rail\?:\s*ReactNode/)
  })

  it('a casca não conhece ciclo, etapa nem equipe', () => {
    const fonte = codigo(SHELL)

    for (const dado of ['cycle', 'stage', 'team', 'attention', 'journey']) {
      expect(fonte, dado).not.toContain(dado)
    }
  })

  it('a sidebar também não', () => {
    const fonte = codigo(SIDEBAR)

    for (const dado of ['cycle', 'stage', 'team', 'attention', 'journey']) {
      expect(fonte, dado).not.toContain(dado)
    }
  })
})

describe('⚠️ o quadro não conhece o domínio que ainda não existe', () => {
  /*
   * Se um destes aparecer, a FASE 10 herdou um domínio decidido por acidente
   * num arquivo de layout — que é exatamente o que a ADR-0028 impede.
   */
  const PROIBIDO = [
    'content',
    'status',
    'channel',
    'canal',
    'formato',
    'approval',
    'aprova',
    'version',
    'versão',
    'instagram',
    'social',
    'project',
    'projeto',
    'client',
    'tenant',
    'idea',
    'ideia',
    'publicad',
    'revisão',
  ]

  it.each(PROIBIDO)('não menciona `%s`', (termo) => {
    expect(codigo(BOARD).toLowerCase()).not.toContain(termo)
  })

  it('não fala com banco nem com domínio', () => {
    const fonte = codigo(BOARD)

    expect(fonte).not.toMatch(/@\/domains\//)
    expect(fonte).not.toMatch(/supabase/i)
  })

  it('não arrasta: o quadro do cliente é somente-leitura', () => {
    const fonte = codigo(BOARD)

    for (const gesto of ['draggable', 'onDrag', 'onDrop', 'dnd', 'DndContext']) {
      expect(fonte, gesto).not.toContain(gesto)
    }
  })
})

describe('⚠️ o quadro não alcança rota nenhuma', () => {
  it('nada em `src/app` importa as primitivas', () => {
    const culpados = TODOS.filter(
      (c) => c.includes('/app/') && /from '@\/components\/patterns\/board'/.test(ler(c)),
    )

    expect(culpados.map(relativo), 'rota importando quadro').toEqual([])
  })

  it('Conteúdo continua desligado da navegação', async () => {
    const { PORTAL_SECTIONS } = await import('@/config/app')

    expect(PORTAL_SECTIONS.find((s) => s.key === 'content')?.available).toBe(false)
  })

  it('nenhuma fixture de quadro existe fora dos testes', () => {
    const culpados = TODOS.filter((c) => /BoardColumn|BoardCard|BoardViewport/.test(ler(c)))

    expect(culpados.map(relativo)).toEqual(['components/patterns/board.tsx'])
  })
})

describe('motion: um token novo, e nenhuma biblioteca', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')

  it('`--motion-page` existe', () => {
    expect(css).toMatch(/--motion-page:\s*\d+ms/)
  })

  it('⚠️ está na faixa útil: rápido o bastante para não atrasar quem já clicou', () => {
    const ms = Number(/--motion-page:\s*(\d+)ms/.exec(css)?.[1])

    expect(ms).toBeGreaterThanOrEqual(180)
    expect(ms).toBeLessThanOrEqual(320)
  })

  it('só o workspace entra; a casca não está na subárvore animada', () => {
    expect(codigo(`${CASCA}/workspace.tsx`)).toContain('workspace-enter')
    expect(codigo(SHELL)).not.toContain('workspace-enter')
  })

  it('⚠️ nenhuma dependência de motion ou de drag entrou', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
      devDependencies: Record<string, string>
    }
    const todas = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })

    for (const proibida of ['motion', 'framer-motion', '@dnd-kit/core', 'react-dnd']) {
      expect(todas, proibida).not.toContain(proibida)
    }
  })

  it('reduced motion continua cobrindo animação e transição', () => {
    const bloco =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''

    expect(bloco).toContain('animation-duration')
    expect(bloco).toContain('transition-duration')
    expect(bloco).toContain('!important')
  })

  it('⚠️ nenhuma animação de entrada em elemento que a pessoa já quer clicar', () => {
    /* `rise-*` são delays narrativos: nunca em navegação nem em ação. */
    const culpados = TODOS.filter((c) => /className="[^"]*\brise-\d/.test(ler(c))).filter((c) =>
      /components\/layout|patterns\/board/.test(c),
    )

    expect(culpados.map(relativo)).toEqual([])
  })
})

describe('nenhum hexadecimal nos arquivos novos', () => {
  it.each([
    SHELL,
    SIDEBAR,
    RAIL,
    BOARD,
    `${CASCA}/workspace.tsx`,
    `${RAIZ}/components/ui/skeleton.tsx`,
  ])('`%s` usa token, nunca cor literal', (arquivo) => {
    expect(codigo(arquivo)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})
