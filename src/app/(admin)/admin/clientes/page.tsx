import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/layout/container'
import { SectionHeading } from '@/components/patterns/section-heading'
import { ButtonLink } from '@/components/ui/button'
import { ClientStatusMark } from '@/domains/clients/components/client-status-mark'
import { listClientsForBoop } from '@/domains/clients/queries'
import { countMembersByClientForBoop } from '@/domains/people/queries'
import { getActor } from '@/lib/auth/actor'
import { can } from '@/lib/auth/policy'

export const metadata: Metadata = { title: 'Clientes' }

/**
 * A lista de clientes — dado real do Supabase, sem mock.
 *
 * Duas consultas para a tela inteira: os clientes e a contagem de vínculos.
 * Não é uma consulta por linha, e não é um agregado embutido — com dezenas de
 * clientes, duas consultas óbvias valem mais do que uma esperta (§38).
 *
 * ## Lista, não tabela
 *
 * Cada cliente é uma linha empilhável: nome, identificador, status, pessoas.
 * Uma tabela de quatro colunas viraria scroll horizontal em qualquer celular, e
 * a regra não abre exceção nem para tela interna.
 *
 * ## Por que não `requireBoopAdmin`
 *
 * `client.list` é `escopo` para `boop_member` na matriz, não `—`: a lista é da
 * Boop inteira, e quem restringe o que cada um enxerga é a RLS. O guard de
 * papel está no layout do grupo (`requireBoop`), e `listClientsForBoop()`
 * repete-o por dentro.
 *
 * ## Estados
 *
 * `loading` em `loading.tsx`, `erro` no `error.tsx` do grupo, `vazio` aqui
 * embaixo. O vazio não diz "nenhum dado": diz o que fazer em seguida.
 */
export default async function ClientListPage() {
  const [clients, memberCounts, actor] = await Promise.all([
    listClientsForBoop(),
    countMembersByClientForBoop(),
    getActor(),
  ])

  /* Conveniência de UI. Quem der POST direto é recusado pelo workflow e pela RLS. */
  const canCreate = actor ? can(actor, 'client.create').allowed : false

  return (
    <Container>
      <SectionHeading
        as="h1"
        eyebrow="Operação"
        title="Clientes"
        lead="Cada cliente é um tenant. Tudo o que a Boop entrega pertence a exatamente um deles."
        action={
          canCreate ? <ButtonLink href="/admin/clientes/novo">Novo cliente</ButtonLink> : undefined
        }
      />

      {clients.length === 0 ? (
        <div className="border-rule mt-12 border-t pt-10">
          <p className="t-lead text-foreground max-w-[34ch]">Nenhum cliente por aqui ainda.</p>
          <p className="t-body text-muted mt-3 max-w-[46ch]">
            O primeiro cliente abre o caminho para projeto, estratégia e conteúdo. Comece por ele.
          </p>
          {canCreate && (
            <ButtonLink href="/admin/clientes/novo" className="mt-8">
              Criar o primeiro cliente
            </ButtonLink>
          )}
        </div>
      ) : (
        <ul className="border-rule divide-rule mt-12 divide-y border-t">
          {clients.map((client) => {
            const members = memberCounts.get(client.id) ?? 0

            return (
              <li key={client.id}>
                <Link
                  href={`/admin/clientes/${client.id}`}
                  className="hover:bg-surface-soft/50 -mx-3 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 px-3 py-5 transition-colors duration-[--motion-fast]"
                >
                  <div className="min-w-0">
                    <p className="t-lead text-foreground">{client.name}</p>
                    <p className="t-label text-muted mt-1">{client.slug}</p>
                  </div>

                  <div className="flex items-center gap-6">
                    <span className="t-label text-muted">
                      {members === 0
                        ? 'sem pessoas'
                        : members === 1
                          ? '1 pessoa'
                          : `${members} pessoas`}
                    </span>
                    <ClientStatusMark status={client.status} />
                    <span aria-hidden="true" className="text-muted">
                      →
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Container>
  )
}
