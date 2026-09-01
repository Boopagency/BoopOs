import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { requireSupabaseEnv, requireSupabaseServiceRoleKey } from '@/config/env'

/**
 * ⚠️ CLIENTE ADMINISTRATIVO — IGNORA TODA A RLS.
 *
 * Este e o unico arquivo do repositorio autorizado a tocar na service role.
 * O `import 'server-only'` acima faz o build falhar se alguem importar isto
 * de um Client Component.
 *
 * Usos legitimos (docs/security.md): criar usuario no convite, gerar link de
 * autenticacao, assinar URL de storage, seed e manutencao. Nada alem disso.
 *
 * FASE 1: a fronteira existe, ninguem a usa ainda.
 */
export function createSupabaseAdminClient() {
  const { url } = requireSupabaseEnv()
  const serviceRoleKey = requireSupabaseServiceRoleKey()

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
