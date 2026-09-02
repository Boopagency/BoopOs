import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireSupabaseEnv } from '@/config/env'
import type { Database } from '@/lib/supabase/database.types'

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Fala com o Supabase usando o JWT do usuario, entao a RLS continua valendo —
 * essa e a segunda camada de autorizacao (docs/security.md).
 *
 * FASE 3: serve a autenticacao (`signInWithOtp`, `exchangeCodeForSession`,
 * `getUser`, `signOut`), que fala com o GoTrue e nao depende de privilegio no
 * schema `public`. **Consulta de dominio por este cliente ainda devolve vazio**:
 * a RLS esta ligada e sem politicas, e `authenticated` nao tem privilegio
 * nenhum em `public` (migration 20260901140008). Isso muda na FASE 4, e e de
 * proposito: ate la nao existe caminho de leitura que dependa de policy que
 * ninguem escreveu.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = requireSupabaseEnv()
  const cookieStore = await cookies()

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          /*
           * Server Component nao escreve cookie: o Next so aceita `set` em
           * Server Action ou Route Handler, porque depois do inicio do
           * streaming nao ha mais como emitir `Set-Cookie`.
           *
           * Engolir aqui e correto — e nao um atalho — porque quem renova a
           * sessao e o `proxy.ts`, que roda antes de qualquer render e tem a
           * resposta na mao. Sem esse par (catch aqui, refresh la), o
           * @supabase/ssr avisa que perdeu a escrita e a sessao morre cedo.
           */
        }
      },
    },
  })
}
