'use server'

import { revalidatePath } from 'next/cache'
import {
  disableUser,
  grantClientAccess,
  inviteUser,
  revokeClientAccess,
} from '@/domains/people/mutations'
import type { ActionState } from '@/lib/workflow/action-state'

/**
 * Server Actions de pessoas e vínculos. Adaptam `FormData` e delegam.
 *
 * `ActionState` vem de `lib/workflow`: é a forma do retorno de uma action, não
 * uma regra de cliente nem de pessoa. Duplicá-la criaria dois tipos idênticos
 * que um dia divergem — e a tela que consome os dois teria de saber qual é qual.
 */

export async function inviteUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const clientId = formData.get('clientId')
  const rawClientId = typeof clientId === 'string' && clientId.length > 0 ? clientId : undefined

  const result = await inviteUser({
    email: formData.get('email'),
    fullName: formData.get('fullName'),
    role: formData.get('role'),
    ...(rawClientId ? { clientId: rawClientId } : {}),
  })

  if (!result.ok) {
    return {
      status: 'error',
      code: result.code,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
    }
  }

  revalidatePath('/admin/usuarios')
  if (rawClientId) revalidatePath(`/admin/clientes/${rawClientId}`)

  /*
   * A mensagem distingue os três desfechos porque eles são diferentes para
   * quem administra: convite novo com e-mail a caminho, pessoa que já existia
   * e só ganhou acesso, e pessoa que já tinha tudo. Um "pronto!" genérico
   * faria alguém esperar um e-mail que não vai chegar.
   */
  const { emailSent, alreadyExisted, membershipGranted } = result.data

  const message = emailSent
    ? 'Convite enviado. A pessoa recebe o link de acesso por e-mail.'
    : alreadyExisted && membershipGranted
      ? 'Essa pessoa já tinha conta e agora acessa este cliente.'
      : 'Essa pessoa já tinha conta e já acessava este cliente.'

  return { status: 'success', message }
}

export async function grantClientAccessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await grantClientAccess({
    clientId: formData.get('clientId'),
    userId: formData.get('userId'),
  })

  if (!result.ok) return { status: 'error', code: result.code }

  /* Id validado pelo workflow, nunca o cru do formulário — ver clients/actions. */
  revalidatePath(`/admin/clientes/${result.data.clientId}`)
  revalidatePath('/admin/usuarios')

  return {
    status: 'success',
    message: result.data.created ? 'Acesso concedido.' : 'Essa pessoa já tinha acesso.',
  }
}

export async function revokeClientAccessAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await revokeClientAccess({ membershipId: formData.get('membershipId') })

  if (!result.ok) return { status: 'error', code: result.code }

  revalidatePath(`/admin/clientes/${result.data.clientId}`)
  revalidatePath('/admin/usuarios')

  return { status: 'success', message: 'Acesso removido.' }
}

export async function disableUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await disableUser({ userId: formData.get('userId') })

  if (!result.ok) return { status: 'error', code: result.code }

  revalidatePath('/admin/usuarios')

  return {
    status: 'success',
    message: result.data.alreadyDisabled
      ? 'Essa pessoa já estava desligada.'
      : 'Pessoa desligada. O acesso acaba no próximo request.',
  }
}
