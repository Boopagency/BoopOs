import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/layout/container'
import { SectionHeading } from '@/components/patterns/section-heading'
import { getClientDetailForBoop } from '@/domains/clients/queries'
import { createProjectAction } from '@/domains/projects/actions'
import { ProjectForm } from '@/domains/projects/components/project-form'
import { requireCapability } from '@/lib/auth/authorization'

export const metadata: Metadata = { title: 'Novo projeto' }

type Params = { params: Promise<{ clientId: string }> }

/**
 * Criação de projeto. Só `boop_admin` — 404 para os demais.
 *
 * `requireCapability('project.create')` responde 404, e não 403: um
 * `boop_member` não deve descobrir que a rota existe pela diferença entre as
 * duas respostas (docs/security.md).
 *
 * `getClientDetailForBoop()` carrega o próprio guard e confirma o escopo — o
 * `clientId` da URL é endereço, nunca prova. Ele também é quem dá o nome do
 * cliente para o cabeçalho, e é a razão de esta página não precisar de
 * `requireClientAccess` explícito.
 *
 * ## O que o formulário NÃO pergunta
 *
 * A jornada. Ela é consequência do tipo (`JOURNEY_BY_TYPE`), resolvida no
 * servidor, e as etapas são materializadas na mesma transação que cria o
 * projeto. Perguntar duas vezes a mesma coisa — tipo e jornada — abriria a
 * chance de as duas discordarem, que é exatamente o que a imutabilidade das
 * duas colunas no banco existe para impedir.
 */
export default async function NewProjectPage({ params }: Params) {
  const { clientId } = await params

  await requireCapability('project.create')
  const client = await getClientDetailForBoop(clientId)

  return (
    <Container>
      <Link
        href={`/admin/clientes/${client.id}`}
        className="t-meta text-muted hover:text-foreground inline-flex items-center gap-2"
      >
        <span aria-hidden="true">←</span> {client.name}
      </Link>

      <SectionHeading
        as="h1"
        eyebrow={client.name}
        title="Novo projeto"
        lead="O tipo define a jornada que o cliente vai acompanhar. As etapas são criadas junto com o projeto, e a primeira já nasce em andamento."
        className="mt-8"
      />

      <div className="mt-16">
        <ProjectForm
          action={createProjectAction}
          submitLabel="Criar projeto"
          clientId={client.id}
        />
      </div>

      <p className="t-label text-muted measure mt-10">
        O projeto nasce como rascunho e não aparece para o cliente. Ative quando a jornada estiver
        como você quer.
      </p>
    </Container>
  )
}
