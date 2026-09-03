'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { messageFor } from '@/config/messages'
import { advanceStageAction, setStageStateAction } from '@/domains/projects/actions'
import type { ProjectStageAdmin } from '@/domains/projects/types'
import { IDLE, type ActionState } from '@/lib/workflow/action-state'
import { formatFullDate } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * A jornada do lado da Boop: ver onde esta, avancar, e corrigir.
 *
 * ## Duas acoes com pesos diferentes, de proposito
 *
 * **Avancar** e o gesto normal, e e um botao proprio, grande, no topo. Fechar a
 * etapa corrente e abrir a proxima e o que acontece toda semana.
 *
 * **Corrigir** e excecao — pular uma etapa, voltar — e vive dentro de cada
 * linha, discreto. Nao e uma acao destrutiva, mas reescreve o que o cliente ve,
 * e nao deve competir visualmente com o avanco.
 *
 * Isso NAO e o par "aprovar / pedir ajuste", que a regra manda ter a mesma
 * prominencia: aquele e uma decisao do cliente entre duas saidas legitimas.
 * Aqui sao duas coisas diferentes — o fluxo e o conserto do fluxo.
 *
 * ## Sem percentual
 *
 * A jornada e o progresso. O que a tela diz e "3 de 8 etapas encerradas", que
 * e uma frase, e nunca "37%", que e um numero sem significado
 * (docs/design-direction.md).
 */

const STATE_LABEL: Record<ProjectStageAdmin['state'], string> = {
  pending: 'A seguir',
  current: 'Em andamento',
  done: 'Concluída',
  skipped: 'Pulada',
}

const DOT: Record<ProjectStageAdmin['state'], string> = {
  pending: 'bg-rule-strong',
  current: 'bg-accent',
  done: 'bg-navy',
  skipped: 'bg-rule-strong/40',
}

export function JourneyControls({
  projectId,
  stages,
  canManage,
}: {
  projectId: string
  stages: ProjectStageAdmin[]
  /**
   * Vem de `can()` no servidor. E conveniencia, nao seguranca: o workflow nega
   * de novo e as funcoes SQL negam em terceiro lugar
   * (docs/permissions.md#onde-a-permissao-e-aplicada).
   */
  canManage: boolean
}) {
  const [advanceState, advance, advancePending] = useActionState(advanceStageAction, IDLE)
  const [correctState, correct, correctPending] = useActionState(setStageStateAction, IDLE)

  const state: ActionState = correctState.status !== 'idle' ? correctState : advanceState
  const current = stages.find((stage) => stage.state === 'current')
  const settled = stages.filter((s) => s.state === 'done' || s.state === 'skipped').length
  const pending = stages.filter((s) => s.state === 'pending').length

  return (
    <div className="space-y-8">
      {state.status === 'error' && <Callout tone="danger">{messageFor(state.code)}</Callout>}
      {state.status === 'success' && state.message && (
        <Callout tone="success">{state.message}</Callout>
      )}

      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="t-meta text-muted">Onde estamos</p>
          <p className="t-title text-foreground mt-2">
            {current
              ? current.label
              : pending > 0
                ? 'Nenhuma etapa em andamento'
                : 'Jornada concluída'}
          </p>
          <p className="t-label text-muted mt-1">
            {settled} de {stages.length} etapas encerradas
          </p>
        </div>

        {canManage && current && (
          <form action={advance}>
            <input type="hidden" name="projectId" value={projectId} />
            <Button type="submit" disabled={advancePending || correctPending}>
              {advancePending ? 'Avançando…' : 'Avançar etapa'}
            </Button>
          </form>
        )}
      </div>

      {/*
        Sem etapa corrente e com etapa pendente e o estado que `advanceStage`
        recusa avancar. A tela diz o que fazer em vez de esconder o problema —
        e a acao esta na propria linha, em "Retomar aqui".
      */}
      {canManage && !current && pending > 0 && (
        <Callout tone="warning">
          Este projeto não tem etapa em andamento. Escolha por onde retomar antes de avançar.
        </Callout>
      )}

      <ol className="divide-rule border-rule divide-y border-y">
        {stages.map((stage) => (
          <li key={stage.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 py-5">
            <span
              aria-hidden="true"
              className={cn('h-2 w-2 shrink-0 rounded-full', DOT[stage.state])}
            />

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  't-title',
                  stage.state === 'current' ? 'text-foreground' : 'text-muted',
                )}
              >
                {stage.position}. {stage.label}
              </p>
              <p className="t-label text-muted mt-1">
                {STATE_LABEL[stage.state]}
                {stage.completedOn && ` · ${formatFullDate(stage.completedOn)}`}
              </p>
            </div>

            {canManage && (
              <div className="flex flex-wrap gap-2">
                {stage.state !== 'current' && (
                  <StageAction
                    action={correct}
                    projectId={projectId}
                    stageId={stage.id}
                    state="current"
                    pending={correctPending || advancePending}
                    label="Retomar aqui"
                  />
                )}
                {stage.state === 'pending' && (
                  <StageAction
                    action={correct}
                    projectId={projectId}
                    stageId={stage.id}
                    state="skipped"
                    pending={correctPending || advancePending}
                    label="Pular"
                  />
                )}
                {(stage.state === 'done' || stage.state === 'skipped') && (
                  <StageAction
                    action={correct}
                    projectId={projectId}
                    stageId={stage.id}
                    state="pending"
                    pending={correctPending || advancePending}
                    label="Reabrir"
                  />
                )}
              </div>
            )}
          </li>
        ))}
      </ol>

      <p aria-live="polite" className="sr-only">
        {advancePending || correctPending ? 'Atualizando a jornada.' : ''}
      </p>
    </div>
  )
}

/** Um botão de correção. Existe para os três não repetirem o mesmo `form`. */
function StageAction({
  action,
  projectId,
  stageId,
  state,
  pending,
  label,
}: {
  action: (formData: FormData) => void
  projectId: string
  stageId: string
  state: ProjectStageAdmin['state']
  pending: boolean
  label: string
}) {
  return (
    <form action={action}>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="stageId" value={stageId} />
      <input type="hidden" name="state" value={state} />
      <Button type="submit" variant="outline" disabled={pending}>
        {label}
      </Button>
    </form>
  )
}
