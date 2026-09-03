import { z } from 'zod'

/**
 * Entrada dos workflows de onboarding. Zod `.strict()`, sempre.
 *
 * ## O que NÃO aparece em nenhum destes schemas
 *
 *   `templateId`    é a decisão mais importante da fase do lado da entrada.
 *                   Aceitá-lo seria deixar quem posta escolher QUAL formulário
 *                   o cliente responde. `start_onboarding()` o deriva do
 *                   projeto → tipo → template ativo, no banco.
 *   `submissionId`  derivado do projeto: `onboarding_submissions.project_id` é
 *                   unique, então o projeto já identifica a submissão. Um id a
 *                   menos vindo do navegador é um id a menos para conferir.
 *   `clientId`      derivado por trigger a partir do projeto, e imutável.
 *   `status`        transição, não campo. Quem a faz são as três RPCs.
 *   `submittedBy`   vem de `auth.uid()`, dentro da função SQL.
 *
 * O `projectId` que sobra é ENDEREÇO, nunca autorização: quem responde escopo é
 * `app.has_project_access()`, no corpo de cada fronteira.
 */

const projectId = z.uuid({ error: 'project_id_invalid' })
const questionId = z.uuid({ error: 'question_id_invalid' })

/**
 * O valor de uma resposta.
 *
 * Aqui o zod só afirma o que é possível representar em `jsonb`: texto, número,
 * booleano ou lista de textos. Ele **não** consegue afirmar o que importa —
 * "esta forma corresponde ao TIPO desta pergunta?" e "esta opção existe no
 * template?" —, porque as duas dependem de uma linha do banco que o schema não
 * viu.
 *
 * Essa segunda metade acontece no workflow, contra a pergunta lida sob RLS, e
 * de novo no trigger `onboarding_answers_enforce_integrity`. O schema é o
 * primeiro filtro, não o único.
 *
 * `.nullable()` fica de fora de propósito: apagar uma resposta é gravar `""`
 * ou `[]`, que são valores. `null` em `value` é proibido pelo `not null` da
 * coluna, e oferecer o campo produziria um formulário que salva e o banco
 * rejeita.
 */
const answerValue = z.union([
  z.string().max(10_000, { error: 'answer_too_long' }),
  z.number().finite({ error: 'answer_value_invalid' }),
  z.boolean(),
  z.array(z.string().max(500, { error: 'answer_too_long' })).max(50, { error: 'answer_too_long' }),
])

export const startOnboardingSchema = z.object({ projectId }).strict()

export const saveOnboardingAnswerSchema = z
  .object({ projectId, questionId, value: answerValue })
  .strict()

export const submitOnboardingSchema = z.object({ projectId }).strict()

export const reopenOnboardingSchema = z.object({ projectId }).strict()

export type SaveOnboardingAnswerInput = z.infer<typeof saveOnboardingAnswerSchema>
