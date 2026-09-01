import type { ReactNode } from 'react'
import { Shell } from '@/components/layout/shell'

/** Layout da operacao interna. Desacoplado do portal. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <Shell context="Admin">{children}</Shell>
}
