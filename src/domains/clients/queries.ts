import 'server-only'

import { cache } from 'react'
import { requireBoop, requireClientAccess } from '@/lib/auth/authorization'
import { can } from '@/lib/auth/policy'
import { logger } from '@/lib/logging/logger'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  CLIENT_DETAIL_COLUMNS,
  CLIENT_LIST_COLUMNS,
  CLIENT_PUBLIC_COLUMNS,
  type ClientDetail,
  type ClientListItem,
  type ClientPublic,
} from '@/domains/clients/types'
import { notFound } from 'next/navigation'

/**
 * Leituras de `clients`. Sob RLS, sempre, e com projeção explícita.
 *
 * ## Cada função carrega a própria autorização
 *
 * Um loader que confia no guard da página é seguro exatamente até alguém
 * reusá-lo em outra página. Aqui cada função chama o guard de que precisa, o
 * que a torna segura onde quer que seja chamada — inclusive de um lugar que
 * ainda não existe. Guard repetido custa uma consulta em cache de request;
 * guard esquecido custa um tenant.
 *
 * ## `select` explícito, nunca `*`
 *
 * As listas de colunas vivem em `./types.ts`, ao lado dos tipos que elas
 * preenchem, e são a primeira camada da proteção de `clients.notes`: a coluna
 * interna não sai do banco nas leituras que não têm direito a ela, então não há
 * o que remover depois nem o que vazar em payload de RSC
 * (`src/lib/data/projection.ts`).
 */

/**
 * Os clientes que este ator alcança.
 *
 * Não há filtro por vínculo no TypeScript, e isso é o desenho: `boop_admin`
 * enxerga todos e `boop_member` enxerga os seus porque `clients_select` usa
 * `app.has_client_access(id)`. Escrever o mesmo filtro aqui criaria uma
 * segunda verdade sobre escopo, competindo com a RLS (ADR-0022).
 *
 * O `memberCount` fica em `people/queries.ts` e é resolvido pela página: são
 * duas consultas, não uma por linha. Com dezenas de clientes na V0, duas
 * consultas corretas valem mais do que uma consulta esperta.
 */
export const listClientsForBoop = cache(
  async (): Promise<Omit<ClientListItem, 'memberCount'>[]> => {
    await requireBoop()
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase
      .from('clients')
      .select(CLIENT_LIST_COLUMNS)
      .order('name', { ascending: true })

    if (error) {
      logger.error('clients.list_failed', { code: error.code })
      throw new Error('clients.list_failed')
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      updatedAt: row.updated_at,
    }))
  },
)

/**
 * O cliente inteiro, para a tela interna — `notes` incluída.
 *
 * Três camadas antes de a coluna sair do banco:
 *
 *   `requireBoop()`                    papel da Boop, senão 404;
 *   `requireClientAccess()`            vínculo, perguntado à RLS, senão 404;
 *   `can('client.read_internal_notes')` a linha da matriz, explicitamente.
 *
 * A terceira é redundante hoje — quem passou pelas duas primeiras já a tem —,
 * e existe assim mesmo: no dia em que a matriz mudar, é aqui que a mudança
 * pega, e não em uma dedução que ninguém escreveu.
 */
export const getClientDetailForBoop = cache(async (clientId: string): Promise<ClientDetail> => {
  const actor = await requireBoop()
  await requireClientAccess(clientId)

  if (!can(actor, 'client.read_internal_notes').allowed) notFound()

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_DETAIL_COLUMNS)
    .eq('id', clientId)
    .maybeSingle()

  /* Inexistente e inalcançável dão a MESMA resposta (docs/security.md). */
  if (error || !data) notFound()

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    status: data.status,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  }
})

/**
 * O cliente como o próprio cliente pode vê-lo.
 *
 * Serve as três personas — o portal da FASE 6 em diante consome esta, e não a
 * de cima. `notes` não está na projeção, então não sai do banco: não há
 * `delete client.notes` em lugar nenhum do código, porque não há o que apagar.
 */
export const getClientPublic = cache(async (clientId: string): Promise<ClientPublic> => {
  await requireClientAccess(clientId)

  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_PUBLIC_COLUMNS)
    .eq('id', clientId)
    .maybeSingle()

  if (error || !data) notFound()

  return { id: data.id, name: data.name, slug: data.slug, status: data.status }
})
