import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import type { ProfileStatus, UserRole } from '@/config/enums'
import { integrationStatus } from '@/config/env'
import { LOGIN_PATH } from '@/lib/auth/routes'
import { logger } from '@/lib/logging/logger'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Quem esta fazendo o request.
 *
 * Carregado uma vez por request (`cache` do React) e passado adiante. **Nunca**
 * reconstruido a partir de dado enviado pelo cliente: o unico ponto de partida
 * e a sessao validada pelo Supabase Auth (docs/security.md).
 *
 * Falta aqui o `clientIds` que docs/security.md desenha. Nao e esquecimento:
 * vinculo e **escopo**, e escopo e autorizacao — FASE 4. Nesta fase o Actor
 * responde "quem e voce", nunca "o que voce pode ver". Quando as politicas
 * existirem, o vinculo vem das funcoes `app.*` sob RLS, e nao de uma consulta
 * com service role (ADR-0021).
 */
export type Actor = {
  userId: string
  email: string
  fullName: string | null
  role: UserRole
  status: ProfileStatus
}

/**
 * Sessao validada + perfil interno.
 *
 * `getUser()` — e nao `getSession()` — porque `getSession` apenas decodifica o
 * cookie, e o cookie e enviado pelo navegador. Aqui o resultado decide acesso,
 * entao o token e conferido com o servidor de Auth.
 *
 * A leitura de `profiles` usa a service role, o que ignora a RLS. E deliberado
 * e temporario (ADR-0021): ate a FASE 4 a RLS esta ligada e sem politicas, e
 * `authenticated` nao tem privilegio em `public`, entao esta leitura pelo JWT
 * do usuario devolveria vazio para todo mundo. As tres regras que mantem isso
 * seguro estao logo abaixo, no codigo: a identidade vem da sessao, a projecao
 * e minima e o filtro e sempre o proprio `id`.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  /*
   * Ler o cookie ANTES de qualquer atalho, e nao depois.
   *
   * `cookies()` e o que tira a rota da renderizacao estatica. Com o atalho de
   * "Supabase nao configurado" na frente, o build prerenderizava a pagina com
   * a resposta "ninguem logado" — e uma rota protegida virava um redirect
   * fixo para /login, servido a todo mundo, inclusive a quem tem sessao. O
   * sintoma seria "ninguem consegue entrar em producao", e a causa estaria em
   * um `if` de configuracao.
   *
   * Assim, toda rota que pergunta quem e o usuario fica dinamica por
   * consequencia, sem depender de alguem lembrar de marcar a rota.
   */
  await cookies()

  if (!integrationStatus().supabase) return null

  const supabase = await createSupabaseServerClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()

  if (authError || !auth.user) return null

  const admin = createSupabaseAdminClient()
  const { data: profile, error } = await admin
    .from('profiles')
    /* Projecao explicita: nunca `select *` (.claude/rules/database.md). */
    .select('id, email, full_name, role, status')
    /* O id vem da sessao verificada acima — nunca de rota, corpo ou header. */
    .eq('id', auth.user.id)
    .maybeSingle()

  if (error) {
    logger.error('actor.profile_read_failed', { code: error.code })
    return null
  }

  if (!profile) {
    /*
     * Sessao valida sem espelho em `profiles`. So acontece se o trigger de
     * `auth.users` falhou ou se a linha foi removida a mao: sem perfil nao ha
     * papel, e sem papel nao ha acesso.
     */
    logger.warn('actor.profile_missing', { userId: auth.user.id })
    return null
  }

  return {
    userId: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
    status: profile.status,
  }
})

/**
 * Guard de qualquer rota autenticada. Sessao valida **e** perfil ativo.
 *
 * `disabled` cai aqui, e nao no proxy: e isso que faz a revogacao valer no
 * request seguinte sem esperar o JWT (que vive ~1 h) expirar. O cookie
 * continua tecnicamente valido; o acesso, nao.
 */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor()

  if (!actor) redirect(LOGIN_PATH)
  if (actor.status === 'disabled') redirect(`${LOGIN_PATH}?erro=access_revoked`)
  if (actor.status !== 'active') redirect(`${LOGIN_PATH}?erro=activation_pending`)

  return actor
}
