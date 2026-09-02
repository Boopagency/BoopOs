import 'server-only'

import { notFound } from 'next/navigation'
import { cache } from 'react'
import { requireActor, type Actor } from '@/lib/auth/actor'
import { can, type Capability } from '@/lib/auth/policy'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Guards de escopo — a fronteira de autorizacao do lado do servidor.
 *
 * `can()` responde por papel e e pura. Estes guards respondem por ESCOPO, e
 * para isso precisam do banco: o vinculo vive em `client_memberships` e pode
 * ter sido revogado ha um segundo.
 *
 * ## Como eles perguntam
 *
 * Nao existe aqui um `select` em `client_memberships` para depois comparar em
 * TypeScript. A pergunta e feita da unica forma que nao pode divergir da
 * verdade: **tentando ler o recurso pelo JWT do usuario**. Se a RLS devolver a
 * linha, o acesso existe; se devolver vazio, nao existe. A mesma policy que
 * protege a tabela e a que responde ao guard, entao as duas nunca discordam.
 *
 * ## Por que 404 e nao 403
 *
 * 403 confirma que o recurso existe. Para quem esta trocando uuid na URL, essa
 * confirmacao ja e informacao — da para enumerar clientes pela diferenca entre
 * "403" e "404". Aqui os dois casos — recurso inexistente e recurso de outro
 * tenant — produzem exatamente a mesma resposta (.claude/rules/security.md).
 *
 * ## O que estes guards NAO fazem
 *
 * Nao carregam `clientIds` para o Actor. Escopo nao vira estado de request:
 * cada leitura passa pela RLS de novo, e revogar vinculo vale no request
 * seguinte sem depender de ninguem invalidar cache.
 */

/**
 * Sessao valida, perfil ativo e papel da Boop (`boop_admin` ou `boop_member`).
 *
 * `client_user` cai em 404 — nao em 403 —, entao a existencia da area interna
 * nao e confirmada para quem nao deveria saber dela.
 */
export async function requireBoop(): Promise<Actor> {
  const actor = await requireActor()
  if (actor.role === 'client_user') notFound()
  return actor
}

/** Sessao valida, perfil ativo e papel `boop_admin`. */
export async function requireBoopAdmin(): Promise<Actor> {
  const actor = await requireActor()
  if (actor.role !== 'boop_admin') notFound()
  return actor
}

/**
 * Este ator alcanca este cliente?
 *
 * `cache` do React: varias partes de uma mesma pagina podem pedir o guard sem
 * multiplicar consultas. O cache vale por request, entao nao carrega decisao
 * de um request para o seguinte.
 */
export const requireClientAccess = cache(async (clientId: string): Promise<Actor> => {
  const actor = await requireActor()
  const supabase = await createSupabaseServerClient()

  /*
   * Projecao minima: so precisamos saber se a linha volta. Trazer colunas
   * abriria a porta para alguem "aproveitar" o guard como leitura de dominio —
   * e `clients` carrega `notes`, que o cliente nao pode ver.
   */
  const { data, error } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .maybeSingle()

  if (error || !data) notFound()

  return actor
})

/**
 * Este ator alcanca este projeto?
 *
 * O `projectId` vem da URL — `/portal/[projectId]` — e por isso e endereco, e
 * nunca prova. Quem decide e o vinculo com o cliente do projeto, resolvido
 * pela RLS via `app.has_project_access()`.
 */
export const requireProjectAccess = cache(async (projectId: string): Promise<Actor> => {
  const actor = await requireActor()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle()

  if (error || !data) notFound()

  return actor
})

/**
 * O papel deste ator permite esta capacidade? Se nao, 404.
 *
 * Atalho para Server Components. Em workflow (`defineWorkflow`, FASE 6) a
 * mesma decisao volta como `Result`, e nao como redirect — la o erro precisa
 * virar mensagem em pt-BR na tela, nao pagina inexistente.
 */
export async function requireCapability(capability: Capability): Promise<Actor> {
  const actor = await requireActor()
  if (!can(actor, capability).allowed) notFound()
  return actor
}
