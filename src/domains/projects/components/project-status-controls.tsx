'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { messageFor } from '@/config/messages'
import type { ProjectStatus } from '@/config/enums'
import { changeProjectStatusAction } from '@/domains/projects/actions'
import { IDLE } from '@/lib/workflow/action-state'

/**
 * As transicoes de status de um projeto.
 *
 * ## Uma capacidade so, e por isso um workflow so
 *
 * Diferente de cliente — que tem `client.update` para pausar e `client.archive`
 * para arquivar, capacidades diferentes com papeis diferentes —, projeto tem
 * uma linha unica na matriz: `project.change_status`, da Boop inteira. Entao
 * nao ha assimetria a modelar, e os botoes saem todos da mesma action.
 *
 * ## As transicoes oferecidas dependem de onde o projeto esta
 *
 * `draft` e o estado de nascimento: dali so se sai para `active`, e esse gesto
 * — "Ativar" — e o que faz o projeto aparecer no portal do cliente. E por isso
 * que a criacao nao ativa sozinha: um projeto meio configurado nao deve
 * aparecer para ninguem por acidente.
 *
 * `archived` nao oferece nada: e final nesta fase, e o texto diz isso em vez de
 * mostrar um botao que o workflow recusaria.
 */

/** O que se pode fazer a partir de cada status. Tabela, nao cadeia de `if`. */
const NEXT: Record<ProjectStatus, { status: ProjectStatus; label: string }[]> = {
  draft: [{ status: 'active', label: 'Ativar projeto' }],
  active: [
    { status: 'paused', label: 'Pausar' },
    { status: 'completed', label: 'Concluir' },
    { status: 'archived', label: 'Arquivar' },
  ],
  paused: [
    { status: 'active', label: 'Retomar' },
    { status: 'completed', label: 'Concluir' },
    { status: 'archived', label: 'Arquivar' },
  ],
  completed: [
    { status: 'active', label: 'Reabrir' },
    { status: 'archived', label: 'Arquivar' },
  ],
  archived: [],
}

export function ProjectStatusControls({
  projectId,
  status,
  canManage,
}: {
  projectId: string
  status: ProjectStatus
  canManage: boolean
}) {
  const [state, action, pending] = useActionState(changeProjectStatusAction, IDLE)

  const options = canManage ? NEXT[status] : []

  return (
    <div className="space-y-4">
      {state.status === 'error' && <Callout tone="danger">{messageFor(state.code)}</Callout>}
      {state.status === 'success' && state.message && (
        <Callout tone="success">{state.message}</Callout>
      )}

      {status === 'draft' && (
        <p className="t-body text-muted measure">
          Um projeto em rascunho não aparece para o cliente. Ative quando a jornada estiver como
          você quer.
        </p>
      )}

      {options.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {options.map((option) => (
            <form key={option.status} action={action}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="status" value={option.status} />
              <Button
                type="submit"
                /* Ativar um rascunho é o gesto principal desta tela; os demais
                   são movimentos de rotina e ficam em contorno. */
                variant={option.status === 'active' && status === 'draft' ? 'primary' : 'outline'}
                disabled={pending}
              >
                {option.label}
              </Button>
            </form>
          ))}
        </div>
      )}

      {status === 'archived' && (
        <p className="t-label text-muted">
          Projeto arquivado. Nada foi apagado — a jornada e o histórico continuam. Reabrir não é
          possível pelo painel nesta versão.
        </p>
      )}

      {/* Só o envio: o `Callout` já anuncia o resultado (role="status"). */}
      <p aria-live="polite" className="sr-only">
        {pending ? 'Atualizando status.' : ''}
      </p>
    </div>
  )
}
