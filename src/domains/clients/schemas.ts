import { z } from 'zod'

/**
 * Entrada dos workflows de cliente. Zod `.strict()`, sempre.
 *
 * `.strict()` não é preciosismo: Server Action é endpoint público, e um corpo
 * pode trazer qualquer chave. Ignorar campo desconhecido é o que permite um
 * payload carregar `created_by`, `id` ou `status` esperando que algum
 * `...spread` adiante o leia. Rejeitar é a única forma de garantir que a
 * whitelist abaixo é a whitelist inteira (.claude/rules/security.md).
 *
 * O que NÃO aparece em nenhum schema, e por quê:
 *
 *   `id`          gerado pelo banco (`gen_random_uuid()`). Aceitar id do
 *                 browser deixaria quem chama escolher a chave primária.
 *   `created_by`  vem do ator, resolvido no servidor. É autoria, e autoria
 *                 informada por quem age não prova nada.
 *   `created_at`  do banco.
 *   `updated_at`  do trigger.
 *
 * `status` também não está em `updateClientSchema`: mudar status é uma decisão
 * com capacidade própria na matriz, e por isso tem workflow próprio.
 */

/**
 * `citext unique`, com `check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')` no banco.
 *
 * A mensagem de erro descreve a regra em vez de repetir a regex: quem preenche
 * o formulário não deveria precisar ler expressão regular para entender o que
 * está errado.
 */
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, { error: 'slug_too_short' })
  .max(60, { error: 'slug_too_long' })
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: 'slug_invalid' })

const name = z
  .string()
  .trim()
  .min(2, { error: 'name_too_short' })
  .max(120, { error: 'name_too_long' })

/**
 * A nota interna aceita vazio e o converte para `null`.
 *
 * String vazia e `null` significam a mesma coisa aqui — "não há nota" —, e
 * guardar as duas produziria duas representações do mesmo estado, com duas
 * checagens na tela.
 */
const notes = z
  .string()
  .trim()
  .max(4000, { error: 'notes_too_long' })
  .transform((value) => (value.length === 0 ? null : value))
  .nullable()

const clientId = z.uuid({ error: 'client_id_invalid' })

export const createClientSchema = z.object({ name, slug, notes }).strict()

/**
 * `slug` NÃO é editável, e a ausência é decisão.
 *
 * Ele é identificador interno — o produto o descreve como "uso interno, não
 * aparece em URL do portal" (docs/data-model.md). Identificador que muda é
 * identificador que precisa de histórico, e nada no M1 pede isso. Um slug
 * errado se resolve criando o certo e arquivando o outro, que é barato
 * enquanto os clientes se contam nos dedos.
 */
export const updateClientSchema = z.object({ clientId, name, notes }).strict()

/**
 * `active ↔ paused`. Arquivar tem capacidade própria e não passa por aqui.
 *
 * O enum literal em vez de `z.enum(CLIENT_STATUSES)` é o ponto: aceitar
 * `archived` aqui deixaria `client.update` — que `boop_member` tem — arquivar
 * um cliente, contornando `client.archive`, que é só do administrador.
 */
export const setClientStatusSchema = z
  .object({ clientId, status: z.literal(['active', 'paused']) })
  .strict()

/** Arquivar e desarquivar, os dois com `client.archive` (só `boop_admin`). */
export const setClientArchivedSchema = z.object({ clientId, archived: z.boolean() }).strict()

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type SetClientStatusInput = z.infer<typeof setClientStatusSchema>
export type SetClientArchivedInput = z.infer<typeof setClientArchivedSchema>
