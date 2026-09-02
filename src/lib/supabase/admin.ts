import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { requireSupabaseEnv, requireSupabaseServiceRoleKey } from '@/config/env'
import type { Database } from '@/lib/supabase/database.types'

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
 * FASE 3: usada para resolver identidade (`getActor`, `recordFirstLogin`) e
 * para escrever no activity log, enquanto a RLS nao tem politicas. Fronteira
 * temporaria e com prazo — ADR-0021, revisao obrigatoria na FASE 4.
 *
 * O generico `Database` importa: sem ele toda leitura volta como `any`, e o
 * Actor nasceria sem tipo justamente no caminho que decide acesso.
 */
export function createSupabaseAdminClient() {
  const { url } = requireSupabaseEnv()
  const serviceRoleKey = requireSupabaseServiceRoleKey()

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
