'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Container } from '@/components/layout/container'
import { cn } from '@/lib/cn'

/**
 * Navegacao da operacao interna. Tres itens, e a conta importa.
 *
 * O limite de sete itens e do PORTAL (docs/product.md) e nao se aplica aqui —
 * mas o espirito, sim: cada tela de admin precisa de um workflow que a exija,
 * e o roadmap avisa que "admin virando ERP" e um risco de cronograma nomeado.
 * Tres telas, tres conjuntos de workflows: clientes, pessoas, auditoria.
 *
 * `use client` pelo `usePathname`, e so por ele: marcar onde a pessoa esta
 * depende da rota atual, e essa e a unica informacao dinamica da barra.
 */
const ITEMS = [
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/usuarios', label: 'Pessoas' },
  { href: '/admin/atividade', label: 'Atividade' },
] as const

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Operação interna" className="border-rule border-t">
      <Container>
        <ul className="-mx-3 flex items-center overflow-x-auto">
          {ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    /* 44px de alvo de toque, mesmo no admin. */
                    't-meta flex h-11 items-center px-3 transition-colors',
                    'duration-(--motion-fast) ease-(--ease-standard)',
                    /*
                     * A barra inferior e o portador do estado, e o peso do
                     * texto acompanha: cor sozinha nao pode carregar
                     * significado (.claude/rules/frontend.md).
                     */
                    active
                      ? 'text-foreground border-accent border-b-2 font-semibold'
                      : 'text-muted hover:text-foreground border-b-2 border-transparent',
                  )}
                >
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </Container>
    </nav>
  )
}
