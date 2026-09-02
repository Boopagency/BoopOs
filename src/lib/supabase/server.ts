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
 * FASE 3: servia so a autenticacao (`signInWithOtp`, `exchangeCodeForSession`,
 * `getUser`, `signOut`), porque a RLS estava ligada e sem politicas —
 * consulta de dominio voltava vazia por desenho.
 *
 * FASE 4 escreveu as politicas. FASE 5 e a primeira que de fato le e escreve
 * dominio por aqui: `src/domains/*` usa exclusivamente este cliente, e e o que
 * faz a segunda camada de autorizacao existir na pratica. `service_role`
 * continua fora — ela nao consulta dominio (ADR-0022).
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

/**
 * O tipo do cliente acima, para quem precisa recebe-lo como parametro.
 *
 * Inferido da funcao de proposito: escrever `SupabaseClient<Database>` a mao
 * seria uma segunda declaracao do mesmo tipo, livre para divergir no dia em
 * que a fabrica mudar.
 */
export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>
