import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { env, requireSupabaseEnv, requireSupabaseServiceRoleKey } from '@/config/env'
import { AUTH_CALLBACK_PATH } from '@/lib/auth/routes'
import { logger } from '@/lib/logging/logger'
import type { Database } from '@/lib/supabase/database.types'

/**
 * ⚠️ FRONTEIRA DA SERVICE ROLE — O QUE ESTÁ AQUI IGNORA TODA A RLS.
 *
 * Este é o único arquivo do repositório autorizado a tocar na service role. O
 * `import 'server-only'` acima faz o build falhar se alguém importar isto de um
 * Client Component.
 *
 * ## O que mudou na FASE 5
 *
 * A FASE 4 zerou os chamadores: `getActor`, `recordFirstLogin` e `logActivity`
 * migraram para o JWT do usuário ou para fronteiras `security definer` menores
 * (ADR-0022). A service role ficou sem uso — e a própria ADR já dizia quando
 * ela voltaria: "criar usuário no convite (FASE 5)".
 *
 * É esse caso, e só ele. A diferença entre este uso e o que a FASE 4 removeu:
 *
 *   removido    autorização — ler dado de domínio ignorando a RLS;
 *   este        administração do Auth — criar uma conta em `auth.users`, que
 *               nenhum papel de aplicação pode fazer, porque `auth` não é um
 *               schema de domínio e não tem policy que sirva.
 *
 * ## O cliente admin NÃO é exportado
 *
 * `createAdminClient()` é privado do módulo de propósito. Exportá-lo tornaria
 * possível instanciá-lo no meio de um workflow "só para essa consulta" — que é
 * exatamente como um bypass volta. O que sai daqui são operações nomeadas, uma
 * por caso legítimo, e cada uma faz uma coisa só.
 *
 * **Nada aqui consulta `clients`, `projects`, `profiles` ou
 * `client_memberships`.** Domínio se lê e se escreve pelo JWT do ator, com RLS
 * (docs/security.md, .claude/rules/security.md).
 */
function createAdminClient() {
  const { url } = requireSupabaseEnv()
  const serviceRoleKey = requireSupabaseServiceRoleKey()

  return createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export type InviteAuthUserResult =
  /** Conta criada. O convite saiu por e-mail, pelo SMTP configurado no Auth. */
  | { status: 'invited'; userId: string }
  /** Já existia em `auth.users`. Não é erro: o convite é idempotente. */
  | { status: 'already_registered' }
  /** `SUPABASE_SERVICE_ROLE_KEY` ausente. A aplicação sobe sem ela (ADR-0017). */
  | { status: 'not_configured' }
  | { status: 'failed' }

/**
 * Cria a conta no Supabase Auth e dispara o e-mail de convite.
 *
 * ## Por que o Auth, e não a nossa camada de e-mail
 *
 * O convite carrega um link de autenticação, então é e-mail de AUTENTICAÇÃO —
 * e a ADR-0010 separa os dois caminhos: autenticação sai pelo Supabase Auth com
 * SMTP customizado; produto sai pelo `EmailService`, registrado em
 * `notifications`. Mandar o convite pela API do Resend obrigaria a
 * reimplementar expiração e uso único do link, que é o que a ADR recusou.
 *
 * Consequência prática: **nenhuma linha em `notifications` para o convite**. O
 * registro de que a Boop convidou alguém é `client.invited` no activity log; o
 * registro de que o e-mail saiu é do Auth.
 *
 * ## O que este método NÃO decide
 *
 * Autorização. Quem chama já passou por `can(actor, 'user.invite')` e pelo
 * escopo do cliente — este arquivo não conhece ator nem matriz, e é essa
 * ignorância que o mantém pequeno.
 *
 * O papel também não: a conta nasce com o default `client_user` pelo trigger
 * `app.handle_new_auth_user()`, e virar `boop_member` é uma segunda operação,
 * feita pelo JWT do administrador via `assign_invited_profile_role()`. Passar
 * o papel em `user_metadata` seria deixar o dado que define privilégio viajar
 * por um campo que o próprio usuário edita depois.
 */
export async function inviteAuthUser(params: {
  email: string
  fullName: string | null
}): Promise<InviteAuthUserResult> {
  let admin: ReturnType<typeof createAdminClient>

  try {
    admin = createAdminClient()
  } catch {
    /* Sem a chave, o convite não acontece — e o resto do admin continua de pé. */
    logger.warn('invite.service_role_missing')
    return { status: 'not_configured' }
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(params.email, {
    /*
     * `full_name` é o mesmo campo que `app.handle_new_auth_user()` lê para
     * preencher `profiles.full_name`. Nada além disso viaja aqui: metadata de
     * usuário é editável pelo próprio usuário depois, então não é lugar para
     * papel, vínculo ou qualquer dado que decida acesso.
     */
    ...(params.fullName ? { data: { full_name: params.fullName } } : {}),
    redirectTo: new URL(AUTH_CALLBACK_PATH, env.NEXT_PUBLIC_APP_URL).toString(),
  })

  if (error) {
    /*
     * O GoTrue devolve `email_exists` / 422 quando a conta já existe. Isso não
     * é falha: convidar de novo é o caso comum (a pessoa perdeu o e-mail, ou
     * alguém clicou duas vezes), e quem chama resolve garantindo vínculo e
     * papel. Ver a ordem de compensação em `people/mutations.ts`.
     */
    if (error.code === 'email_exists' || error.status === 422) {
      return { status: 'already_registered' }
    }

    /* Código e status. Nunca a mensagem: ela pode citar o provedor. */
    logger.error('invite.auth_failed', { code: error.code ?? 'unknown', status: error.status })
    return { status: 'failed' }
  }

  if (!data.user) {
    logger.error('invite.auth_empty_response')
    return { status: 'failed' }
  }

  return { status: 'invited', userId: data.user.id }
}
