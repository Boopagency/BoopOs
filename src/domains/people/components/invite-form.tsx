'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Field, Input, Select } from '@/components/ui/field'
import { USER_ROLE_LABEL } from '@/config/enums'
import { fieldMessage, messageFor } from '@/config/messages'
import { inviteUserAction } from '@/domains/people/actions'
import { IDLE } from '@/lib/workflow/action-state'

/**
 * Convite. Cria a conta no Supabase Auth, define o papel e dá o vínculo.
 *
 * ## O seletor de papel tem dois itens, e não três
 *
 * `boop_admin` não está aqui, e a ausência é a mesma da matriz: existem
 * `user.invite_client_user` e `user.invite_boop_member`, e não existe a
 * terceira linha. Criar administrador é provisionamento com a chave de serviço
 * na mão de uma pessoa (`scripts/auth/provision-user.sh`), não uma tela.
 *
 * Isso é conveniência de UI. Quem der um POST com `role=boop_admin` é recusado
 * pelo zod, depois pelo workflow, depois por `assign_invited_profile_role()` no
 * banco — três vezes, e a última ignora completamente esta tela.
 */
export function InviteForm({
  clients,
  fixedClientId,
}: {
  /** Clientes que este ator alcança. Vazio quando o convite já tem cliente. */
  clients: { id: string; name: string }[]
  /** Quando o convite parte da tela de um cliente, ele não se escolhe. */
  fixedClientId?: string
}) {
  const [state, formAction, isPending] = useActionState(inviteUserAction, IDLE)
  const [role, setRole] = useState<'boop_member' | 'client_user'>('client_user')

  const emailError = fieldMessage(state.fieldErrors, 'email')
  const clientError = fieldMessage(state.fieldErrors, 'clientId')

  /*
   * O cliente é obrigatório para `client_user` e opcional para `boop_member`:
   * uma pessoa do cliente sem cliente entraria para ver uma tela vazia; alguém
   * da Boop sem vínculo é normal — o vínculo vem quando entrar numa conta.
   * A mesma regra está no `superRefine` do schema, que é quem de fato decide.
   */
  const clientRequired = role === 'client_user'

  return (
    <form action={formAction} className="max-w-xl space-y-8">
      {state.status === 'error' && <Callout tone="danger">{messageFor(state.code)}</Callout>}
      {state.status === 'success' && state.message && (
        <Callout tone="success">{state.message}</Callout>
      )}

      <Field label="E-mail" required {...(emailError ? { error: emailError } : {})}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            type="email"
            name="email"
            autoComplete="off"
            required
            disabled={isPending}
            placeholder="pessoa@marca.com.br"
          />
        )}
      </Field>

      <Field label="Nome" help="Opcional. Aparece no lugar do e-mail nas telas internas.">
        {({ id, describedBy }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            name="fullName"
            maxLength={120}
            disabled={isPending}
            placeholder="Ana Hartmann"
          />
        )}
      </Field>

      <Field label="Papel" required>
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            name="role"
            value={role}
            disabled={isPending}
            onChange={(event) => setRole(event.target.value as typeof role)}
          >
            <option value="client_user">{USER_ROLE_LABEL.client_user}</option>
            <option value="boop_member">{USER_ROLE_LABEL.boop_member}</option>
          </Select>
        )}
      </Field>

      {fixedClientId ? (
        <input type="hidden" name="clientId" value={fixedClientId} />
      ) : (
        <Field
          label="Cliente"
          required={clientRequired}
          help={
            clientRequired
              ? 'A conta que essa pessoa vai acessar.'
              : 'Opcional para o time da Boop. O vínculo pode vir depois.'
          }
          {...(clientError ? { error: clientError } : {})}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              name="clientId"
              required={clientRequired}
              disabled={isPending}
              defaultValue=""
            >
              <option value="">{clientRequired ? 'Escolha o cliente' : 'Sem cliente'}</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      <Button type="submit" size="lg" disabled={isPending}>
        {isPending ? 'Enviando…' : 'Enviar convite'}
      </Button>

      {/* Só o envio: o `Callout` já anuncia o resultado (role="status"). */}
      <p aria-live="polite" className="sr-only">
        {isPending ? 'Enviando o convite.' : ''}
      </p>

      <p className="t-label text-muted">
        A pessoa recebe um e-mail com link de entrada. Não existe senha: o acesso é sempre por link.
      </p>
    </form>
  )
}
