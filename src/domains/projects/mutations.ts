import 'server-only'

import type { ProjectStatus } from '@/config/enums'
import { JOURNEY_BY_TYPE, journeyForType } from '@/config/journeys'
import {
  advanceStageSchema,
  changeProjectStatusSchema,
  createProjectSchema,
  setStageStateSchema,
  updateProjectSchema,
} from '@/domains/projects/schemas'
import { defineWorkflow, scopeAllowed, scopeDenied } from '@/lib/workflow/define'
import { WorkflowError } from '@/lib/workflow/errors'
import type { SupabaseServerClient } from '@/lib/supabase/server'

/**
 * Workflows de projeto e jornada. São cinco, e cobrem quatro linhas da matriz:
 * `project.create`, `project.update`, `project.advance_stage` e
 * `project.change_status`.
 *
 * ## Três deles não escrevem por `supabase-js`
 *
 * `createProject`, `advanceStage` e `setStageState` chamam RPC, porque cada um
 * toca mais de uma linha e não pode ficar pela metade
 * (`20260903010440_project_journey_boundaries.sql`, revisão da ADR-0011).
 *
 * Consequência importante para quem lê: **eles não chamam `ctx.activity()`**. O
 * activity log é escrito DENTRO da função SQL, na mesma transação da mudança —
 * que é o que `docs/workflows.md` pede quando existe função SQL. Chamar aqui
 * também produziria duas linhas para um evento.
 *
 * `updateProject` e `changeProjectStatus` escrevem uma linha só, e seguem o
 * caminho normal da FASE 5: UPDATE pelo JWT + `ctx.activity()`.
 *
 * ## Nenhum usa `service_role`
 *
 * Nem os workflows, nem as funções SQL: elas são `security definer` (rodam como
 * dona para poder chamar `app.*`, que é invisível para `authenticated`), e
 * checam papel e escopo no próprio corpo, com as mesmas funções que as policies
 * usam. Ver o cabeçalho da migration.
 */

/** `23514` é violação de `check` — inclui os triggers de imutabilidade. */
const CHECK_VIOLATION = '23514'

/**
 * Lê o projeto por dentro do workflow, sem `notFound()`.
 *
 * Mesma razão de `readClientStatus` na FASE 5: os guards de `authorization.ts`
 * lançam navegação do Next, o que em Server Action viraria 404 na página
 * inteira em vez de uma mensagem no formulário. A pergunta é feita do mesmo
 * jeito — tentando ler pelo JWT, sob RLS — e a resposta vira `ScopeDecision`.
 */
async function readProject(
  db: SupabaseServerClient,
  projectId: string,
): Promise<{ id: string; clientId: string; status: ProjectStatus } | null> {
  const { data } = await db
    .from('projects')
    .select('id, client_id, status')
    .eq('id', projectId)
    .maybeSingle()

  return data ? { id: data.id, clientId: data.client_id, status: data.status } : null
}

/**
 * Cria o projeto e materializa a jornada — uma transação, no banco.
 *
 * `journey_key` e as etapas são resolvidos AQUI, a partir do `type`, e nunca
 * vêm do formulário. É o que mantém as duas colunas coerentes na única hora em
 * que elas podem ser decididas: as duas são imutáveis depois.
 */
export const createProject = defineWorkflow({
  name: 'project.create',
  input: createProjectSchema,
  capability: 'project.create',
  /*
   * Escopo conferido pela leitura do cliente sob RLS — a mesma pergunta que
   * `requireClientAccess` faz. Para `boop_admin` isso passa em qualquer
   * cliente, e é o correto: D-08 é global, e vínculo não é pré-requisito para
   * criar projeto. Quem não é admin já parou em `can()`.
   */
  authorize: async ({ input, ctx }) => {
    const { data } = await ctx.db
      .from('clients')
      .select('id')
      .eq('id', input.clientId)
      .maybeSingle()

    return data ? scopeAllowed() : scopeDenied()
  },
  handler: async ({ input, ctx }) => {
    const template = journeyForType(input.type)

    /*
     * Só `key` e `label` viajam para o banco. `summary` fica no template e é
     * lido em tempo de leitura: é texto editorial, e melhorar a redação de uma
     * frase não deveria exigir migration nem tocar linha de projeto existente.
     * `label`, ao contrário, é snapshot — muda o template, não muda o passado.
     */
    const stages = template.stages.map((stage) => ({ key: stage.key, label: stage.label }))

    const { data, error } = await ctx.db.rpc('create_project_with_journey', {
      p_client_id: input.clientId,
      p_name: input.name,
      p_type: input.type,
      p_journey_key: JOURNEY_BY_TYPE[input.type],
      p_stages: stages,
      ...(input.startsOn ? { p_starts_on: input.startsOn } : {}),
    })

    if (error) throw new WorkflowError('project.create_failed', { code: error.code ?? null })
    if (!data) throw new WorkflowError('project.create_failed')

    /* Sem `ctx.activity()`: `project.created` foi gravado na mesma transação. */
    return { projectId: data, clientId: input.clientId, stages: stages.length }
  },
})

/**
 * Edição administrativa: nome e período. Uma linha, um UPDATE.
 *
 * `type` e `journey_key` não estão no schema nem aqui — são imutáveis no banco.
 * Se um deles chegasse por outro caminho, o trigger devolveria `23514`, e é por
 * isso que o código está traduzido: o erro precisa virar frase, não stack.
 */
export const updateProject = defineWorkflow({
  name: 'project.update',
  input: updateProjectSchema,
  capability: 'project.update',
  authorize: async ({ input, ctx }) => {
    const project = await readProject(ctx.db, input.projectId)
    return project ? scopeAllowed() : scopeDenied()
  },
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.db
      .from('projects')
      .update({ name: input.name, starts_on: input.startsOn, ends_on: input.endsOn })
      .eq('id', input.projectId)
      .select('id, client_id, name')
      .maybeSingle()

    if (error) {
      if (error.code === CHECK_VIOLATION) throw new WorkflowError('project.immutable_field')
      throw new WorkflowError('project.update_failed', { code: error.code })
    }
    /* A RLS pode recusar o UPDATE devolvendo zero linhas, sem erro. */
    if (!data) throw new WorkflowError('resource.not_found')

    ctx.activity({
      action: 'project.updated',
      entityType: 'project',
      entityId: data.id,
      clientId: data.client_id,
      projectId: data.id,
      /* Identificadores e transições. Nunca o conteúdo dos campos. */
      metadata: { has_period: input.startsOn !== null },
    })

    return { projectId: data.id, clientId: data.client_id, name: data.name }
  },
})

/**
 * Pausar, ativar, concluir, arquivar.
 *
 * `draft → active` é a ativação que a criação deliberadamente não faz: o
 * projeto nasce `draft` e entra em circulação por um gesto separado, para que
 * um projeto meio configurado não apareça no portal do cliente por acidente.
 */
export const changeProjectStatus = defineWorkflow({
  name: 'project.change_status',
  input: changeProjectStatusSchema,
  capability: 'project.change_status',
  authorize: async ({ input, ctx }) => {
    const project = await readProject(ctx.db, input.projectId)
    if (!project) return scopeDenied()

    /*
     * Sair de `archived` não tem caminho nesta fase, e a recusa é explícita em
     * vez de silenciosa. Arquivar é tirar de circulação; desarquivar é uma
     * decisão de produto que a matriz não descreve para projeto (a de cliente
     * tem `client.archive` para as duas direções, e a de projeto não tem
     * equivalente). Registrado como dívida da fase.
     */
    if (project.status === 'archived') return scopeDenied('project.archived_is_final')

    return scopeAllowed()
  },
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.db
      .from('projects')
      .update({ status: input.status })
      .eq('id', input.projectId)
      .select('id, client_id, status')
      .maybeSingle()

    if (error) throw new WorkflowError('project.update_failed', { code: error.code })
    if (!data) throw new WorkflowError('resource.not_found')

    ctx.activity({
      action: 'project.status_changed',
      entityType: 'project',
      entityId: data.id,
      clientId: data.client_id,
      projectId: data.id,
      metadata: { status: data.status },
    })

    return { projectId: data.id, clientId: data.client_id, status: data.status }
  },
})

/**
 * Avança a jornada. Fecha a corrente, abre a próxima — atomicamente.
 *
 * As três respostas da função SQL viram três resultados distintos aqui, e
 * nenhuma delas é ignorada:
 *
 *   'advanced'          seguiu.
 *   'journey_complete'  a última etapa foi concluída. NÃO é erro, e a tela diz
 *                       isso — a jornada terminou, o projeto continua no status
 *                       em que estava (são eixos distintos, I-01).
 *   'no_current'        não havia etapa corrente e ainda há trabalho. Vira erro
 *                       de domínio, com frase própria: o conserto é explícito,
 *                       por `setStageState`, e não uma escolha automática.
 */
export const advanceStage = defineWorkflow({
  name: 'project.advance_stage',
  input: advanceStageSchema,
  capability: 'project.advance_stage',
  authorize: async ({ input, ctx }) => {
    const project = await readProject(ctx.db, input.projectId)
    return project ? scopeAllowed() : scopeDenied()
  },
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.db.rpc('advance_project_stage', {
      p_project_id: input.projectId,
    })

    if (error) throw new WorkflowError('project.advance_failed', { code: error.code ?? null })
    if (data === 'no_current') throw new WorkflowError('project.no_current_stage')

    /* Sem `ctx.activity()`: gravado na mesma transação, quando houve mudança. */
    return { projectId: input.projectId, outcome: data === 'advanced' ? 'advanced' : 'complete' }
  },
})

/**
 * Correção manual da jornada: pular, voltar, corrigir a etapa corrente.
 *
 * Usa `project.advance_stage` como capacidade, e não uma nova. É a mesma
 * autoridade sobre a mesma coisa — quem pode mover a jornada para a frente pode
 * corrigi-la — e um vocabulário a mais precisaria ser mantido na matriz, na
 * policy declarada nos testes e aqui, sem nenhum caso que o distinga.
 */
export const setStageState = defineWorkflow({
  name: 'project.set_stage_state',
  input: setStageStateSchema,
  capability: 'project.advance_stage',
  authorize: async ({ input, ctx }) => {
    const project = await readProject(ctx.db, input.projectId)
    return project ? scopeAllowed() : scopeDenied()
  },
  handler: async ({ input, ctx }) => {
    /*
     * O par (projeto, etapa) é conferido DENTRO da função, que recusa uma etapa
     * que não pertence ao projeto informado. Não há checagem equivalente aqui
     * de propósito: repeti-la criaria duas verdades sobre a mesma relação, e a
     * que vale é a do banco.
     */
    const { data, error } = await ctx.db.rpc('set_project_stage_state', {
      p_project_id: input.projectId,
      p_stage_id: input.stageId,
      p_state: input.state,
    })

    if (error) throw new WorkflowError('project.stage_update_failed', { code: error.code ?? null })

    return { projectId: input.projectId, outcome: data ?? 'updated' }
  },
})
