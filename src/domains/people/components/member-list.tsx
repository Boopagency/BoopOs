'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { PROFILE_STATUS_LABEL, USER_ROLE_LABEL } from '@/config/enums'
import { messageFor } from '@/config/messages'
import { grantClientAccessAction, revokeClientAccessAction } from '@/domains/people/actions'
import { IDLE } from '@/lib/workflow/action-state'
import type { AssignablePerson, ClientMember } from '@/domains/people/types'

/**
 * Quem alcança este cliente, e os dois gestos sobre isso: dar e remover acesso.
 *
 * ## Lista, e não tabela
 *
 * Mesmo sendo tela interna. Uma tabela de cinco colunas vira scroll horizontal
 * em qualquer celular, e a regra é explícita: nunca tabela com scroll
 * horizontal no celular. A lista empilha e não precisa de exceção.
 *
 * ## Sobre `boop_admin` não aparecer aqui
 *
 * Ele alcança todos os clientes por papel global (D-08) e não tem vínculo. A
 * lista mostra vínculos, então mostrá-lo exigiria uma linha falsa — e "remover
 * acesso" nela não removeria nada.
 */
export function MemberList({
  clientId,
  members,
  assignable,
}: {
  clientId: string
  members: ClientMember[]
  assignable: AssignablePerson[]
}) {
  const [grantState, grantAction, grantPending] = useActionState(grantClientAccessAction, IDLE)
  const [revokeState, revokeAction, revokePending] = useActionState(revokeClientAccessAction, IDLE)

  const state = revokeState.status !== 'idle' ? revokeState : grantState

  return (
    <div className="space-y-8">
      {state.status === 'error' && <Callout tone="danger">{messageFor(state.code)}</Callout>}
      {state.status === 'success' && state.message && (
        <Callout tone="success">{state.message}</Callout>
      )}

      {/* Bloco vazio desaparece — mas aqui a ausência é o próprio recado. */}
      {members.length === 0 ? (
        <p className="t-body text-muted measure">
          Ninguém tem acesso a este cliente ainda. Convide a primeira pessoa abaixo — ela recebe o
          link de entrada por e-mail.
        </p>
      ) : (
        <ul className="border-rule divide-rule divide-y border-t">
          {members.map((member) => (
            <li
              key={member.membershipId}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
            >
              <div className="min-w-0">
                <p className="t-body text-foreground">{member.fullName ?? member.email}</p>
                <p className="t-label text-muted mt-1">
                  {member.fullName ? `${member.email} · ` : ''}
                  {USER_ROLE_LABEL[member.role]}
                  {member.status !== 'active' && ` · ${PROFILE_STATUS_LABEL[member.status]}`}
                </p>
              </div>

              <form action={revokeAction}>
                <input type="hidden" name="membershipId" value={member.membershipId} />
                <Button type="submit" variant="quiet" disabled={revokePending}>
                  Remover acesso
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {assignable.length > 0 && (
        <form
          action={grantAction}
          className="border-rule flex flex-wrap items-end gap-4 border-t pt-6"
        >
          <input type="hidden" name="clientId" value={clientId} />

          <div className="min-w-0 flex-1 space-y-2.5">
            <label htmlFor="grant-user" className="t-label text-foreground block">
              Dar acesso a alguém que já tem conta
            </label>
            <select
              id="grant-user"
              name="userId"
              required
              disabled={grantPending}
              defaultValue=""
              className="border-rule-strong bg-surface text-foreground t-body hover:border-muted focus:border-accent-text h-12 w-full rounded-sm border px-4"
            >
              <option value="" disabled>
                Escolha uma pessoa
              </option>
              {assignable.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName ?? person.email} — {USER_ROLE_LABEL[person.role]}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" variant="outline" disabled={grantPending}>
            {grantPending ? 'Dando acesso…' : 'Dar acesso'}
          </Button>
        </form>
      )}

      {/* Só o envio: o `Callout` já anuncia o resultado (role="status"). */}
      <p aria-live="polite" className="sr-only">
        {grantPending || revokePending ? 'Atualizando acessos.' : ''}
      </p>
    </div>
  )
}
