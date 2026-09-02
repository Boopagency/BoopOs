'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  createClient,
  setClientArchived,
  setClientStatus,
  updateClient,
} from '@/domains/clients/mutations'
import type { ActionState } from '@/lib/workflow/action-state'

/**
 * Server Actions de cliente. Adaptam `FormData` e delegam — não decidem nada.
 *
 * Toda a lógica está no workflow: validar, autenticar, autorizar, executar,
 * auditar. Aqui só acontece o que é da camada HTTP — ler o formulário,
 * revalidar cache e redirecionar (docs/workflows.md).
 *
 * ## Sobre `revalidatePath`
 *
 * Revalidação por caminho, nunca global. `revalidatePath('/', 'layout')`
 * limparia o cache da aplicação inteira a cada edição de nome de cliente — que
 * é o tipo de "funciona" que fica caro depois e ninguém liga à causa.
 */

export async function createClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await createClient({
    name: formData.get('name'),
    slug: formData.get('slug'),
    notes: formData.get('notes'),
  })

  if (!result.ok) {
    return {
      status: 'error',
      code: result.code,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
    }
  }

  revalidatePath('/admin/clientes')

  /*
   * `redirect` lança — por isso vem depois de tudo, e por isso esta action não
   * tem `return` de sucesso. Quem acabou de criar um cliente quer vê-lo, não
   * ver o formulário vazio com um "pronto!" em cima.
   */
  redirect(`/admin/clientes/${result.data.clientId}`)
}

export async function updateClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await updateClient({
    clientId: formData.get('clientId'),
    name: formData.get('name'),
    notes: formData.get('notes'),
  })

  if (!result.ok) {
    return {
      status: 'error',
      code: result.code,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
    }
  }

  /*
   * O caminho é montado com o id que VOLTOU do workflow, não com o que entrou
   * pelo formulário: o primeiro passou por `z.uuid()` e pela RLS, o segundo é
   * `FormDataEntryValue` e pode ser qualquer coisa — inclusive um arquivo.
   */
  revalidatePath('/admin/clientes')
  revalidatePath(`/admin/clientes/${result.data.clientId}`)

  return { status: 'success', message: 'Alterações salvas.' }
}

export async function setClientStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await setClientStatus({
    clientId: formData.get('clientId'),
    status: formData.get('status'),
  })

  if (!result.ok) return { status: 'error', code: result.code }

  revalidatePath('/admin/clientes')
  revalidatePath(`/admin/clientes/${result.data.clientId}`)

  return { status: 'success', message: 'Status atualizado.' }
}

export async function setClientArchivedAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await setClientArchived({
    clientId: formData.get('clientId'),
    /* `FormData` só carrega string: o booleano nasce aqui, não no schema. */
    archived: formData.get('archived') === 'true',
  })

  if (!result.ok) return { status: 'error', code: result.code }

  revalidatePath('/admin/clientes')
  revalidatePath(`/admin/clientes/${result.data.clientId}`)

  return { status: 'success', message: 'Status atualizado.' }
}
