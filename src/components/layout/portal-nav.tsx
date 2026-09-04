'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { portalHref, type PortalSection } from '@/config/app'
import { cn } from '@/lib/cn'

/*
 * Navegação do portal: uma linha de palavras, como o sumário de uma revista.
 *
 * Não é sidebar — ocuparia 240px permanentes para links que cabem numa linha —
 * e não é pill: a direção proíbe. O item ativo é marcado por um filete azul
 * embaixo, o mesmo gesto de uma régua editorial.
 *
 * ## Por que ela agora aparece no celular também
 *
 * Enquanto houver menos de três seções, a barra inferior não é renderizada
 * (`BOTTOM_NAV_THRESHOLD`): ela custaria a metade inferior da tela para
 * oferecer um link que a Home já dá. Duas palavras cabem folgado em 375px, e o
 * cabeçalho já é sticky — a navegação continua sempre alcançável.
 *
 * `use client` só por causa do `usePathname`: é a única parte da casca que
 * precisa saber onde o usuário está.
 */
export function PortalNav({
  projectId,
  sections,
  className,
}: {
  projectId: string
  sections: readonly PortalSection[]
  className?: string
}) {
  const pathname = usePathname()
  const root = portalHref(projectId, '')

  /* Uma seção só é o próprio lugar onde a pessoa está: não é navegação. */
  if (sections.length < 2) return null

  return (
    <nav aria-label="Seções do projeto" className={className}>
      <ul className="flex flex-wrap items-center gap-x-7 gap-y-2 lg:gap-x-9">
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
