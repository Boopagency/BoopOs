import type { ClientStatus } from '@/config/enums'
import type { AssertClientFacing } from '@/lib/data/projection'

/**
 * Projeções de `clients`, separadas por AUDIÊNCIA — não por tela.
 *
 * A separação por audiência é o que fecha a dívida column-level da FASE 4.
 * `clients.notes` é bastidor da Boop e viaja na mesma linha que o cliente tem
 * direito de ler; a RLS não separa coluna, então quem separa é isto aqui
 * (docs/security.md, `src/lib/data/projection.ts`).
 *
 * ## Por que audiência, e não um booleano
 *
 * A alternativa óbvia — uma projeção só, com `includeNotes?: boolean` — foi
 * recusada de propósito. Ela coloca a proteção de um dado interno em um
 * argumento, e um argumento tem valor padrão, pode ser esquecido, pode ser
 * invertido em um refactor e não deixa rastro no tipo. Duas formas com dois
 * nomes não têm como ser confundidas: quem escreve `ClientPublic` não tem
 * `notes` para vazar, porque o campo não existe naquele tipo.
 *
 * ## As três formas
 *
 * | Tipo             | Audiência   | `notes` |
 * | ---------------- | ----------- | ------- |
 * | `ClientListItem` | Boop        | não     |
 * | `ClientDetail`   | Boop        | **sim** |
 * | `ClientPublic`   | qualquer um | nunca   |
 *
 * `ClientListItem` também não carrega `notes`, e não por segurança: uma lista
 * não mostra nota interna, então buscá-la seria trazer do banco um dado que a
 * tela não usa — e o que não é buscado não vaza em serialização de RSC.
 */

/**
 * As listas de colunas de cada projeção — a PRIMEIRA camada da proteção.
 *
 * Ficam aqui, e não em `queries.ts`, por dois motivos. O contrato de audiência
 * é um só: o tipo e as colunas que o preenchem descrevem a mesma decisão, e
 * separá-los deixaria um lugar para mudar sem o outro. E `queries.ts` importa
 * `server-only` e `next/navigation`, o que o torna ilegível para um teste de
 * unidade — as constantes precisam ser conferíveis sem subir meio Next.
 *
 * `select *` é proibido pela regra do repositório. Estas são as listas.
 */

/** Lista administrativa. Sem `notes`: lista não mostra nota interna. */
export const CLIENT_LIST_COLUMNS = 'id, name, slug, status, updated_at'

/** Detalhe interno. A ÚNICA projeção do sistema que traz `notes`. */
export const CLIENT_DETAIL_COLUMNS = 'id, name, slug, status, notes, created_at, updated_at'

/** Client-facing. Nunca ganha coluna interna — há teste que falha se ganhar. */
export const CLIENT_PUBLIC_COLUMNS = 'id, name, slug, status'

/** Uma linha da lista administrativa. Boop-side, sem campo interno. */
export interface ClientListItem {
  id: string
  name: string
  slug: string
  status: ClientStatus
  /** Quantas pessoas alcançam este cliente. Resolvido em `people/queries`. */
  memberCount: number
  updatedAt: string
}

/**
 * O cliente inteiro, para a tela interna da Boop.
 *
 * Este é o ÚNICO tipo do sistema que carrega `notes`, e ele nunca alcança um
 * `client_user`: quem o busca é `getClientDetail()`, que exige `client.
 * read_internal_notes` — capacidade que a matriz concede só a `boop_admin` e
 * `boop_member` (docs/permissions.md).
 */
export interface ClientDetail {
  id: string
  name: string
  slug: string
  status: ClientStatus
  /** ⚠️ INTERNO. Nunca serializar para um Client Component do portal. */
  notes: string | null
  createdAt: string
  updatedAt: string
}

/**
 * O cliente como o próprio cliente pode vê-lo.
 *
 * É o contrato que a FASE 6 em diante consome no portal — o nome da marca no
 * cabeçalho, o slug em um identificador interno, o status para saber se a
 * conta está ativa. Nada além disso sai daqui.
 *
 * O `AssertClientFacing` abaixo não é documentação: é o `pnpm typecheck`
 * falhando se alguém acrescentar `notes` a este tipo.
 */
export interface ClientPublic {
  id: string
  name: string
  slug: string
  status: ClientStatus
}

/*
 * ⚠️ NÃO REMOVER. Estas linhas são a terceira camada da proteção descrita em
 * `src/lib/data/projection.ts`: se `ClientPublic` ou `ClientListItem` ganharem
 * um campo de `INTERNAL_FIELDS`, o build para aqui, com o nome do tipo no erro.
 */
export type _ClientPublicIsSafe = AssertClientFacing<ClientPublic>
export type _ClientListItemIsSafe = AssertClientFacing<ClientListItem>

/** Reduz a projeção interna à client-facing. O único caminho entre as duas. */
export function toClientPublic(client: ClientDetail): ClientPublic {
  /*
   * Campo a campo, e nunca `const { notes, ...rest } = client`.
   *
   * O rest spread parece equivalente e não é: ele diz "tudo menos o que eu
   * lembrei de tirar". Uma coluna interna nova entraria no resultado sozinha,
   * em silêncio, e o tipo não reclamaria porque `ClientPublic` aceitaria o
   * objeto mais largo. A lista explícita diz "só isto", e é o contrário.
   */
  return {
    id: client.id,
    name: client.name,
    slug: client.slug,
    status: client.status,
  }
}
