'use server'

import { revalidatePath } from 'next/cache'
import {
  reopenOnboarding,
  saveOnboardingAnswer,
  startOnboarding,
  submitOnboarding,
} from '@/domains/onboarding/mutations'
import type { ActionState } from '@/lib/workflow/action-state'

/**
 * Server Actions de onboarding. Adaptam a entrada e delegam — não decidem nada.
 *
 * ## O autosave é a única que não recebe `FormData`
 *
 * `saveOnboardingAnswerAction` é chamada por JavaScript, a cada debounce, com
 * um valor que pode ser texto, número, booleano ou lista. `FormData` só
 * carrega string: `false` viraria `"false"` e `0` viraria `"0"`, e os dois são
 * exatamente os valores que a validação por tipo existe para preservar.
 *
 * Uma Server Action com argumento serializável continua sendo um endpoint
 * público, e continua passando pelo mesmo `defineWorkflow` — o zod `.strict()`
 * está lá, e quem posta `{"value": {"role": "boop_admin"}}` é recusado no
 * primeiro passo.
 *
 * ## O autosave não revalida
 *
 * `revalidatePath` a cada tecla mandaria o servidor re-renderizar a página
 * inteira dezenas de vezes por seção, e a tela já tem a resposta: foi ela que a
 * digitou. Quem revalida é o ENVIO, que muda status e jornada — e a
 * reabertura, que desfaz as duas.
 */

export async function saveOnboardingAnswerAction(input: {
  projectId: string
  questionId: string
  value: string | number | boolean | string[]
}): Promise<ActionState> {
  const result = await saveOnboardingAnswer(input)

  if (!result.ok) {
    return {
      status: 'error',
      code: result.code,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
    }
  }

  return { status: 'success' }
}

export async function submitOnboardingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await submitOnboarding({ projectId: formData.get('projectId') })

  if (!result.ok) {
    return {
      status: 'error',
      code: result.code,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
    }
  }

  /*
   * O envio muda o status da submissão E a etapa corrente. As duas telas que
   * mostram isso precisam ser reconstruídas: a do cliente (formulário → "recebemos
   * tudo", jornada nova) e a da Boop (respostas para ler).
   */
  revalidatePath(`/portal/${result.data.projectId}`, 'layout')
  revalidatePath(`/admin/projetos/${result.data.projectId}`)

  return { status: 'success', message: 'Recebemos suas respostas.' }
}

export async function startOnboardingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await startOnboarding({ projectId: formData.get('projectId') })

  if (!result.ok) {
    return {
      status: 'error',
      code: result.code,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
    }
  }

  revalidatePath(`/admin/projetos/${result.data.projectId}`)
  revalidatePath(`/portal/${result.data.projectId}`, 'layout')

  return {
    status: 'success',
    message:
      result.data.outcome === 'already_started'
        ? 'O onboarding já estava aberto.'
        : 'Onboarding aberto. A cliente já pode responder.',
  }
}

export async function reopenOnboardingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const result = await reopenOnboarding({ projectId: formData.get('projectId') })

  if (!result.ok) {
    return {
      status: 'error',
      code: result.code,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
    }
  }

  revalidatePath(`/admin/projetos/${result.data.projectId}`)
  revalidatePath(`/portal/${result.data.projectId}`, 'layout')

  return {
    status: 'success',
    message:
      result.data.outcome === 'already_draft'
        ? 'Este onboarding já estava aberto para edição.'
        : 'Onboarding reaberto. A cliente pode corrigir e enviar de novo.',
  }
}
