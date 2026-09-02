import type { ReactNode } from 'react'
import { Shell } from '@/components/layout/shell'
import { SignOutButton } from '@/components/patterns/sign-out-button'
import { requireBoop } from '@/lib/auth/authorization'

/**
 * Layout da operacao interna. Desacoplado do portal.
 *
 * O gate inline da FASE 3 virou `requireBoop()`, que e a fronteira definitiva:
 * sessao valida, perfil ativo e papel da Boop. Sai daqui e passa a valer em
 * qualquer rota interna que a chame, em vez de ser uma linha que cada layout
 * novo precisaria lembrar de repetir.
 *
 * 404, e nao 403: 403 confirmaria que a area existe (docs/security.md).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireBoop()

  return (
    <Shell context="Admin" action={<SignOutButton />}>
      {children}
    </Shell>
  )
}
