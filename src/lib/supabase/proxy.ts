import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { requireSupabaseEnv } from '@/config/env'

/**
 * Renovacao de sessao para o `proxy.ts` da raiz. Ver ADR-0020.
 *
 * Nao importa `server-only`: o proxy do Next 16 e um bundle separado do
 * servidor de render, e a marcacao nao acrescenta protecao ali. O que protege
 * este arquivo e ele so ser importado por `src/proxy.ts`.
 *
 * O que este modulo faz: le os cookies do request, deixa o @supabase/ssr
 * decidir se o token precisa ser renovado e devolve a resposta ja com os
 * cookies novos. O que ele NAO faz: consultar `profiles`, resolver vinculo,
 * ler dado de dominio ou tocar na service role. Autorizacao e do servidor de
 * render (`requireActor`) e da RLS.
 */
export async function updateSession(request: NextRequest): Promise<{
  response: NextResponse
  userId: string | null
}> {
  const { url, anonKey } = requireSupabaseEnv()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        /*
         * O request tambem recebe os cookies novos: o render que vem depois
         * le deste objeto, e nao do `Set-Cookie` que ainda nao voltou ao
         * navegador. Sem isso o primeiro request depois de uma renovacao
         * renderiza deslogado.
         */
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }

        response = NextResponse.next({ request })

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }

        /*
         * `Cache-Control: private, no-store` e companhia vem da propria
         * biblioteca. Uma resposta que carrega cookie de sessao nunca pode
         * ser cacheada por CDN: o token de uma pessoa seria servido a outra.
         */
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value)
        }
      },
    },
  })

  /*
   * `getUser` valida o token com o servidor de Auth, ao contrario de
   * `getSession`, que so decodifica o que veio no cookie. Como o resultado
   * decide um redirect, ele precisa ser verificado — e a chamada tem que
   * acontecer aqui, antes de a resposta ser emitida, para que a renovacao
   * caiba no `setAll` acima.
   */
  const { data } = await supabase.auth.getUser()

  return { response, userId: data.user?.id ?? null }
}
