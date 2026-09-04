'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { portalHref, type PortalSection } from '@/config/app'
import { cn } from '@/lib/cn'

/*
 * Navegação do portal, nas duas orientações que a casca usa.
 *
 * ## Uma lógica de item ativo, dois desenhos
 *
 * A regra que decide o item corrente é sutil — a Home casa por igualdade, as
 * outras por prefixo — e é a mesma no celular e no desktop. Ela mora aqui uma
 * vez só: duplicá-la em um `SidebarNav` separado seria criar o lugar onde as
 * duas versões divergem (ADR-0027).
 *
 *   horizontal   linha de palavras no cabeçalho do celular, filete embaixo
 *   vertical     lista na sidebar do desktop, filete à esquerda
 *
 * Não é pill em nenhuma das duas: a direção proíbe. O filete azul é o mesmo
 * gesto de uma régua editorial, girado.
 *
 * `use client` só por causa do `usePathname`: é a única parte da casca que
 * precisa saber onde o usuário está.
 */
export function PortalNav({
  projectId,
  sections,
  orientation = 'horizontal',
  className,
}: {
  projectId: string
  sections: readonly PortalSection[]
  orientation?: 'horizontal' | 'vertical'
  className?: string
}) {
  const pathname = usePathname()
  const root = portalHref(projectId, '')

  /* Uma seção só é o próprio lugar onde a pessoa está: não é navegação. */
  if (sections.length < 2) return null

  const vertical = orientation === 'vertical'

  return (
    <nav aria-label="Seções do projeto" className={className}>
      <ul
        className={cn(
          vertical ? 'flex flex-col' : 'flex flex-wrap items-center gap-x-7 gap-y-2 lg:gap-x-9',
        )}
      >
        {sections.map((item) => {
          const href = portalHref(projectId, item.slug)
          const active = item.slug === '' ? pathname === root : pathname.startsWith(href)

          return (
            <li key={item.key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  't-meta relative flex min-h-11 items-center transition-colors duration-[--motion-fast]',
                  vertical && 'pl-4',
                  active ? 'text-foreground' : 'text-muted hover:text-foreground',
                )}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    'bg-accent absolute transition-transform duration-[--motion-default] ease-[--ease-out]',
                    vertical
                      ? 'inset-y-1.5 left-0 w-0.5 origin-top'
                      : 'inset-x-0 -bottom-px h-0.5 origin-left',
                    active ? (vertical ? 'scale-y-100' : 'scale-x-100') : 'scale-0',
                  )}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
