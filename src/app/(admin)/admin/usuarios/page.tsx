import type { Metadata } from 'next'
import { Container } from '@/components/layout/container'
import { SectionHeading } from '@/components/patterns/section-heading'
import { PROFILE_STATUS_LABEL, USER_ROLE_LABEL } from '@/config/enums'
import { listClientsForBoop } from '@/domains/clients/queries'
import { DisablePersonButton } from '@/domains/people/components/disable-person-button'
import { InviteForm } from '@/domains/people/components/invite-form'
import { listPeopleForBoop } from '@/domains/people/queries'
import { requireBoop } from '@/lib/auth/authorization'
import { can } from '@/lib/auth/policy'
import { cn } from '@/lib/cn'

export const metadata: Metadata = { title: 'Pessoas' }

/**
 * As pessoas do sistema — `profiles`, com dado real.
 *
 * ## Papel global, escopo por vínculo
 *
 * A tela mostra os dois porque eles respondem perguntas diferentes: o papel diz
 * o que a pessoa PODE FAZER, o número de clientes diz SOBRE O QUE. Um
 * `boop_admin` aparece com zero clientes e alcança todos — é o D-08, e a nota
 * embaixo da lista existe para isso não parecer bug.
 *
 * ## Quem aparece
 *
 * O que a RLS conceder. `boop_admin` vê todo mundo; `boop_member` vê quem
 * divide um cliente com ele (`app.has_profile_access`). Nenhum filtro aqui.
 */
export default async function PeoplePage() {
  const actor = await requireBoop()
  const canInvite = can(actor, 'user.invite').allowed
  const canDisable = can(actor, 'user.disable').allowed

  const [people, clients] = await Promise.all([
    listPeopleForBoop(),
    /* O seletor de cliente do convite só faz sentido para quem convida. */
    canInvite ? listClientsForBoop() : Promise.resolve([]),
  ])

  return (
    <Container>
      <SectionHeading
        as="h1"
        eyebrow="Operação"
        title="Pessoas"
        lead="Papel é global. O que cada pessoa alcança vem do vínculo com um cliente."
      />

      {people.length === 0 ? (
        <p className="t-body text-muted measure mt-12">
          Ninguém por aqui ainda. Convide a primeira pessoa abaixo.
        </p>
      ) : (
        <ul className="border-rule divide-rule mt-12 divide-y border-t">
          {people.map((person) => (
            <li
              key={person.id}
              className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 py-5"
            >
              <div className="min-w-0">
                <p className="t-body text-foreground">{person.fullName ?? person.email}</p>
                <p className="t-label text-muted mt-1">
                  {person.fullName ? `${person.email} · ` : ''}
                  {USER_ROLE_LABEL[person.role]}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <span
                  className={cn(
                    't-label',
                    person.status === 'active' ? 'text-muted' : 'text-warning',
                  )}
                >
                  {PROFILE_STATUS_LABEL[person.status]}
                </span>

                <span className="t-label text-muted">
                  {person.role === 'boop_admin'
                    ? 'todos os clientes'
                    : person.clientCount === 0
                      ? 'sem cliente'
                      : person.clientCount === 1
                        ? '1 cliente'
                        : `${person.clientCount} clientes`}
                </span>

                {/*
                  Não se desliga a si mesmo. A tela esconde o botão, e
                  `disable_profile()` recusa no banco — a segunda é a que vale:
                  sem caminho de volta na V0, o auto-desligamento tranca a porta
                  por dentro.
                */}
                {canDisable && person.status !== 'disabled' && person.id !== actor.userId && (
                  <DisablePersonButton userId={person.id} name={person.fullName ?? person.email} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="t-label text-muted mt-6">
        Um admin da Boop alcança todos os clientes por papel, sem vínculo (D-08).
      </p>

      {canInvite && (
        <section aria-labelledby="convite" className="border-rule mt-20 border-t pt-12">
          <h2 id="convite" className="t-title text-foreground">
            Convidar alguém
          </h2>
          <p className="t-body text-muted measure mt-3">
            A pessoa recebe um e-mail com link de entrada. Admins da Boop não se criam por aqui.
          </p>
          <div className="mt-8">
            <InviteForm clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
          </div>
        </section>
      )}
    </Container>
  )
}
