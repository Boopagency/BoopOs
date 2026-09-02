'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { messageFor } from '@/config/messages'
import type { ClientStatus } from '@/config/enums'
import { setClientArchivedAction, setClientStatusAction } from '@/domains/clients/actions'
import { IDLE, type ActionState } from '@/lib/workflow/action-state'

/**
 * Pausar, retomar, arquivar e desarquivar.
 *
 * As quatro sao a mesma tabela e dois workflows, porque sao duas decisoes com
 * capacidades diferentes na matriz: `client.update` e da Boop inteira e move
 * entre `active` e `paused`; `client.archive` e so do administrador e cuida do
 * `archived` nas duas direcoes.
 *
 * A tela mostra so o que este ator pode fazer — `canArchive` vem do servidor,
 * de `can()`. Isso e conveniencia, nao seguranca: o workflow nega de novo, e a
 * RLS nega em terceiro lugar (docs/permissions.md#onde-a-permissao-e-aplicada).
 *
 * Nao ha DELETE, e nao ha botao de excluir: a matriz tem `client.archive`, e
 * `clients` nao tem policy de DELETE para ninguem. Apagar arrastaria projeto,
 * conteudo e historico de aprovacao.
 */
export function ClientStatusControls({
  clientId,
  status,
  canArchive,
}: {
  clientId: string
  status: ClientStatus
  canArchive: boolean
}) {
  const [statusState, statusAction, statusPending] = useActionState(setClientStatusAction, IDLE)
  const [archiveState, archiveAction, archivePending] = useActionState(
    setClientArchivedAction,
    IDLE,
  )

  const state: ActionState = archiveState.status !== 'idle' ? archiveState : statusState
  const archived = status === 'archived'

  return (
    <div className="space-y-4">
      {state.status === 'error' && <Callout tone="danger">{messageFor(state.code)}</Callout>}
      {state.status === 'success' && state.message && (
        <Callout tone="success">{state.message}</Callout>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!archived && (
          <form action={statusAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="status" value={status === 'active' ? 'paused' : 'active'} />
            <Button type="submit" variant="outline" disabled={statusPending}>
              {status === 'active' ? 'Pausar conta' : 'Retomar conta'}
            </Button>
          </form>
        )}

        {canArchive && (
          <form action={archiveAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="archived" value={archived ? 'false' : 'true'} />
            <Button type="submit" variant="outline" disabled={archivePending}>
              {archived ? 'Desarquivar' : 'Arquivar'}
            </Button>
          </form>
        )}
      </div>

      {archived && !canArchive && (
        <p className="t-label text-muted">
          Este cliente está arquivado. Só um admin da Boop pode trazê-lo de volta.
        </p>
      )}

      {/* Só o envio: o `Callout` já anuncia o resultado (role="status"). */}
      <p aria-live="polite" className="sr-only">
        {statusPending || archivePending ? 'Atualizando status.' : ''}
      </p>
    </div>
  )
}
