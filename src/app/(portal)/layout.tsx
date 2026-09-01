import type { ReactNode } from 'react'
import { Shell } from '@/components/layout/shell'

/**
 * Layout do portal do cliente. Independente do admin de proposito: a navegacao
 * de sete itens e o seletor de projeto entram na FASE 2 sem tocar no admin.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <Shell context="Client Portal">{children}</Shell>
}
