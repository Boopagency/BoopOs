import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { requireSupabaseEnv } from '@/config/env'

/**
 * Cliente Supabase para uso em Server Components, Server Actions e Route
 * Handlers. Fala com o banco usando o JWT do usuario, entao a RLS continua
 * valendo — e essa e a segunda camada de autorizacao (docs/security.md).
 *
 * FASE 1: apenas a fronteira existe. Nao ha banco, nao ha sessao, nao ha query.
 * A leitura e a escrita dos cookies de sessao entram na FASE 3, junto com
 * `@supabase/ssr` e o middleware de renovacao.
 */
export function createSupabaseServerClient(cookies: {
  getAll: () => { name: string; value: string }[]
  setAll: (items: { name: string; value: string; options?: object }[]) => void
}) {
  const { url, anonKey } = requireSupabaseEnv()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: cookies.getAll,
      setAll: cookies.setAll,
    },
  })
}
