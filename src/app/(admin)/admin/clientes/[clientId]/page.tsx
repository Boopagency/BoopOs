import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/layout/container'
import { SectionHeading } from '@/components/patterns/section-heading'
import { updateClientAction } from '@/domains/clients/actions'
import { ClientForm } from '@/domains/clients/components/client-form'
import { ClientStatusControls } from '@/domains/clients/components/client-status-controls'
import { ClientStatusMark } from '@/domains/clients/components/client-status-mark'
import { getClientDetailForBoop } from '@/domains/clients/queries'
import { InviteForm } from '@/domains/people/components/invite-form'
import { MemberList } from '@/domains/people/components/member-list'
import { listAssignablePeopleForBoop, listClientMembersForBoop } from '@/domains/people/queries'
import { ProjectList } from '@/domains/projects/components/project-list'
import { listProjectsForClientForBoop } from '@/domains/projects/queries'
import { requireBoop } from '@/lib/auth/authorization'
import { can } from '@/lib/auth/policy'
import { formatDateTime } from '@/lib/format'

type Params = { params: Promise<{ clientId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { clientId } = await params
  const client = await getClientDetailForBoop(clientId)
  return { title: client.name }
}

/**
 * Detalhe do cliente. Dado real, e a única tela do sistema que mostra `notes`.
 *
 * ## O id da URL é endereço, nunca prova
 *
 * `clientId` vem de `/admin/clientes/[clientId]` e não autoriza nada. Quem
 * autoriza é `getClientDetailForBoop()`, que chama `requireBoop()`,
 * `requireClientAccess()` — que pergunta ao banco tentando ler a linha — e
 * `can('client.read_internal_notes')`. Trocar o uuid na barra de endereços dá
 * 404, igual a um uuid inventado (docs/security.md, §16-17 do briefing).
 *
 * ## O que a FASE 6 acrescentou
 *
 * A seção **Projetos**, que é o trabalho que a Boop executa para este cliente.
 * Ela vem primeiro porque é a pergunta que se faz ao abrir um cliente — "o que
 * estamos fazendo aqui?" —, antes de dados cadastrais e de quem acessa.
 *
 * ## O que continua NÃO estando aqui
 *
 * Estratégia, conteúdo e arquivos. São FASE 10 em diante, e a tela não finge
 * que existem: nenhum bloco vazio, nenhum "em breve". Bloco sem conteúdo
 * desaparece (.claude/rules/frontend.md).
 */
export default async function ClientDetailPage({ params }: Params) {
  const { clientId } = await params

  const [actor, client] = await Promise.all([requireBoop(), getClientDetailForBoop(clientId)])

  const canManageMembers = can(actor, 'membership.grant').allowed
  const canInvite = can(actor, 'user.invite').allowed

  /*
   * Só busca a lista de vínculos quem pode fazer alguma coisa com ela. Não é
   * economia de query: é a regra de não trazer do banco dado que a tela não
   * usa — e a lista carrega e-mail, que é PII.
   */
  const [members, assignable] = canManageMembers
    ? await Promise.all([listClientMembersForBoop(clientId), listAssignablePeopleForBoop(clientId)])
    : [[], []]

  const projects = await listProjectsForClientForBoop(clientId)
  const canCreateProject = can(actor, 'project.create').allowed

  return (
    <Container>
      <Link
        href="/admin/clientes"
        className="t-meta text-muted hover:text-foreground inline-flex items-center gap-2"
      >
        <span aria-hidden="true">←</span> Clientes
      </Link>

      <SectionHeading
        as="h1"
        eyebrow={client.slug}
        title={client.name}
        className="mt-8"
        action={<ClientStatusMark status={client.status} />}
      />

      <p className="t-label text-muted mt-6">
        Criado em {formatDateTime(client.createdAt)} · atualizado em{' '}
        {formatDateTime(client.updatedAt)}
      </p>

      <div className="mt-16 space-y-16">
        <section aria-labelledby="projetos">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
            <h2 id="projetos" className="t-title text-foreground">
              Projetos
            </h2>
            {/* Só quem cria vê o link. Conveniência, não segurança: a rota
                chama `requireCapability` e o workflow nega de novo. */}
            {canCreateProject && (
              <Link
                href={`/admin/clientes/${client.id}/projetos/novo`}
                className="t-meta text-muted decoration-rule-strong hover:text-foreground hover:decoration-accent underline underline-offset-[6px]"
              >
                Novo projeto →
              </Link>
            )}
          </div>
          <div className="mt-8">
            <ProjectList projects={projects} />
          </div>
        </section>

        <section aria-labelledby="dados">
          <h2 id="dados" className="t-title text-foreground">
            Dados da conta
          </h2>
          <div className="mt-8">
            <ClientForm
              action={updateClientAction}
              submitLabel="Salvar alterações"
              client={{
                id: client.id,
                name: client.name,
                slug: client.slug,
                notes: client.notes,
              }}
            />
          </div>
        </section>

        {canManageMembers && (
          <section aria-labelledby="pessoas">
            <h2 id="pessoas" className="t-title text-foreground">
              Quem acessa
            </h2>
            <p className="t-body text-muted measure mt-3">
              Vínculo concede escopo, nunca papel. Um admin da Boop alcança todos os clientes sem
              precisar de vínculo.
            </p>
            <div className="mt-8">
              <MemberList clientId={client.id} members={members} assignable={assignable} />
            </div>
          </section>
        )}

        {canInvite && (
          <section aria-labelledby="convite">
            <h2 id="convite" className="t-title text-foreground">
              Convidar alguém
            </h2>
            <div className="mt-8">
              <InviteForm clients={[]} fixedClientId={client.id} />
            </div>
          </section>
        )}

        <section aria-labelledby="status">
          <h2 id="status" className="t-title text-foreground">
            Status da conta
          </h2>
          <p className="t-body text-muted measure mt-3">
            Pausar suspende a operação sem apagar nada. Arquivar tira o cliente de circulação —
            também sem apagar: projetos, conteúdo e histórico de aprovação continuam.
          </p>
          <div className="mt-8">
            <ClientStatusControls
              clientId={client.id}
              status={client.status}
              canArchive={can(actor, 'client.archive').allowed}
            />
          </div>
        </section>
      </div>
    </Container>
  )
}
