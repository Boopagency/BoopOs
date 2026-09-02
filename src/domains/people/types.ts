import type { ProfileStatus, UserRole } from '@/config/enums'
import type { AssertClientFacing } from '@/lib/data/projection'

/**
 * Projeções de `profiles` e `client_memberships`.
 *
 * As duas tabelas moram no mesmo domínio de propósito. Um vínculo é o acesso
 * de UMA PESSOA a um cliente — quem convida, quem dá acesso, quem tira e quem
 * desliga são a mesma operação vista de ângulos diferentes, e separá-las em
 * dois domínios criaria um par que só sabe existir importando o outro
 * (docs/architecture.md — nenhum domínio importa outro direto).
 *
 * `clients` fica de fora e continua sozinho: ele é o tenant, não uma pessoa.
 * A tela de detalhe do cliente compõe os dois — é papel de tela, não de
 * domínio.
 *
 * ## Sobre e-mail
 *
 * `email` é PII e aparece nas duas projeções abaixo, que são **Boop-side**:
 * quem as busca passou por `requireBoop()`. Não existe projeção client-facing
 * de pessoa nesta fase porque nenhuma tela client-facing lista pessoas. Quando
 * existir, ela nasce aqui, com o mesmo `AssertClientFacing` — e sem `email`,
 * a menos que o produto peça.
 */

/** Uma linha de `/admin/usuarios`. Boop-side. */
export interface PersonListItem {
  id: string
  fullName: string | null
  email: string
  role: UserRole
  status: ProfileStatus
  /** Quantos clientes esta pessoa alcança. `boop_admin` alcança todos (D-08). */
  clientCount: number
}

/** Uma pessoa na lista de quem alcança um cliente. Boop-side. */
export interface ClientMember {
  membershipId: string
  userId: string
  fullName: string | null
  email: string
  role: UserRole
  status: ProfileStatus
  grantedAt: string
}

/** Uma pessoa que ainda NÃO alcança este cliente, para o seletor de vínculo. */
export interface AssignablePerson {
  id: string
  fullName: string | null
  email: string
  role: UserRole
}

/*
 * ⚠️ NÃO REMOVER. Mesma trava de `clients/types.ts`: se alguma destas ganhar um
 * campo de `INTERNAL_FIELDS`, o `pnpm typecheck` para aqui.
 *
 * Hoje nenhuma delas tem por onde ganhar — `profiles` não tem coluna interna —,
 * e o assert existe porque a lista de campos internos é do sistema, não da
 * tabela: o dia em que `notes` aparecer em `profiles`, esta linha cobra.
 */
export type _PersonListItemIsSafe = AssertClientFacing<PersonListItem>
export type _ClientMemberIsSafe = AssertClientFacing<ClientMember>
export type _AssignablePersonIsSafe = AssertClientFacing<AssignablePerson>
