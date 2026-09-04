import { portalHref } from '@/config/app'
import { PRIORITY } from '@/config/attention'
import { journeyForType } from '@/config/journeys'
import { getOnboardingStateForClient } from '@/domains/onboarding/queries'
import type { AttentionItem, AttentionSource } from '../types'

/**
 * A primeira attention source real do produto.
 *
 * O onboarding existe e funciona desde a FASE 7 — o cliente responde, o
 * formulário salva sozinho, o envio fecha a etapa. O que faltava era o
 * caminho: `/portal/[projectId]/onboarding` não está na navegação, nenhuma
 * tela linkava para lá, e uma cliente com submissão em rascunho abria o portal
 * sem ter como continuar. A pendência existia e não encontrava ninguém.
 *
 * ## Só `draft` é a vez do cliente
 *
 *   `draft`        a Boop abriu, o cliente ainda não enviou  →  ATENÇÃO
 *   `not_started`  a Boop ainda não abriu                    →  nada
 *   `submitted`    acabou                                     →  nada
 *   `unsupported`  este projeto não tem formulário            →  nada
 *
 * `not_started` é o caso que mais tenta virar atenção, e não pode: só a Boop
 * inicia a submissão. Cobrar do cliente uma ação que ele não consegue executar
 * é ruído com cara de cuidado — sem acionabilidade, sem atenção.
 */
export const onboardingSource: AttentionSource = {
  key: 'onboarding',

  /**
   * A source se aplica quando a jornada DESTE TIPO de projeto tem etapa de
   * onboarding.
   *
   * Derivado do template, e não escrito como `type === 'social'`: hoje as duas
   * expressões dão o mesmo resultado, mas a segunda envelhece no dia em que uma
   * jornada nova ganhar a etapa — e envelheceria em silêncio, deixando de
   * cobrar um onboarding que existe.
   *
   * Um projeto sem essa etapa não é "sem pendência": é um projeto ao qual a
   * pergunta não se aplica. A diferença aparece em `evaluated`, e importa no
   * dia em que uma source falha.
   */
  appliesTo: ({ project }) =>
    journeyForType(project.type).stages.some((stage) => stage.key === 'onboarding'),

  async run({ project }): Promise<readonly AttentionItem[]> {
    const { state } = await getOnboardingStateForClient(project.id)

    if (state !== 'draft') return []

    return [
      {
        /* Estável: uma submissão por projeto, então o projeto identifica. */
        id: `onboarding.continue:${project.id}`,
        kind: 'onboarding.continue',
        priority: PRIORITY['onboarding.continue'],
        /* Uma PENDÊNCIA, não o número de perguntas que faltam. */
        count: 1,
        title: 'Seu onboarding está esperando você.',
        description: 'Você pode responder aos poucos — o que já escreveu está salvo.',
        cta: {
          label: 'Continuar',
          /*
           * `portalHref` com o id da linha que a RLS devolveu. Nunca literal,
           * nunca concatenado, nunca um id vindo do input: foi exatamente uma
           * rota escrita à mão que fez o CTA da Home apontar para um projeto
           * inexistente durante uma fase inteira.
           */
          href: portalHref(project.id, 'onboarding'),
        },
        projectId: project.id,
        entityId: null,
        dueAt: null,
      },
    ]
  },
}
