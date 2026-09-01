import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { APP } from '@/config/app'
import { SkipLink } from '@/components/layout/skip-link'
import './globals.css'

/*
 * Tipografia: fonte de sistema, de proposito. A tipografia real da Boop entra
 * na FASE 2 com os assets da marca (docs/roadmap.md). Trocar significa
 * adicionar `next/font` aqui e uma variavel em globals.css — nada mais.
 */

export const metadata: Metadata = {
  title: {
    default: APP.name,
    template: `%s · ${APP.name}`,
  },
  description: APP.description,
  applicationName: APP.name,
  // O produto e inteiramente autenticado: nada aqui deve ser indexado.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={APP.locale}>
      <body className="font-sans antialiased">
        <SkipLink />
        {children}
      </body>
    </html>
  )
}
