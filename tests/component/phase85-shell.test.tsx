import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceColumns } from '@/components/layout/context-rail'
import { PortalShell } from '@/components/layout/portal-shell'
import { ProjectSwitcher } from '@/components/layout/project-switcher'
import { ProjectContext } from '@/components/patterns/project-context'
import { visibleSections } from '@/config/app'
import { PROJETO } from '../support/attention-items'

vi.mock('next/navigation', () => ({ usePathname: () => `/portal/${PROJETO}` }))
vi.mock('@/lib/auth/actions', () => ({ signOut: () => Promise.resolve() }))

/**
 * A casca da FASE 8.5.
 *
 * O que estes casos protegem não é aparência — é a lista de coisas que a
 * reescrita da casca poderia ter quebrado sem ninguém ver: a navegação
 * feature-driven, o alvo de toque, a moldura opaca ao domínio, e a regra de que
 * uma rail sem conteúdo não deixa buraco.
 */

const SECOES = visibleSections('social')
const OUTRO = '11111111-1111-4111-8111-111111111111'

function montar(props: Partial<Parameters<typeof PortalShell>[0]> = {}) {
  return render(
    <PortalShell
      projectId={PROJETO}
      clientName="Hartmann"
      projectName="Social Media"
      sections={SECOES}
      {...props}
    >
      <p>conteúdo</p>
    </PortalShell>,
  )
}

describe('a casca monta as duas molduras', () => {
  it('a sidebar e o cabeçalho existem na mesma árvore', () => {
    montar()

    /* Duas navegações com o mesmo rótulo: a do cabeçalho e a da sidebar. */
    expect(screen.getAllByRole('navigation', { name: 'Seções do projeto' })).toHaveLength(2)
  })

  it('⚠️ um `main` por documento', () => {
    const { container } = montar()

    expect(container.querySelectorAll('main')).toHaveLength(1)
    expect(container.querySelector('main')).toHaveAttribute('id', 'main')
  })

  it('⚠️ o rodapé de colofão não existe mais', () => {
    const { container } = montar()

    expect(container.querySelector('footer')).toBeNull()
  })

  it('a sidebar só aparece em `lg` — o celular não ganha chrome novo', () => {
    const { container } = montar()
    const sidebar = container.querySelector('aside')

    expect(sidebar?.className).toContain('hidden')
    expect(sidebar?.className).toContain('lg:block')
  })

  it('o cabeçalho da FASE 8 some em `lg`, e não antes', () => {
    const { container } = montar()

    expect(container.querySelector('header')?.className).toContain('lg:hidden')
  })
})

describe('⚠️ a navegação segue a feature, também na sidebar', () => {
  it('só as seções disponíveis viram link', () => {
    montar()

    const navs = screen.getAllByRole('navigation', { name: 'Seções do projeto' })

    for (const nav of navs) {
      const rotulos = within(nav)
        .getAllByRole('link')
        .map((el) => el.textContent)

      expect(rotulos).toEqual(['Início', 'Projeto'])
    }
  })

  it('nenhuma feature de fase futura aparece em lugar nenhum da casca', () => {
    const { container } = montar()

    for (const futura of ['Estratégia', 'Conteúdo', 'Arquivos', 'Encontros', 'Resultados']) {
      expect(container.textContent, futura).not.toContain(futura)
    }
  })

  it('a seção corrente é anunciada, e só ela', () => {
    montar()

    const atuais = screen.getAllByRole('link', { current: 'page' })

    expect(atuais.map((el) => el.textContent)).toEqual(['Início', 'Início'])
  })

  it('com duas seções a barra inferior não é renderizada', () => {
    const { container } = montar()

    expect(container.querySelector('main')?.className).not.toContain('pb-24')
  })
})

describe('alvo de toque — a varredura da FASE 8 vale para a casca nova', () => {
  it('todo link e todo botão declaram altura de toque', () => {
    montar({
      projects: [
        { id: PROJETO, name: 'Social Media' },
        { id: OUTRO, name: 'Marca' },
      ],
    })

    const controles = [...screen.getAllByRole('link'), ...screen.getAllByRole('button')]

    const curtos = controles
      .filter((el) => !/min-h-11|min-h-14|h-14/.test(el.className))
      .map((el) => el.textContent?.trim() ?? el.getAttribute('aria-label'))

    expect(curtos, `sem altura de toque: ${curtos.join(', ')}`).toEqual([])
  })
})

describe('o seletor de projeto', () => {
  it('com um projeto só, não existe', () => {
    render(
      <ProjectSwitcher
        projectId={PROJETO}
        projectName="Social Media"
        projects={[{ id: PROJETO, name: 'Social Media' }]}
      />,
    )

    expect(screen.queryByText('Trocar de projeto')).toBeNull()
  })

  it('com vários, oferece os OUTROS — nunca o atual', () => {
    render(
      <ProjectSwitcher
        projectId={PROJETO}
        projectName="Social Media"
        projects={[
          { id: PROJETO, name: 'Social Media' },
          { id: OUTRO, name: 'Marca' },
        ]}
      />,
    )

    const destinos = screen.getAllByRole('link')

    expect(destinos.map((el) => el.textContent)).toEqual(['Marca'])
    expect(destinos[0]).toHaveAttribute('href', `/portal/${OUTRO}`)
  })

  it('é anunciado como expansível, sem JavaScript', () => {
    const { container } = render(
      <ProjectSwitcher
        projectId={PROJETO}
        projectName="Social Media"
        projects={[
          { id: PROJETO, name: 'Social Media' },
          { id: OUTRO, name: 'Marca' },
        ]}
      />,
    )

    expect(container.querySelector('details > summary')).not.toBeNull()
  })
})

describe('⚠️ a rail desaparece quando não tem o que dizer', () => {
  it('sem rail, não há `aside` e não há grid', () => {
    const { container } = render(
      <WorkspaceColumns rail={null}>
        <p>conteúdo</p>
      </WorkspaceColumns>,
    )

    expect(container.querySelector('aside')).toBeNull()
    expect(container.querySelector('[class*="xl:grid"]')).toBeNull()
    expect(container.textContent).toBe('conteúdo')
  })

  it('com rail, a coluna é uma região nomeada', () => {
    render(
      <WorkspaceColumns rail={<ProjectContext team={[{ name: 'Ana Reis' }]} />}>
        <p>conteúdo</p>
      </WorkspaceColumns>,
    )

    const rail = screen.getByRole('complementary', { name: 'Contexto do projeto' })

    expect(within(rail).getByText('Ana Reis')).toBeInTheDocument()
  })

  it('a rail entra em `xl`, e abaixo disso desce para o fim do fluxo', () => {
    render(
      <WorkspaceColumns rail={<ProjectContext team={[{ name: 'Ana Reis' }]} />}>
        <p>conteúdo</p>
      </WorkspaceColumns>,
    )

    const rail = screen.getByRole('complementary')

    /* Nunca `hidden`: o mesmo DOM, em outro lugar. */
    expect(rail.className).not.toMatch(/(^|\s)hidden(\s|$)/)
    expect(rail.className).toContain('xl:sticky')
  })

  it('⚠️ o conteúdo da rail vem antes dela no DOM — a ordem de leitura é a da página', () => {
    const { container } = render(
      <WorkspaceColumns rail={<ProjectContext team={[{ name: 'Ana Reis' }]} />}>
        <p>conteúdo</p>
      </WorkspaceColumns>,
    )

    const html = container.innerHTML
    expect(html.indexOf('conteúdo')).toBeLessThan(html.indexOf('Ana Reis'))
  })
})

describe('⚠️ a rail não inventa nada', () => {
  it('sem equipe e sem data, não sobra nenhum rótulo na tela', () => {
    const { container } = render(<ProjectContext />)

    expect(container.textContent).toBe('')
  })

  it('não menciona entrega, encontro, atividade nem marco', () => {
    const { container } = render(
      <ProjectContext startedOn="2026-03-12" team={[{ name: 'Ana Reis' }]} />,
    )

    for (const ficcao of ['entrega', 'encontro', 'reunião', 'atividade', 'marco', 'atualiza']) {
      expect(container.textContent?.toLowerCase(), ficcao).not.toContain(ficcao)
    }
  })

  it('a data é a real, por extenso e em pt-BR', () => {
    render(<ProjectContext startedOn="2026-03-12" />)

    expect(screen.getByText(/12 de março/)).toBeInTheDocument()
  })

  it('sem cargo: só o nome', () => {
    render(<ProjectContext team={[{ name: 'Ana Reis' }]} />)

    const item = screen.getByText('Ana Reis')
    expect(item.textContent).toBe('Ana Reis')
  })
})
