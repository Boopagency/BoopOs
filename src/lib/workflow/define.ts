import 'server-only'

import type { z } from 'zod'
import { getActor, type Actor } from '@/lib/auth/actor'
import { can, type Capability } from '@/lib/auth/policy'
import { logActivity, type ActivityEntry } from '@/lib/activity/log'
import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { SupabaseServerClient } from '@/lib/supabase/server'
import { WorkflowError, WORKFLOW_ERROR_CODES } from '@/lib/workflow/errors'

/**
 * `defineWorkflow` — a única forma de escrever no sistema.
 *
 * Um workflow é um caso de uso do domínio. Server Actions e Route Handlers não
 * contêm lógica: adaptam HTTP e delegam (docs/workflows.md).
 *
 * ## Por que ele nasce agora, e não antes
 *
 * A FASE 3 tinha uma única action (`requestMagicLink`) e nada a autorizar — ela
 * existe justamente para quem ainda não tem identidade. A FASE 5 traz sete
 * escritas de domínio de uma vez, todas com a mesma sequência obrigatória. Sete
 * é bem mais do que os três casos reais que a regra de abstração pede
 * (CLAUDE.md), e repetir a sequência sete vezes à mão é a forma conhecida de
 * um dos passos faltar em uma delas.
 *
 * ## Os oito passos, e o que cada um garante
 *
 * 1. **Validar** — zod `.strict()`. Server Action é endpoint público: qualquer
 *    um faz POST nela, com qualquer corpo. Campo desconhecido é rejeitado, e
 *    não ignorado, porque ignorar é o que permite um payload carregar
 *    `role: 'boop_admin'` esperando que alguém adiante o leia.
 * 2. **Autenticar** — `getActor()`. Sem sessão ou sem perfil `active`, para
 *    aqui, e o código é genérico.
 * 3. **Autorizar por papel** — `can(actor, capability)`, puro e em tabela.
 * 4. **Autorizar por escopo** — `authorize()`, opcional, que consulta o banco
 *    sob RLS. É onde `requireClientAccess` equivalente entra: papel diz "pode
 *    em princípio", escopo diz "pode neste tenant".
 * 5. **Executar** — o handler.
 * 6. **Auditar** — `ctx.activity()` enfileira; as linhas são gravadas depois do
 *    handler retornar, por `record_activity()`, sob o JWT de quem chamou.
 * 7. **Side-effects** — `ctx.after()`, depois de tudo, e **nunca** derrubando o
 *    workflow: a operação já aconteceu.
 * 8. **Falhar tipado** — `WorkflowError` vira `{ ok: false, code }`. Erro não
 *    previsto vira `workflow.unexpected` e a causa só existe no log.
 *
 * ## O que ele NÃO faz
 *
 * Não abre transação: `supabase-js` não abre. Operação multi-linha que não pode
 * ficar pela metade é função SQL chamada por `rpc` (ADR-0011), e o handler é
 * quem a chama. O workflow orquestra; a atomicidade é do banco.
 *
 * Não usa `service_role`. Todo acesso de domínio sai pelo JWT do ator, com RLS
 * valendo — a segunda camada só existe se for de fato exercitada (ADR-0022).
 */

/** Contexto entregue ao handler. Deliberadamente pequeno. */
export interface WorkflowContext {
  /** Cliente Supabase do ATOR. Sob RLS, sempre. Nunca `service_role`. */
  db: SupabaseServerClient
  /**
   * Enfileira uma linha de auditoria. Gravada depois do handler retornar,
   * por `record_activity()` — que carimba `actor_id` a partir da sessão.
   */
  activity: (entry: ActivityEntry) => void
  /**
   * Enfileira um side-effect para depois do commit. Falha aqui é registrada e
   * **não** derruba a operação, que já aconteceu (docs/workflows.md).
   */
  after: (task: () => Promise<void>) => void
}

export type WorkflowResult<T> =
  { ok: true; data: T } | { ok: false; code: string; fieldErrors?: Record<string, string[]> }

/** Resultado de um `authorize` de escopo: aprova, ou dá o código da recusa. */
export type ScopeDecision = { allowed: true } | { allowed: false; code: string }

export const scopeAllowed = (): ScopeDecision => ({ allowed: true })
export const scopeDenied = (code = 'resource.not_found'): ScopeDecision => ({
  allowed: false,
  code,
})

export interface WorkflowDefinition<TSchema extends z.ZodType, TOutput> {
  /** `dominio.verbo`. Aparece no log estruturado, nunca na tela. */
  name: string
  /** Zod `.strict()`. A restrição não é decorativa — ver passo 1. */
  input: TSchema
  /** A capacidade da matriz. `can()` decide por papel, antes de qualquer I/O. */
  capability: Capability
  /** Escopo: este ator alcança ESTE recurso? Consulta o banco sob RLS. */
  authorize?: (args: {
    actor: Actor
    input: z.output<TSchema>
    ctx: WorkflowContext
  }) => Promise<ScopeDecision>
  handler: (args: {
    actor: Actor
    input: z.output<TSchema>
    ctx: WorkflowContext
  }) => Promise<TOutput>
}

export function defineWorkflow<TSchema extends z.ZodType, TOutput>(
  definition: WorkflowDefinition<TSchema, TOutput>,
) {
  return async function run(rawInput: unknown): Promise<WorkflowResult<TOutput>> {
    /* ── 1. Validar ──────────────────────────────────────────────────────── */
    const parsed = definition.input.safeParse(rawInput)

    if (!parsed.success) {
      /*
       * Só os NOMES dos campos e os códigos saem daqui. O valor recusado não
       * volta para a tela: ele pode ser exatamente o dado que não deveria ter
       * sido enviado.
       */
      const fieldErrors: Record<string, string[]> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path.map(String).join('.') || '_'
        ;(fieldErrors[key] ??= []).push(issue.message)
      }

      logger.warn('workflow.input_invalid', {
        workflow: definition.name,
        fields: Object.keys(fieldErrors).join(','),
      })

      return { ok: false, code: WORKFLOW_ERROR_CODES.invalidInput, fieldErrors }
    }

    const input: z.output<TSchema> = parsed.data

    /* ── 2. Autenticar ───────────────────────────────────────────────────── */
    const actor = await getActor()

    if (!actor || actor.status !== 'active') {
      return { ok: false, code: WORKFLOW_ERROR_CODES.unauthenticated }
    }

    /* ── 3. Autorizar por papel ──────────────────────────────────────────── */
    const roleDecision = can(actor, definition.capability)

    if (!roleDecision.allowed) {
      logger.warn('workflow.denied', {
        workflow: definition.name,
        capability: definition.capability,
        role: actor.role,
      })
      return { ok: false, code: roleDecision.code }
    }

    /* ── Contexto ────────────────────────────────────────────────────────── */
    const db = await createSupabaseServerClient()
    const activities: ActivityEntry[] = []
    const afters: (() => Promise<void>)[] = []

    const ctx: WorkflowContext = {
      db,
      activity: (entry) => activities.push(entry),
      after: (task) => afters.push(task),
    }

    try {
      /* ── 4. Autorizar por escopo ───────────────────────────────────────── */
      if (definition.authorize) {
        const scope = await definition.authorize({ actor, input, ctx })
        if (!scope.allowed) {
          logger.warn('workflow.out_of_scope', {
            workflow: definition.name,
            role: actor.role,
          })
          return { ok: false, code: scope.code }
        }
      }

      /* ── 5. Executar ───────────────────────────────────────────────────── */
      const data = await definition.handler({ actor, input, ctx })

      /* ── 6. Auditar ────────────────────────────────────────────────────── */
      for (const entry of activities) {
        await logActivity(entry)
      }

      /* ── 7. Side-effects ───────────────────────────────────────────────── */
      for (const task of afters) {
        try {
          await task()
        } catch (cause) {
          /*
           * A operação já aconteceu. Derrubá-la agora por causa de um e-mail
           * seria desfazer o que deu certo por causa do que é acessório
           * (.claude/rules/integrations.md).
           */
          logger.error('workflow.after_failed', {
            workflow: definition.name,
            reason: cause instanceof Error ? cause.name : 'unknown',
          })
        }
      }

      return { ok: true, data }
    } catch (cause) {
      /* ── 8. Falhar tipado ──────────────────────────────────────────────── */
      if (cause instanceof WorkflowError) {
        logger.warn('workflow.failed', {
          workflow: definition.name,
          code: cause.code,
          ...cause.detail,
        })
        return { ok: false, code: cause.code }
      }

      /*
       * Falha não prevista. O que vai para a tela é um código genérico; o que
       * ajuda a depurar fica no log, sem mensagem do provedor — ela pode
       * carregar SQL ou nome de tabela (.claude/rules/security.md).
       */
      logger.error('workflow.unexpected', {
        workflow: definition.name,
        reason: cause instanceof Error ? cause.name : 'unknown',
      })

      return { ok: false, code: WORKFLOW_ERROR_CODES.unexpected }
    }
  }
}
