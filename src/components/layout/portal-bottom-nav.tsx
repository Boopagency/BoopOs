'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MOBILE_PRIMARY, PORTAL_NAV, portalHref } from '@/config/app'
import { cn } from '@/lib/cn'

/*
 * Barra inferior do celular.
 *
 * Três destinos de uso semanal + "Mais". Sete botões em 375px seriam ilegíveis
 * e a sidebar é justamente o que a direção proíbe (docs/design-direction.md).
 *
 * O painel de "Mais" usa <dialog> nativo: foco preso, Esc para fechar e fundo
 * inerte vêm do browser. Foi o que dispensou uma biblioteca de modal
 * (docs/design-system.md#dialogo).
 *
 * `pb-[env(safe-area-inset-bottom)]` mantém a barra acima da barra de gestos
 * do iOS.
 */
const PRIMARY = PORTAL_NAV.filter((item) => MOBILE_PRIMARY.includes(item.key))
const SECONDARY = PORTAL_NAV.filter((item) => !MOBILE_PRIMARY.includes(item.key))

export function PortalBottomNav({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const root = portalHref(projectId, '')

  /*
   * Fecha o painel quando a navegação acontece. Não precisa de setState aqui:
   * `dialog.close()` dispara o evento `close`, e o `onClose` abaixo é quem
   * atualiza o estado — uma fonte só, e sem setState dentro de efeito.
   */
  useEffect(() => {
    dialogRef.current?.close()
  }, [pathname])

  function toggle() {
    const dialog = dialogRef.current
    if (!dialog) return
    if (dialog.open) {
      dialog.close()
      setOpen(false)
    } else {
      dialog.showModal()
      setOpen(true)
    }
  }

  const isActive = (slug: string) =>
    slug === '' ? pathname === root : pathname.startsWith(portalHref(projectId, slug))

  const secondaryActive = SECONDARY.some((item) => isActive(item.slug))

  return (
    <>
      <nav
        aria-label="Seções do projeto"
        className="border-rule bg-cloud/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-sm md:hidden"
      >
        <ul className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {PRIMARY.map((item) => {
            const active = isActive(item.slug)
            return (
              <li key={item.key}>
                <Link
                  href={portalHref(projectId, item.slug)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    't-meta flex h-14 flex-col items-center justify-center gap-1.5',
                    active ? 'text-foreground' : 'text-muted',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn('h-0.5 w-6', active ? 'bg-accent' : 'bg-transparent')}
                  />
                  {item.label}
                </Link>
              </li>
            )
          })}

          <li>
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-haspopup="dialog"
              className={cn(
                't-meta flex h-14 w-full flex-col items-center justify-center gap-1.5',
                secondaryActive || open ? 'text-foreground' : 'text-muted',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'h-0.5 w-6',
                  secondaryActive && !open ? 'bg-accent' : 'bg-transparent',
                )}
              />
              Mais
            </button>
          </li>
        </ul>
      </nav>

      <dialog
        ref={dialogRef}
        aria-label="Mais seções"
        onClose={() => setOpen(false)}
        className={cn(
          'border-rule bg-cloud mt-auto mb-0 w-full max-w-none rounded-t-lg border-t p-0',
          'backdrop:bg-navy/40 open:animate-[boop-rise_var(--motion-default)_var(--ease-out)]',
        )}
      >
        <div className="px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          <p className="t-meta text-muted">Mais seções</p>
          <ul className="divide-rule mt-4 divide-y">
            {SECONDARY.map((item) => (
              <li key={item.key}>
                <Link
                  href={portalHref(projectId, item.slug)}
                  className="t-title text-foreground flex h-14 items-center justify-between"
                >
                  {item.label}
                  <span aria-hidden="true" className="text-muted">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={toggle}
            className="t-meta border-rule-strong text-foreground mt-6 h-12 w-full border"
          >
            Fechar
          </button>
        </div>
      </dialog>
    </>
  )
}
