import 'server-only'

import {
  createClientSchema,
  setClientArchivedSchema,
  setClientStatusSchema,
  updateClientSchema,
} from '@/domains/clients/schemas'
import { defineWorkflow, scopeAllowed, scopeDenied } from '@/lib/workflow/define'
import { WorkflowError } from '@/lib/workflow/errors'
import type { SupabaseServerClient } from '@/lib/supabase/server'

/**
 * Workflows de cliente. São quatro, e cobrem as três linhas da matriz:
 * `client.create`, `client.update` e `client.archive`.
 *
 * Nenhum deles usa `service_role`. Toda escrita sai pelo JWT do ator, e a RLS
 * decide de novo — `clients_insert` exige `is_boop_admin()`, `clients_update`
 * exige `is_boop() and has_client_access(id)` com `USING` e `WITH CHECK`. Se um
 * destes workflows tivesse bug de autorização, o banco ainda recusaria
 * (ADR-0022, docs/authorization.md).
 *
 * `clients` não tem policy de DELETE, e nenhum workflow aqui apaga: a matriz
 * tem `client.archive`, que é UPDATE de `status`. Apagar arrastaria projeto,
 * conteúdo e histórico de aprovação.
 */

/** `23505` é violação de unicidade. O único índice único de `clients` é o slug. */
const UNIQUE_VIOLATION = '23505'

/**
 * Lê o cliente por dentro do workflow, sem `notFound()`.
 *
 * Os guards de `authorization.ts` lançam navegação do Next, o que é certo em
 * Server Component e errado em Server Action: 404 na página inteira em vez de
 * uma mensagem no formulário. Aqui a mesma pergunta é feita do mesmo jeito —
 * tentando ler pelo JWT — e a resposta vira `ScopeDecision`.
 */
async function readClientStatus(
  db: SupabaseServerClient,
  clientId: string,
): Promise<{ id: string; name: string; status: string } | null> {
  const { data } = await db
    .from('clients')
    .select('id, name, status')
    .eq('id', clientId)
    .maybeSingle()

  return data ?? null
}

export const createClient = defineWorkflow({
  name: 'client.create',
  input: createClientSchema,
  capability: 'client.create',
  handler: async ({ actor, input, ctx }) => {
    const { data, error } = await ctx.db
      .from('clients')
      .insert({
        name: input.name,
        slug: input.slug,
        notes: input.notes,
        /*
         * Autoria vem do ator, nunca do payload. `clients.created_by` não tem
         * default nem trigger, então é aqui que ela é carimbada — e o schema
         * `.strict()` garante que ninguém a mandou de fora.
         */
        created_by: actor.userId,
      })
      .select('id, name, slug')
      .single()

    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new WorkflowError('client.slug_taken')
      throw new WorkflowError('client.create_failed', { code: error.code })
    }

    ctx.activity({
      action: 'client.created',
      entityType: 'client',
      entityId: data.id,
      clientId: data.id,
      /* Identificadores e transições. Nunca `notes` (.claude/rules/security.md). */
      metadata: { slug: data.slug },
    })

    return { clientId: data.id, name: data.name }
  },
})

export const updateClient = defineWorkflow({
  name: 'client.update',
  input: updateClientSchema,
  capability: 'client.update',
  authorize: async ({ input, ctx }) => {
    const client = await readClientStatus(ctx.db, input.clientId)
    return client ? scopeAllowed() : scopeDenied()
  },
  handler: async ({ input, ctx }) => {
    /*
     * Só `name` e `notes`. `slug`, `status`, `created_by` e os timestamps não
     * estão no schema e não estão aqui — a whitelist existe nos dois lugares
     * de propósito, porque o schema protege a entrada e este objeto protege a
     * escrita.
     */
    const { data, error } = await ctx.db
      .from('clients')
      .update({ name: input.name, notes: input.notes })
      .eq('id', input.clientId)
      .select('id, name')
      .maybeSingle()

    if (error) throw new WorkflowError('client.update_failed', { code: error.code })
    /* A RLS pode recusar o UPDATE devolvendo zero linhas, sem erro. */
    if (!data) throw new WorkflowError('resource.not_found')

    ctx.activity({
      action: 'client.updated',
      entityType: 'client',
      entityId: data.id,
      clientId: data.id,
      /* Se a nota mudou, não O QUE ela passou a dizer. */
      metadata: { has_notes: input.notes !== null },
    })

    return { clientId: data.id, name: data.name }
  },
})

export const setClientStatus = defineWorkflow({
  name: 'client.set_status',
  input: setClientStatusSchema,
  capability: 'client.update',
  authorize: async ({ input, ctx }) => {
    const client = await readClientStatus(ctx.db, input.clientId)
    if (!client) return scopeDenied()

    /*
     * Sair de `archived` é gesto de administrador, e `client.update` é da Boop
     * inteira. Sem esta linha, um `boop_member` desarquivaria o que só o
     * administrador pôde arquivar — a assimetria que a matriz descreve.
     */
    if (client.status === 'archived') return scopeDenied('client.archived_needs_admin')

    return scopeAllowed()
  },
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.db
      .from('clients')
      .update({ status: input.status })
      .eq('id', input.clientId)
      .select('id, name, status')
      .maybeSingle()

    if (error) throw new WorkflowError('client.update_failed', { code: error.code })
    if (!data) throw new WorkflowError('resource.not_found')

    ctx.activity({
      action: 'client.updated',
      entityType: 'client',
      entityId: data.id,
      clientId: data.id,
      metadata: { status: data.status },
    })

    return { clientId: data.id, status: data.status }
  },
})

/**
 * Arquivar e desarquivar, os dois com `client.archive` — só `boop_admin`.
 *
 * Um workflow para as duas direções porque é a mesma decisão: quem pode tirar
 * um cliente de circulação é quem pode trazê-lo de volta. Separar em dois
 * criaria a chance de o inverso ficar sem dono, que é como um estado vira
 * beco sem saída.
 */
export const setClientArchived = defineWorkflow({
  name: 'client.set_archived',
  input: setClientArchivedSchema,
  capability: 'client.archive',
  authorize: async ({ input, ctx }) => {
    const client = await readClientStatus(ctx.db, input.clientId)
    return client ? scopeAllowed() : scopeDenied()
  },
  handler: async ({ input, ctx }) => {
    const next = input.archived ? 'archived' : 'active'

    const { data, error } = await ctx.db
      .from('clients')
      .update({ status: next })
      .eq('id', input.clientId)
      .select('id, name, status')
      .maybeSingle()

    if (error) throw new WorkflowError('client.update_failed', { code: error.code })
    if (!data) throw new WorkflowError('resource.not_found')

    ctx.activity({
      action: input.archived ? 'client.archived' : 'client.updated',
      entityType: 'client',
      entityId: data.id,
      clientId: data.id,
      metadata: { status: data.status },
    })

    return { clientId: data.id, status: data.status }
  },
})
