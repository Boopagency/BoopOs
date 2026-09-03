import 'server-only'

import { isAnswerShapeValid } from '@/domains/onboarding/answers'
import {
  reopenOnboardingSchema,
  saveOnboardingAnswerSchema,
  startOnboardingSchema,
  submitOnboardingSchema,
} from '@/domains/onboarding/schemas'
import { defineWorkflow, scopeAllowed, scopeDenied } from '@/lib/workflow/define'
import { WorkflowError } from '@/lib/workflow/errors'
import type { SupabaseServerClient } from '@/lib/supabase/server'

/**
 * Workflows de onboarding. São quatro, e cobrem três linhas da matriz:
 * `onboarding.start`, `onboarding.answer` e `onboarding.submit`.
 *
 * ## Três deles não escrevem por `supabase-js`
 *
 * `startOnboarding`, `submitOnboarding` e `reopenOnboarding` chamam RPC, e não
 * porque cada um seja multi-linha — `start` e `reopen` tocam uma linha só. É
 * uma decisão diferente da FASE 6, e vale escrever por quê:
 * `onboarding_submissions` **não tem mais GRANT de INSERT nem de UPDATE para
 * `authenticated`** (`20260903125242_onboarding_lifecycle_boundaries.sql`).
 *
 * O ciclo de vida da submissão passou a ter uma porta só. Com duas — RPC para
 * enviar, UPDATE direto para o resto — a segunda seria a que um dia esqueceria
 * uma checagem: foi assim que um `client_user` podia fazer
 * `draft → submitted` pelo PostgREST, sem jornada e sem log.
 *
 * Consequência para quem lê: **os três não chamam `ctx.activity()`**. O log é
 * escrito dentro da função SQL, na mesma transação. Chamar aqui também
 * produziria duas linhas para um evento.
 *
 * `saveOnboardingAnswer` é o oposto, e de propósito: escreve por `upsert`
 * direto, sob RLS, e **não registra activity nenhuma**. É o autosave — dispara
 * a cada debounce, por pergunta —, e auditá-lo encheria uma tabela append-only
 * de centenas de linhas que não respondem nenhuma pergunta de auditoria
 * (docs/workflows.md marca o evento como "ruidoso demais").
 *
 * ## Nenhum usa `service_role`
 *
 * As RPCs são `security definer` porque `authenticated` não tem `usage` no
 * schema `app` e não alcançaria `app.is_boop()`. Elas checam papel e escopo no
 * próprio corpo, com as mesmas funções que as policies usam.
 */

/** `23514` é violação de `check` — inclui os triggers de integridade. */
const CHECK_VIOLATION = '23514'

/**
 * Lê o projeto por dentro do workflow, sem `notFound()`.
 *
 * Mesma razão das FASES 5 e 6: os guards de `authorization.ts` lançam navegação
 * do Next, o que em Server Action viraria 404 na página inteira em vez de uma
 * mensagem na tela. A pergunta é feita do mesmo jeito — tentando ler pelo JWT,
 * sob RLS — e a resposta vira `ScopeDecision`.
 */
async function readProject(db: SupabaseServerClient, projectId: string): Promise<boolean> {
  const { data } = await db.from('projects').select('id').eq('id', projectId).maybeSingle()
  return data !== null
}

/**
 * A Boop abre o formulário para o cliente.
 *
 * A entrada é só `projectId`: template, cliente e tipo são derivados dentro da
 * função SQL. Os três resultados que não são sucesso viram frases diferentes,
 * porque descrevem situações diferentes e o conserto de cada uma é outro:
 *
 *   `unsupported`           este tipo de projeto não tem formulário na V0.
 *   `stage_not_onboarding`  a jornada ainda não chegou lá. Conserto: avançar a
 *                           etapa — o que é uma decisão da Boop, não um efeito
 *                           colateral de clicar aqui.
 *   `already_started`       já estava aberto. **Não é erro**: é o duplo clique,
 *                           e ele devolve sucesso.
 */
export const startOnboarding = defineWorkflow({
  name: 'onboarding.start',
  input: startOnboardingSchema,
  capability: 'onboarding.start',
  authorize: async ({ input, ctx }) =>
    (await readProject(ctx.db, input.projectId)) ? scopeAllowed() : scopeDenied(),
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.db.rpc('start_onboarding', { p_project_id: input.projectId })

    if (error) throw new WorkflowError('onboarding.start_failed', { code: error.code ?? null })
    if (data === 'unsupported') throw new WorkflowError('onboarding.unsupported')
    if (data === 'stage_not_onboarding') throw new WorkflowError('onboarding.stage_not_current')

    /* Sem `ctx.activity()`: gravado na mesma transação, quando houve abertura. */
    return { projectId: input.projectId, outcome: data ?? 'started' }
  },
})

/**
 * Uma resposta. É o autosave, e roda muitas vezes por sessão.
 *
 * ## As três camadas de validação, e o que cada uma existe para pegar
 *
 * 1. **zod** afirma o que é representável em `jsonb`: texto, número, booleano
 *    ou lista de textos. Não sabe nada sobre a pergunta.
 * 2. **aqui**, contra a pergunta lida sob RLS: a forma corresponde ao TIPO, e a
 *    opção escolhida existe no template. É esta camada que devolve um código de
 *    domínio em pt-BR em vez de deixar vazar um erro do Postgres.
 * 3. **o trigger** `onboarding_answers_enforce_integrity`, que vale para todo
 *    papel e para um POST direto no PostgREST que nunca passou por aqui.
 *
 * A terceira é a autoridade. As duas primeiras existem para que a recusa seja
 * uma frase e não um `23514` — e para que a segunda camada exista mesmo quando
 * alguém, um dia, chamar este workflow de um lugar novo.
 *
 * ## Por que a pergunta é lida a partir da SUBMISSÃO
 *
 * O `questionId` vem do navegador e é endereço, nunca prova. O caminho é
 * projeto → submissão → template → seções → perguntas, e uma pergunta que não
 * apareça nesse caminho simplesmente não é encontrada — o mesmo desenho de
 * `app.has_template_access()`, que nunca vai de template para submissão.
 */
export const saveOnboardingAnswer = defineWorkflow({
  name: 'onboarding.save_answer',
  input: saveOnboardingAnswerSchema,
  capability: 'onboarding.answer',
  authorize: async ({ input, ctx }) =>
    (await readProject(ctx.db, input.projectId)) ? scopeAllowed() : scopeDenied(),
  handler: async ({ input, ctx }) => {
    const { data: submission } = await ctx.db
      .from('onboarding_submissions')
      .select('id, status, template_id')
      .eq('project_id', input.projectId)
      .maybeSingle()

    if (!submission) throw new WorkflowError('onboarding.not_started')

    /*
     * A trava de estado do cliente vive em `app.can_answer_submission` e a RLS
     * a aplicaria de qualquer jeito — mas o erro chegaria como "0 linhas
     * afetadas", indistinguível de qualquer outra recusa. Conferir aqui é o
     * que transforma isso na frase certa: "este onboarding já foi enviado".
     */
    if (submission.status === 'submitted') throw new WorkflowError('onboarding.already_submitted')

    const { data: question } = await ctx.db
      .from('onboarding_questions')
      .select('id, type, options, onboarding_sections!inner(template_id)')
      .eq('id', input.questionId)
      .eq('onboarding_sections.template_id', submission.template_id)
      .maybeSingle()

    /* Pergunta de outro template não é "proibida": para esta submissão, ela
     * não existe. Mesma resposta de sempre para as duas recusas. */
    if (!question) throw new WorkflowError('onboarding.question_not_found')

    const options = Array.isArray(question.options) ? (question.options as string[]) : []

    if (!isAnswerShapeValid(question.type, options, input.value)) {
      throw new WorkflowError('onboarding.answer_invalid')
    }

    const { error } = await ctx.db.from('onboarding_answers').upsert(
      {
        submission_id: submission.id,
        question_id: question.id,
        value: input.value,
      },
      { onConflict: 'submission_id,question_id' },
    )

    if (error) {
      if (error.code === CHECK_VIOLATION) throw new WorkflowError('onboarding.answer_invalid')
      throw new WorkflowError('onboarding.save_failed', { code: error.code })
    }

    /* Sem `ctx.activity()`. Ver o cabeçalho: autosave não é evento. */
    return { questionId: question.id, savedAt: new Date().toISOString() }
  },
})

/**
 * O envio. A fronteira transacional da fase.
 *
 * Os cinco resultados da função SQL viram cinco desfechos aqui, e nenhum é
 * ignorado:
 *
 *   `advanced`              enviou e a jornada andou.
 *   `submitted_no_advance`  enviou; a etapa corrente não era `onboarding`, e a
 *                           jornada NÃO foi tocada (D-21). É o caso do reenvio
 *                           depois de uma reabertura.
 *   `already_submitted`     duplo clique. Sucesso, não erro.
 *   `required_missing`      obrigatória vazia. Erro de domínio.
 *   `not_started`           não há formulário aberto.
 */
export const submitOnboarding = defineWorkflow({
  name: 'onboarding.submit',
  input: submitOnboardingSchema,
  capability: 'onboarding.submit',
  authorize: async ({ input, ctx }) =>
    (await readProject(ctx.db, input.projectId)) ? scopeAllowed() : scopeDenied(),
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.db.rpc('submit_onboarding', { p_project_id: input.projectId })

    if (error) throw new WorkflowError('onboarding.submit_failed', { code: error.code ?? null })
    if (data === 'not_started') throw new WorkflowError('onboarding.not_started')
    if (data === 'required_missing') throw new WorkflowError('onboarding.required_missing')

    /*
     * O e-mail `onboarding_completed` NÃO é disparado aqui, e a ausência é
     * decisão registrada (D-20): não existe `EmailService` no sistema, e
     * criar uma linha `pending` em `notifications` sem consumidor seria uma
     * fila que ninguém esvazia. O gatilho volta na FASE 16, e o lugar dele é
     * um `ctx.after()` nesta linha.
     */
    return { projectId: input.projectId, outcome: data ?? 'advanced' }
  },
})

/**
 * A reabertura. Devolve a submissão para `draft` para o cliente corrigir.
 *
 * Capacidade PRÓPRIA, `onboarding.reopen`, e não a de `start`: `start` inclui
 * `boop_member`, e `docs/workflows.md` reserva a reabertura a `boop_admin`.
 * Reusar a capacidade errada faria a recusa do member acontecer só no corpo da
 * função SQL — que a nega corretamente, mas devolveria uma falha genérica em
 * vez da frase certa. As duas camadas dizem a mesma coisa, e é isso que se
 * espera delas.
 */
export const reopenOnboarding = defineWorkflow({
  name: 'onboarding.reopen',
  input: reopenOnboardingSchema,
  capability: 'onboarding.reopen',
  authorize: async ({ input, ctx }) =>
    (await readProject(ctx.db, input.projectId)) ? scopeAllowed() : scopeDenied(),
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.db.rpc('reopen_onboarding', { p_project_id: input.projectId })

    if (error) throw new WorkflowError('onboarding.reopen_failed', { code: error.code ?? null })
    if (data === 'not_started') throw new WorkflowError('onboarding.not_started')

    return { projectId: input.projectId, outcome: data ?? 'reopened' }
  },
})
