import type { Metadata } from 'next'
import { Container } from '@/components/layout/container'

export const metadata: Metadata = {
  title: 'Admin',
}

export default function AdminPage() {
  return (
    <Container size="narrow">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin</h1>
      <p className="text-muted mt-4 max-w-prose">
        Internal workspace foundation. A gestao de clientes, projetos e conteudo entra a partir da
        FASE 5.
      </p>
    </Container>
  )
}
