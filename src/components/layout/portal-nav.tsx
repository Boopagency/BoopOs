'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PORTAL_NAV, portalHref } from '@/config/app'
import { cn } from '@/lib/cn'

/*
 * Navegação do desktop: uma linha de palavras, como o sumário de uma revista.
 *
 * Não é sidebar (ocuparia 240px permanentes para sete links que cabem numa
 * linha) e não é pill (a direção proíbe). O item ativo é marcado por um filete
 * azul embaixo — o mesmo gesto de uma régua editorial.
 *
 * `use client` apenas por causa do `usePathname`: é a única parte da casca que
 * precisa saber onde o usuário está.
 */
export function PortalNav({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const root = portalHref(projectId, '')

  return (
    <nav aria-label="Seções do projeto" className="hidden md:block">
      <ul className="flex flex-wrap items-center gap-x-7 gap-y-2 lg:gap-x-9">
        {PORTAL_NAV.map((item) => {
          const href = portalHref(projectId, item.slug)
          const active = item.slug === '' ? pathname === root : pathname.startsWith(href)

          return (
            <li key={item.key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  't-meta relative block py-3 transition-colors duration-[--motion-fast]',
                  active ? 'text-foreground' : 'text-muted hover:text-foreground',
                )}
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-x-0 -bottom-px h-0.5 origin-left transition-transform',
                    'duration-[--motion-default] ease-[--ease-out]',
                    active ? 'bg-accent scale-x-100' : 'bg-accent scale-x-0',
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
