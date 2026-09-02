import { z } from 'zod'

/**
 * Entrada dos workflows de pessoas e vínculos. Zod `.strict()`, sempre.
 *
 * Duas coisas que NÃO estão em nenhum schema, e são as mais importantes:
 *
 *   `userId` no convite     quem é a pessoa é resultado da criação no Auth,
 *                           não entrada. Aceitá-lo deixaria quem chama apontar
 *                           o convite para uma conta existente.
 *   `boop_admin` como papel a matriz tem `user.invite_client_user` e
 *                           `user.invite_boop_member`, e não tem a terceira
 *                           linha. Criar administrador é provisionamento
 *                           (`scripts/auth/provision-user.sh`), não produto —
 *                           e como `boop_admin` é global por D-08, seria a
 *                           escalada mais barata do sistema. O banco concorda:
 *                           `assign_invited_profile_role()` recusa o valor.
 */

const userId = z.uuid({ error: 'user_id_invalid' })
const clientId = z.uuid({ error: 'client_id_invalid' })

/**
 * `citext` no banco garante unicidade sem diferenciar caixa; o `toLowerCase()`
 * aqui garante que a busca por e-mail existente use a mesma forma que o Auth
 * grava. Sem isso, "Ana@x.com" e "ana@x.com" viram dois convites.
 */
/*
 * Normalizar ANTES de validar, e por isso o `.pipe()`.
 *
 * Em `z.email().trim()` a validação é a base e o trim vem depois: um e-mail
 * colado com espaço — o caso mais comum de todos — seria recusado como
 * inválido antes de alguém ter a chance de limpá-lo. Encadeando na ordem certa,
 * `"  ANA@Marca.COM "` vira `ana@marca.com` e só então é conferido.
 */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(320, { error: 'email_too_long' })
  .pipe(z.email({ error: 'email_invalid' }))

const fullName = z
  .string()
  .trim()
  .max(120, { error: 'name_too_long' })
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()

/** Os dois papéis convidáveis. `boop_admin` ausente — ver o cabeçalho. */
const invitableRole = z.literal(['boop_member', 'client_user'])

/**
 * O vínculo é opcional no schema e obrigatório para `client_user`.
 *
 * A regra mora em `superRefine` porque é uma relação entre dois campos, e não
 * uma propriedade de um deles: um `client_user` sem cliente não alcança nada —
 * entraria no sistema para ver uma tela vazia. Um `boop_member` sem vínculo é
 * legítimo: ele é da Boop, e o vínculo vem quando entrar em uma conta.
 */
export const inviteUserSchema = z
  .object({
    email,
    fullName,
    role: invitableRole,
    clientId: clientId.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.role === 'client_user' && !value.clientId) {
      ctx.addIssue({
        code: 'custom',
        path: ['clientId'],
        message: 'client_required_for_client_user',
      })
    }
  })

export const grantClientAccessSchema = z.object({ clientId, userId }).strict()

export const revokeClientAccessSchema = z.object({ membershipId: z.uuid() }).strict()

export const disableUserSchema = z.object({ userId }).strict()

export type InviteUserInput = z.infer<typeof inviteUserSchema>
export type GrantClientAccessInput = z.infer<typeof grantClientAccessSchema>
export type RevokeClientAccessInput = z.infer<typeof revokeClientAccessSchema>
export type DisableUserInput = z.infer<typeof disableUserSchema>
