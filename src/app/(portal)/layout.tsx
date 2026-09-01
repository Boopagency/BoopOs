import type { ReactNode } from 'react'

/**
 * Route group do portal do cliente. A casca real (masthead + navegacao) vive
 * em `[projectId]/layout.tsx`, porque depende do projeto — e `/portal` sozinho
 * so redireciona.
 */
export default function PortalGroupLayout({ children }: { children: ReactNode }) {
  return children
}
