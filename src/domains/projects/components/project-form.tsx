'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Field, Input, Select } from '@/components/ui/field'
import { PROJECT_TYPE_LABEL, PROJECT_TYPES, type ProjectType } from '@/config/enums'
import { JOURNEY_TEMPLATES, JOURNEY_BY_TYPE } from '@/config/journeys'
import { fieldMessage, messageFor } from '@/config/messages'
import { IDLE, type ActionState } from '@/lib/workflow/action-state'

/**
 * Formulario de projeto — criar e editar, o mesmo componente.
 *
 * ## O que muda entre os dois modos, e por que
 *
 * Na CRIACAO existe o campo `type`; na EDICAO ele vira texto. Nao e um campo
 * desabilitado — campo desabilitado parece defeito —, e nao e uma omissao: o
 * tipo e a jornada de um projeto sao IMUTAVEIS no banco desde
 * `20260903010349_immutable_journey_binding.sql`, porque as etapas ja
 * materializadas nao podem discordar do template que as gerou. Oferecer o campo
 * produziria um formulario que salva e o banco rejeita.
 *
 * ## `journey_key` nao aparece em lugar nenhum
 *
 * Quem cria um projeto escolhe "Social media", nao `social.v1`. A chave e
 * derivada do tipo no servidor (`JOURNEY_BY_TYPE`) e nao existe como campo —
 * nem visivel, nem escondido. O que a tela mostra e a CONSEQUENCIA da escolha:
 * quantas etapas a jornada tera, e quais. E a informacao util; a chave e
 * vocabulario interno (.claude/rules/frontend.md).
 */

export function ProjectForm({
  action,
  submitLabel,
  clientId,
  project,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  submitLabel: string
  /** Presente só na criação: o projeto nasce dentro de um cliente. */
  clientId?: string
  project?: {
    id: string
    name: string
    type: ProjectType
    startedOn: string | null
    endsOn: string | null
  }
}) {
  const [state, formAction, isPending] = useActionState(action, IDLE)

  const editing = Boolean(project)
  const nameError = fieldMessage(state.fieldErrors, 'name')
  const typeError = fieldMessage(state.fieldErrors, 'type')
  const startsError = fieldMessage(state.fieldErrors, 'startsOn')
  const endsError = fieldMessage(state.fieldErrors, 'endsOn')

  return (
    <form action={formAction} className="max-w-xl space-y-8">
      {state.status === 'error' && <Callout tone="danger">{messageFor(state.code)}</Callout>}

      {state.status === 'success' && state.message && (
        <Callout tone="success">{state.message}</Callout>
      )}

      {project && <input type="hidden" name="projectId" value={project.id} />}
      {clientId && <input type="hidden" name="clientId" value={clientId} />}

      <Field label="Nome do projeto" required {...(nameError ? { error: nameError } : {})}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            name="name"
            required
            maxLength={120}
            disabled={isPending}
            defaultValue={project?.name ?? ''}
            placeholder="Social Media 2026"
          />
        )}
      </Field>

      {editing ? (
        <div className="space-y-2.5">
          <p className="t-label text-foreground">Tipo</p>
          <p className="t-body text-muted">{project ? PROJECT_TYPE_LABEL[project.type] : ''}</p>
          <p className="t-label text-muted">
            Definido na criação. O tipo decide a jornada, e as etapas já criadas não podem discordar
            dela — para mudar, crie um projeto novo e arquive este.
          </p>
        </div>
      ) : (
        <Field
          label="Tipo de projeto"
          required
          help="O tipo define a jornada: as etapas que o cliente vai acompanhar."
          {...(typeError ? { error: typeError } : {})}
        >
          {({ id, describedBy, invalid }) => (
            <Select
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              name="type"
              required
              disabled={isPending}
              defaultValue="social"
            >
              {PROJECT_TYPES.map((type) => {
                const template = JOURNEY_TEMPLATES[JOURNEY_BY_TYPE[type]]
                return (
                  <option key={type} value={type}>
                    {PROJECT_TYPE_LABEL[type]}
                    {template ? ` — ${template.stages.length} etapas` : ''}
                  </option>
                )
              })}
            </Select>
          )}
        </Field>
      )}

      <div className="grid gap-8 sm:grid-cols-2">
        <Field
          label="Início"
          help="Opcional. Sem data, o portal não mostra desde quando."
          {...(startsError ? { error: startsError } : {})}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              type="date"
              name="startsOn"
              disabled={isPending}
              defaultValue={project?.startedOn ?? ''}
            />
          )}
        </Field>

        {/* `ends_on` só na edição: um projeto raramente nasce com data de fim,
            e o banco tem `check (ends_on >= starts_on)` — pedir os dois na
            criação convidaria ao erro antes de haver o que planejar. */}
        {editing && (
          <Field label="Fim previsto" {...(endsError ? { error: endsError } : {})}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                type="date"
                name="endsOn"
                disabled={isPending}
                defaultValue={project?.endsOn ?? ''}
              />
            )}
          </Field>
        )}
      </div>

      <div className="flex items-center gap-6">
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? 'Salvando…' : submitLabel}
        </Button>
      </div>

      {/* Só o estado de ENVIO: o `Callout` tem `role="status"` e já anuncia o
          resultado — repetir aqui faria o leitor de tela falar duas vezes. */}
      <p aria-live="polite" className="sr-only">
        {isPending ? 'Salvando.' : ''}
      </p>
    </form>
  )
}
