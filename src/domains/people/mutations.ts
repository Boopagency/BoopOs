import 'server-only'

import {
  disableUserSchema,
  grantClientAccessSchema,
  inviteUserSchema,
  revokeClientAccessSchema,
} from '@/domains/people/schemas'
import { inviteAuthUser } from '@/lib/supabase/admin'
import type { SupabaseServerClient } from '@/lib/supabase/server'
import { defineWorkflow, scopeAllowed, scopeDenied } from '@/lib/workflow/define'
import { WorkflowError } from '@/lib/workflow/errors'

/**
 * Workflows de pessoas e vínculos. Quatro, cobrindo `user.invite`,
 * `user.disable`, `membership.grant` e `membership.revoke` — todos `boop_admin`
 * na matriz, e todos `is_boop_admin()` na policy ou na fronteira SQL.
 *
 * ## Onde a service role entra, e onde não entra
 *
 * Um único ponto: `inviteAuthUser()`, que cria a conta em `auth.users`. Nenhum
 * papel de aplicação pode escrever em `auth`, e não existe policy que sirva —
 * não é schema de domínio.
 *
 * Todo o resto desta página — procurar a pessoa, definir o papel, criar o
 * vínculo, revogar, desligar — sai pelo JWT do administrador, com RLS valendo.
 * Isso é verificável: `ctx.db` é o cliente do ator, e a única importação
 * privilegiada é a da linha 9 (ADR-0022, §43 do briefing da fase).
 */

const UNIQUE_VIOLATION = '23505'

/**
 * A pessoa deste e-mail, se este ator a enxerga.
 *
 * Pelo JWT: `profiles_select` concede todas as linhas a `boop_admin`, e é ele
 * quem chega aqui. Não há service role nesta leitura, e não deveria haver —
 * procurar pessoa por e-mail é consulta de domínio.
 */
async function findProfileByEmail(db: SupabaseServerClient, email: string) {
  const { data } = await db
    .from('profiles')
    .select('id, email, role, status')
    .eq('email', email)
    .maybeSingle()

  return data ?? null
}

/** Este ator alcança este cliente? Mesma pergunta dos guards, sem `notFound()`. */
async function reachesClient(db: SupabaseServerClient, clientId: string): Promise<boolean> {
  const { data } = await db.from('clients').select('id').eq('id', clientId).maybeSingle()
  return Boolean(data)
}

/**
 * Cria o vínculo, tratando "já existe" como sucesso.
 *
 * A idempotência é do banco: `unique (client_id, user_id)`. Convidar duas
 * vezes, ou clicar duas vezes no celular, produz um vínculo — o caso comum é o
 * duplo clique, não o ataque (docs/workflows.md#idempotência).
 */
async function grantMembership(
  db: SupabaseServerClient,
  params: { clientId: string; userId: string; createdBy: string },
): Promise<{ membershipId: string; created: boolean }> {
  const { data, error } = await db
    .from('client_memberships')
    .insert({
      client_id: params.clientId,
      user_id: params.userId,
      created_by: params.createdBy,
    })
    .select('id')
    .single()

  if (!error) return { membershipId: data.id, created: true }

  if (error.code === UNIQUE_VIOLATION) {
    const { data: existing } = await db
      .from('client_memberships')
      .select('id')
      .eq('client_id', params.clientId)
      .eq('user_id', params.userId)
      .maybeSingle()

    if (existing) return { membershipId: existing.id, created: false }
  }

  throw new WorkflowError('membership.grant_failed', { code: error.code })
}

/**
 * Convidar alguém: conta no Auth, papel e vínculo.
 *
 * ## A ordem, e por que ela é essa
 *
 * `auth.users` e `public` são dois sistemas, e `supabase-js` não abre transação
 * entre eles. Fingir atomicidade aqui seria pior do que não ter: o passo 1
 * dispara um e-mail, e e-mail não tem rollback.
 *
 *   1. procurar por e-mail — se a pessoa existe, o Auth é pulado inteiro;
 *   2. `inviteAuthUser()` — cria a conta e manda o e-mail. O trigger
 *      `app.handle_new_auth_user()` cria o perfil como `invited`/`client_user`;
 *   3. `assign_invited_profile_role()` — só se o papel pedido não for o default;
 *   4. vínculo, se houver cliente.
 *
 * ## O que acontece se parar no meio
 *
 * Falha entre 2 e 4 deixa a pessoa criada, convidada por e-mail, e sem vínculo.
 * O estado é **visível** — ela aparece em `/admin/usuarios` com zero clientes —
 * e **recuperável**: reexecutar o mesmo convite pula o passo 2 (já existe),
 * reaplica 3 e completa 4. Não há compensação a escrever porque não há nada a
 * desfazer: uma conta convidada sem vínculo não alcança dado nenhum, já que
 * `app.has_client_access()` é falso sem vínculo.
 *
 * O caminho inverso — vínculo antes do Auth — não existe: o vínculo precisa do
 * `user_id`, que só nasce no passo 2.
 */
export const inviteUser = defineWorkflow({
  name: 'user.invite',
  input: inviteUserSchema,
  capability: 'user.invite',
  authorize: async ({ input, ctx }) => {
    if (!input.clientId) return scopeAllowed()
    return (await reachesClient(ctx.db, input.clientId)) ? scopeAllowed() : scopeDenied()
  },
  handler: async ({ actor, input, ctx }) => {
    const existing = await findProfileByEmail(ctx.db, input.email)

    /*
     * Desligada não se reconvida. `disable_profile()` não tem inverso na V0, e
     * deixar o convite reativar alguém pela porta lateral seria criar esse
     * inverso sem decidir que ele existe.
     */
    if (existing?.status === 'disabled') {
      throw new WorkflowError('invite.user_disabled')
    }

    let userId = existing?.id ?? null
    let emailSent = false

    if (!userId) {
      const result = await inviteAuthUser({ email: input.email, fullName: input.fullName })

      switch (result.status) {
        case 'invited':
          userId = result.userId
          emailSent = true
          break
        case 'already_registered':
          /*
           * Existe no Auth e não em `profiles` — o trigger falhou, ou a linha
           * foi removida à mão. Não dá para seguir sem `user_id`, e inventar
           * um seria inventar identidade.
           */
          throw new WorkflowError('invite.account_exists_without_profile')
        case 'not_configured':
          throw new WorkflowError('invite.not_configured')
        default:
          throw new WorkflowError('invite.failed')
      }
    }

    /*
     * O papel só se aplica a quem ainda não entrou. A fronteira devolve
     * `not_invited` para perfil ativo, e isso não é erro: significa que a
     * pessoa já trabalha no sistema e trocar o papel dela não está na matriz.
     */
    const { data: roleResult, error: roleError } = await ctx.db.rpc('assign_invited_profile_role', {
      p_user_id: userId,
      p_role: input.role,
    })

    if (roleError) throw new WorkflowError('invite.role_failed', { code: roleError.code })

    const roleApplied = roleResult === 'assigned'

    let membershipGranted = false

    if (input.clientId) {
      const membership = await grantMembership(ctx.db, {
        clientId: input.clientId,
        userId,
        createdBy: actor.userId,
      })

      membershipGranted = membership.created

      if (membership.created) {
        ctx.activity({
          action: 'membership.granted',
          entityType: 'client_membership',
          entityId: membership.membershipId,
          clientId: input.clientId,
          metadata: { user_id: userId },
        })
      }
    }

    ctx.activity({
      action: 'client.invited',
      entityType: 'profile',
      entityId: userId,
      ...(input.clientId ? { clientId: input.clientId } : {}),
      /* Identificadores e transições. O e-mail é PII e não entra no log. */
      metadata: { role: input.role, email_sent: emailSent, role_applied: roleApplied },
    })

    return {
      userId,
      emailSent,
      /** `false` quando a pessoa já existia e já estava ativa. */
      roleApplied,
      membershipGranted,
      alreadyExisted: Boolean(existing),
    }
  },
})

export const grantClientAccess = defineWorkflow({
  name: 'membership.grant',
  input: grantClientAccessSchema,
  capability: 'membership.grant',
  authorize: async ({ input, ctx }) => {
    return (await reachesClient(ctx.db, input.clientId)) ? scopeAllowed() : scopeDenied()
  },
  handler: async ({ actor, input, ctx }) => {
    /*
     * A pessoa precisa ser visível para este ator antes de ganhar acesso.
     * `profiles_select` responde por isso; sem a leitura, um uuid qualquer no
     * corpo do POST criaria vínculo para alguém que quem chama nem enxerga.
     */
    const { data: person } = await ctx.db
      .from('profiles')
      .select('id, role, status')
      .eq('id', input.userId)
      .maybeSingle()

    if (!person) throw new WorkflowError('resource.not_found')
    if (person.status === 'disabled') throw new WorkflowError('membership.user_disabled')

    /*
     * `boop_admin` já alcança todos os clientes por papel global (D-08). Um
     * vínculo para ele não concede nada e, na tela, sugere que concede — o que
     * faria alguém "revogar o acesso" de um administrador e não revogar nada.
     */
    if (person.role === 'boop_admin') throw new WorkflowError('membership.admin_is_global')

    const membership = await grantMembership(ctx.db, {
      clientId: input.clientId,
      userId: input.userId,
      createdBy: actor.userId,
    })

    if (membership.created) {
      ctx.activity({
        action: 'membership.granted',
        entityType: 'client_membership',
        entityId: membership.membershipId,
        clientId: input.clientId,
        metadata: { user_id: input.userId },
      })
    }

    return {
      clientId: input.clientId,
      membershipId: membership.membershipId,
      created: membership.created,
    }
  },
})

export const revokeClientAccess = defineWorkflow({
  name: 'membership.revoke',
  input: revokeClientAccessSchema,
  capability: 'membership.revoke',
  handler: async ({ input, ctx }) => {
    /*
     * Lido ANTES do DELETE, e não depois: o log precisa de `client_id` e
     * `user_id`, e depois da remoção não há de onde tirá-los. Também é o que
     * transforma "vínculo de outro tenant" em 404 genérico — a leitura passa
     * pela RLS.
     */
    const { data: membership } = await ctx.db
      .from('client_memberships')
      .select('id, client_id, user_id')
      .eq('id', input.membershipId)
      .maybeSingle()

    if (!membership) throw new WorkflowError('resource.not_found')

    const { error } = await ctx.db.from('client_memberships').delete().eq('id', input.membershipId)

    if (error) throw new WorkflowError('membership.revoke_failed', { code: error.code })

    ctx.activity({
      action: 'membership.revoked',
      entityType: 'client_membership',
      entityId: membership.id,
      clientId: membership.client_id,
      metadata: { user_id: membership.user_id },
    })

    return { clientId: membership.client_id, userId: membership.user_id }
  },
})

/**
 * Desligar alguém.
 *
 * A escrita sai por `disable_profile()` — `security definer`, exigindo
 * `boop_admin` por dentro e recusando o próprio chamador. `profiles` não tem
 * policy nem GRANT de UPDATE para ninguém, e continua sem: `role` mora na mesma
 * linha, e conceder o UPDATE genérico seria conceder escalada junto
 * (ADR-0022 e a migration `..._people_administration_boundaries`).
 *
 * O vínculo NÃO é removido. Desligar é sobre a pessoa, não sobre a conta que
 * ela atendia — e `app.actor_role()` já devolve null para quem não está
 * `active`, então o acesso acaba no request seguinte com o histórico intacto.
 */
export const disableUser = defineWorkflow({
  name: 'user.disable',
  input: disableUserSchema,
  capability: 'user.disable',
  handler: async ({ input, ctx }) => {
    const { data, error } = await ctx.db.rpc('disable_profile', { p_user_id: input.userId })

    if (error) {
      /* `42501` é a recusa da própria fronteira: não-admin, ou alvo = chamador. */
      if (error.code === '42501') throw new WorkflowError('user.disable_denied')
      throw new WorkflowError('user.disable_failed', { code: error.code })
    }

    if (data === 'not_found') throw new WorkflowError('resource.not_found')

    if (data === 'disabled') {
      ctx.activity({
        action: 'user.disabled',
        entityType: 'profile',
        entityId: input.userId,
      })
    }

    return { userId: input.userId, alreadyDisabled: data === 'already_disabled' }
  },
})
