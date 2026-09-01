import type { Metadata, Viewport } from 'next'
import { Poppins } from 'next/font/google'
import type { ReactNode } from 'react'
import { SkipLink } from '@/components/layout/skip-link'
import { APP } from '@/config/app'
import './globals.css'

/*
 * Poppins e a fonte oficial da Boop (reference/brand/TYPOGRAPHY.md).
 * Carregamos exatamente os quatro pesos usados pelo sistema tipografico:
 * 400 body · 500 label · 600 metadata e titulo funcional · 700 display.
 * Nenhum peso a mais — cada um custa uma requisicao e bytes no critical path.
 */
const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

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
  themeColor: '#fffdf5',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={APP.locale} className={poppins.variable}>
      <body className="font-sans antialiased">
        <SkipLink />
        {children}
      </body>
    </html>
  )
}
