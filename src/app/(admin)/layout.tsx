import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { Shell } from '@/components/layout/shell'
import { SignOutButton } from '@/components/patterns/sign-out-button'
import { requireActor } from '@/lib/auth/actor'

/**
 * Layout da operacao interna. Desacoplado do portal.
 *
 * O gate de papel abaixo e o minimo para que a area interna nao fique aberta
 * a qualquer pessoa autenticada durante a janela entre as FASES 3 e 4. Usa o
 * papel GLOBAL que o Actor ja carrega — nao consulta vinculo, nao resolve
 * escopo, nao antecipa a matriz de permissoes. Na FASE 4 isto vira
 * `requireBoop()` e sai daqui.
 *
 * 404, e nao 403: 403 confirmaria que a area existe (docs/security.md).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor()
  if (actor.role === 'client_user') notFound()

  return (
    <Shell context="Admin" action={<SignOutButton />}>
      {children}
    </Shell>
  )
}
