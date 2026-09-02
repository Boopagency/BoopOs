import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Container } from '@/components/layout/container'
import { SectionHeading } from '@/components/patterns/section-heading'
import { createClientAction } from '@/domains/clients/actions'
import { ClientForm } from '@/domains/clients/components/client-form'
import { requireBoop } from '@/lib/auth/authorization'
import { can } from '@/lib/auth/policy'

export const metadata: Metadata = { title: 'Novo cliente' }

/**
 * Criar cliente. `boop_admin` e mais ninguém.
 *
 * O `can()` aqui produz 404 — e não 403 —, porque confirmar que a tela existe
 * já diria a um `boop_member` que a operação existe e não é dele. O workflow
 * nega de novo, e `clients_insert` exige `is_boop_admin()` no banco: três
 * camadas para a mesma decisão, que é o desenho (docs/permissions.md).
 */
export default async function NewClientPage() {
  const actor = await requireBoop()

  if (!can(actor, 'client.create').allowed) notFound()

  return (
    <Container size="narrow">
      <Link
        href="/admin/clientes"
        className="t-meta text-muted hover:text-foreground inline-flex items-center gap-2"
      >
        <span aria-hidden="true">←</span> Clientes
      </Link>

      <SectionHeading
        as="h1"
        title="Novo cliente"
        lead="O nome é o que a marca vê. O identificador é interno e não muda depois."
        className="mt-8"
      />

      <div className="mt-12">
        <ClientForm action={createClientAction} submitLabel="Criar cliente" />
      </div>
    </Container>
  )
}
