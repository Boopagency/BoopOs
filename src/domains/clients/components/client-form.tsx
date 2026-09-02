'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Field, Input, Textarea } from '@/components/ui/field'
import { fieldMessage, messageFor } from '@/config/messages'
import { IDLE, type ActionState } from '@/lib/workflow/action-state'

/**
 * Formulario de cliente — criar e editar, o mesmo componente.
 *
 * Os dois formularios tem os mesmos campos, a mesma validacao e o mesmo
 * tratamento de erro; separa-los produziria duas copias que divergem na
 * terceira mudanca. O que muda entre eles e a action e o rotulo do botao, e
 * isso vira parametro.
 *
 * `slug` so aparece na criacao: e identificador interno e nao e editavel
 * depois (ver `schemas.ts`). No modo edicao ele e mostrado como texto, para
 * quem administra saber qual e — e nao como campo desabilitado, que parece
 * quebrado.
 */
export function ClientForm({
  action,
  submitLabel,
  client,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  submitLabel: string
  client?: { id: string; name: string; slug: string; notes: string | null }
}) {
  const [state, formAction, isPending] = useActionState(action, IDLE)

  const editing = Boolean(client)
  const nameError = fieldMessage(state.fieldErrors, 'name')
  const slugError = fieldMessage(state.fieldErrors, 'slug')
  const notesError = fieldMessage(state.fieldErrors, 'notes')

  return (
    <form action={formAction} className="max-w-xl space-y-8">
      {state.status === 'error' && <Callout tone="danger">{messageFor(state.code)}</Callout>}

      {state.status === 'success' && state.message && (
        <Callout tone="success">{state.message}</Callout>
      )}

      {client && <input type="hidden" name="clientId" value={client.id} />}

      <Field label="Nome da marca" required {...(nameError ? { error: nameError } : {})}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            name="name"
            required
            maxLength={120}
            disabled={isPending}
            defaultValue={client?.name ?? ''}
            placeholder="Hartmann Advogados"
          />
        )}
      </Field>

      {editing ? (
        <div className="space-y-2.5">
          <p className="t-label text-foreground">Identificador</p>
          <p className="t-body text-muted">{client?.slug}</p>
          <p className="t-label text-muted">
            Definido na criação e não editável. Ele não aparece em nenhuma tela do cliente.
          </p>
        </div>
      ) : (
        <Field
          label="Identificador"
          required
          help="Uso interno, em minúsculas e com hífen. Ex.: hartmann-advogados"
          {...(slugError ? { error: slugError } : {})}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              name="slug"
              required
              maxLength={60}
              disabled={isPending}
              placeholder="hartmann-advogados"
            />
          )}
        </Field>
      )}

      {/*
        ⚠️ CAMPO INTERNO. Esta e a unica tela do sistema que escreve
        `clients.notes`, e ela vive sob `requireBoop()`. O aviso abaixo nao e
        decorativo: e o que impede alguem escrever aqui algo achando que o
        cliente vai ler (docs/security.md).
      */}
      <Field
        label="Notas internas"
        help="Só a Boop vê. O cliente nunca tem acesso a este campo."
        {...(notesError ? { error: notesError } : {})}
      >
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            name="notes"
            rows={5}
            maxLength={4000}
            disabled={isPending}
            defaultValue={client?.notes ?? ''}
            placeholder="Contexto da conta, combinados, histórico."
          />
        )}
      </Field>

      <div className="flex items-center gap-6">
        {/* `disabled` durante o envio: o duplo clique no celular e o caso comum. */}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? 'Salvando…' : submitLabel}
        </Button>
      </div>

      {/*
        Só o estado de ENVIO. A mensagem de sucesso já é anunciada pelo
        `Callout`, que tem `role="status"` — repeti-la aqui faria o leitor de
        tela dizer a mesma frase duas vezes.
      */}
      <p aria-live="polite" className="sr-only">
        {isPending ? 'Salvando.' : ''}
      </p>
    </form>
  )
}
