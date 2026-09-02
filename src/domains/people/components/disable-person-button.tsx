'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { messageFor } from '@/config/messages'
import { disableUserAction } from '@/domains/people/actions'
import { IDLE } from '@/lib/workflow/action-state'

/**
 * Desligar uma pessoa.
 *
 * O aviso abaixo do botao nao e cerimonia: `disable_profile()` nao tem inverso
 * na V0 — a matriz tem `user.disable` e nao tem o oposto —, entao esta e uma
 * acao sem volta pelo painel. Dizer isso antes e mais barato do que explicar
 * depois (docs/security.md, divida registrada na FASE 5).
 */
export function DisablePersonButton({ userId, name }: { userId: string; name: string }) {
  const [state, formAction, isPending] = useActionState(disableUserAction, IDLE)

  if (state.status === 'success') {
    return <Callout tone="success">{state.message}</Callout>
  }

  return (
    <div className="space-y-2">
      {state.status === 'error' && <Callout tone="danger">{messageFor(state.code)}</Callout>}

      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <Button type="submit" variant="quiet" disabled={isPending}>
          {isPending ? 'Desligando…' : `Desligar ${name}`}
        </Button>
      </form>
    </div>
  )
}
