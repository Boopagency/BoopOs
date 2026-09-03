import type { ProjectStatus, ProjectType, StageState } from '@/config/enums'
import type { AssertClientFacing } from '@/lib/data/projection'

/**
 * Projeções de `projects` e `project_stages`, separadas por AUDIÊNCIA.
 *
 * Mesma convenção da FASE 5 (`domains/clients/types.ts`): duas formas com dois
 * nomes, nunca uma com booleano. O que muda aqui é que `INTERNAL_FIELDS` não
 * pega nenhuma coluna destas duas tabelas — não existe `notes` em `projects` —,
 * e mesmo assim há campo que o cliente não deve receber.
 *
 * ## O que é interno sem estar em `INTERNAL_FIELDS`
 *
 * | Coluna        | Por que fica fora da projeção client-facing                 |
 * | ------------- | ----------------------------------------------------------- |
 * | `journey_key` | identificador de template (`social.v1`). Jargão técnico na   |
 * |               | tela do cliente, que a regra de frontend proíbe. Vira        |
 * |               | `summary` traduzido, não a chave crua.                       |
 * | `created_by`  | qual pessoa da Boop criou a conta. Bastidor de operação.     |
 * | `created_at`  | quando a Boop cadastrou o projeto no sistema — que não é     |
 * |               | quando o trabalho começou (`starts_on`). Confundiria.        |
 * | `updated_at`  | carimbo de infraestrutura. Não é informação de produto.      |
 *
 * `AssertClientFacing` não cobre nenhum desses, e é honesto dizer por quê: ele
 * protege a lista de campos INTERNOS do sistema, que hoje é `notes` e
 * `internal_notes`. Os quatro acima não são segredo — são ruído, ou
 * vocabulário errado para quem lê. A proteção deles é a mesma primeira camada
 * de sempre: **a coluna não sai do banco**, porque não está na lista do
 * `select`. O que não é buscado não vaza no payload do RSC.
 *
 * O assert continua ao lado de cada projeção client-facing, exportado, porque
 * é ele que cobra no dia em que `projects` ganhar uma coluna interna de
 * verdade.
 */

/* ═══ Listas de colunas — a PRIMEIRA camada ═════════════════════════════════ */

/** Lista administrativa de projetos de um cliente. Boop-side. */
export const PROJECT_LIST_COLUMNS =
  'id, client_id, name, type, status, cycle, starts_on, updated_at'

/** Detalhe interno. A única projeção que traz `journey_key` e `created_at`. */
export const PROJECT_DETAIL_COLUMNS =
  'id, client_id, name, type, status, cycle, journey_key, starts_on, ends_on, created_at, updated_at'

/**
 * Client-facing. Sem `journey_key`, sem `created_by`, sem carimbos.
 *
 * `client_id` fica: é o próprio tenant de quem lê, e a tela do portal precisa
 * dele para resolver o nome do cliente e para compor com outros loaders.
 */
export const PROJECT_PUBLIC_COLUMNS = 'id, client_id, name, type, status, cycle, starts_on'

/**
 * Etapas para o portal.
 *
 * `started_at` NÃO entra: nenhuma tela desta fase mostra quando uma etapa
 * começou — a jornada mostra o que foi concluído e o que está em andamento. A
 * regra é não buscar o que a tela não usa, e ela vale para campo inócuo
 * também: o dia em que `started_at` aparecer aqui deve ser o dia em que
 * alguém decidiu mostrá-lo.
 */
export const STAGE_PUBLIC_COLUMNS = 'id, stage_key, label, position, state, completed_at'

/** Etapas para o admin: acrescenta `started_at`, que a tela de jornada mostra. */
export const STAGE_ADMIN_COLUMNS = 'id, stage_key, label, position, state, started_at, completed_at'

/* ═══ Projeções ═════════════════════════════════════════════════════════════ */

/** Uma linha da lista de projetos de um cliente, no admin. */
export interface ProjectListItem {
  id: string
  clientId: string
  name: string
  type: ProjectType
  status: ProjectStatus
  cycle: number
  /** `starts_on` é nullable no banco, e o tipo não finge o contrário. */
  startedOn: string | null
  updatedAt: string
}

/** O projeto inteiro, para a tela interna da Boop. */
export interface ProjectDetail {
  id: string
  clientId: string
  name: string
  type: ProjectType
  status: ProjectStatus
  cycle: number
  /** ⚠️ Vocabulário interno. Nunca serializar para uma tela do portal. */
  journeyKey: string
  startedOn: string | null
  endsOn: string | null
  createdAt: string
  updatedAt: string
}

/**
 * O projeto como o cliente pode vê-lo.
 *
 * Não tem `journeyKey`: quem precisa dele para resolver os textos da jornada é
 * o servidor, e ele o busca à parte. O que atravessa a fronteira do RSC é o
 * texto já resolvido, nunca a chave.
 */
export interface ProjectPublic {
  id: string
  clientId: string
  name: string
  type: ProjectType
  status: ProjectStatus
  cycle: number
  startedOn: string | null
}

/**
 * Uma etapa da jornada, já com o texto do template resolvido.
 *
 * `summary` é `string | null` porque o template pode não ter a chave — projeto
 * criado com um template depois aposentado. `null` não é erro: é a tela
 * omitindo a linha de apoio e mostrando a etapa assim mesmo
 * (`src/config/journeys.ts#stageSummary`).
 */
export interface ProjectStage {
  id: string
  key: string
  label: string
  position: number
  state: StageState
  summary: string | null
  completedOn: string | null
}

/** Uma etapa na tela de jornada do admin. Acrescenta quando começou. */
export interface ProjectStageAdmin extends ProjectStage {
  startedOn: string | null
}

/**
 * O nome de quem cuida da conta pela Boop.
 *
 * Um objeto de um campo só, e não `string[]`, porque a tela lista pessoas e um
 * array de strings soltas convida o próximo campo a virar `${name} — ${role}`
 * concatenado. Não há papel aqui de propósito: a V0 não guarda cargo, e
 * inventar "Estrategista" a partir de `boop_member` seria escrever ficção na
 * tela do cliente (D-16).
 */
export interface TeamMemberPublic {
  name: string
}

/* ═══ A trava ═══════════════════════════════════════════════════════════════ */

/*
 * ⚠️ NÃO REMOVER. Se `projects` ou `project_stages` ganharem um campo de
 * `INTERNAL_FIELDS` — um `notes` de projeto, por exemplo —, o `pnpm typecheck`
 * para aqui, e não numa revisão de código.
 */
export type _ProjectPublicIsSafe = AssertClientFacing<ProjectPublic>
export type _ProjectStageIsSafe = AssertClientFacing<ProjectStage>
export type _TeamMemberPublicIsSafe = AssertClientFacing<TeamMemberPublic>
