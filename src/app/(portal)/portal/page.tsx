import type { Metadata } from 'next'
import { Container } from '@/components/layout/container'
import { PORTAL_NAV } from '@/config/app'

export const metadata: Metadata = {
  title: 'Client Portal',
}

export default function PortalPage() {
  return (
    <Container size="narrow">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Client Portal</h1>
      <p className="text-muted mt-4 max-w-prose">
        Foundation ready. O sistema visual da Boop vem a seguir.
      </p>

      <section aria-labelledby="nav-preview" className="mt-10">
        <h2 id="nav-preview" className="text-sm font-medium">
          Navegacao prevista
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {PORTAL_NAV.map((item) => (
            <li
              key={item.key}
              className="border-border text-muted rounded-[--radius] border px-3 py-1.5 text-sm"
            >
              {item.label}
            </li>
          ))}
        </ul>
      </section>
    </Container>
  )
}
