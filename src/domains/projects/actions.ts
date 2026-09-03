'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  advanceStage,
  changeProjectStatus,
  createProject,
  setStageState,
  updateProject,
} from '@/domains/projects/mutations'
import type { ActionState } from '@/lib/workflow/action-state'

/**
 * Server Actions de projeto. Adaptam `FormData` e delegam — não decidem nada.
 *
 * Mesma forma da FASE 5. A revalidação é por caminho, nunca global: uma
 * mudança de etapa invalida o projeto no admin e o portal daquele projeto, e
 * não o cache da aplicação inteira.
 *
 * `/portal` (o resolvedor) entra na revalidação de status porque ativar ou
 * arquivar um projeto muda o que ele resolve — de "nenhum projeto" para
 * "redireciona", ou de "redireciona" para "escolha".
 */

export async function createProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await createProject({
    clientId: formData.get('clientId'),
    name: formData.get('name'),
    type: formData.get('type'),
    startsOn: formData.get('startsOn'),
  })

  if (!result.ok) {
    return {
      status: 'error',
      code: result.code,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
    }
  }

  revalidatePath(`/admin/clientes/${result.data.clientId}`)

  /* `redirect` lança: vem depois de tudo, e por isso não há `return` de sucesso. */
  redirect(`/admin/projetos/${result.data.projectId}`)
}

export async function updateProjectAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await updateProject({
    projectId: formData.get('projectId'),
    name: formData.get('name'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn'),
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
   * pelo formulário: o primeiro passou por `z.uuid()` e pela RLS.
   */
  revalidatePath(`/admin/projetos/${result.data.projectId}`)
  revalidatePath(`/admin/clientes/${result.data.clientId}`)

  return { status: 'success', message: 'Alterações salvas.' }
}

export async function changeProjectStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await changeProjectStatus({
    projectId: formData.get('projectId'),
    status: formData.get('status'),
  })

  if (!result.ok) return { status: 'error', code: result.code }

  revalidatePath(`/admin/projetos/${result.data.projectId}`)
  revalidatePath(`/admin/clientes/${result.data.clientId}`)
  revalidatePath('/portal')
  revalidatePath(`/portal/${result.data.projectId}`)

  return { status: 'success', message: 'Status atualizado.' }
}

export async function advanceStageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await advanceStage({ projectId: formData.get('projectId') })

  if (!result.ok) return { status: 'error', code: result.code }

  revalidatePath(`/admin/projetos/${result.data.projectId}`)
  /* O cliente precisa ver a mudança: é o critério de pronto da fase. */
  revalidatePath(`/portal/${result.data.projectId}`)
  revalidatePath(`/portal/${result.data.projectId}/projeto`)

  return {
    status: 'success',
    message:
      result.data.outcome === 'complete'
        ? 'Última etapa concluída. A jornada deste ciclo terminou.'
        : 'Etapa avançada.',
  }
}

export async function setStageStateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await setStageState({
    projectId: formData.get('projectId'),
    stageId: formData.get('stageId'),
    state: formData.get('state'),
  })

  if (!result.ok) return { status: 'error', code: result.code }

  revalidatePath(`/admin/projetos/${result.data.projectId}`)
  revalidatePath(`/portal/${result.data.projectId}`)
  revalidatePath(`/portal/${result.data.projectId}/projeto`)

  return { status: 'success', message: 'Jornada corrigida.' }
}
