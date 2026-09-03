import type { ProjectStatus } from '@/config/enums'
import type { Actor } from '@/lib/auth/actor'
import type { ProjectPublic } from '@/domains/projects/types'

/**
 * Visibilidade de produto — a regra que a RLS NAO decide.
 *
 * Puro, sem `server-only`, sem banco: sao funcoes de decisao, e por isso vivem
 * fora de `queries.ts`. Logica sem I/O atras de `server-only` fica intestavel
 * sem subir meio Next, e um teste caro e um teste que alguem acaba nao
 * escrevendo.
 *
 * ## As duas perguntas, e por que sao duas
 *
 * A RLS responde **tenant**: "este ator alcanca este projeto?". `projects_select`
 * usa `has_client_access(client_id)` e concede a linha inteira — inclusive de um
 * projeto `draft`, o que esta certo: a Boop precisa ver rascunho para trabalhar
 * nele.
 *
 * O que a policy nao pode responder e **visibilidade**: `authenticated` e um
 * papel so para as tres personas, entao um predicado por status na policy
 * tiraria o rascunho da Boop junto com o do cliente. A regra de produto mora
 * aqui, no servidor, exatamente como a projecao de `clients.notes` mora na lista
 * de colunas (§33 do escopo da FASE 6).
 *
 *   `isPortalVisible`     pode ABRIR por URL direta?
 *   `isPortalResolvable`  entra na escolha AUTOMATICA de `/portal`?
 *
 * As duas nao sao a mesma: um projeto concluido e visivel e nao e resolvivel.
 */

/**
 * O `client_user` nunca alcanca um projeto `draft`, nem por URL direta.
 *
 * E o analogo direto de conteudo em `idea`, que `docs/security.md` proibe expor:
 * trabalho que a Boop ainda nao mostrou.
 *
 * Os outros quatro ele alcanca — `active` e `paused` porque sao o trabalho
 * corrente, `completed` e `archived` porque sao o historico dele, e esconder o
 * proprio passado seria apagar a conta em vez de encerra-la.
 */
const CLIENT_HIDDEN_STATUSES: readonly ProjectStatus[] = ['draft']

/**
 * O que entra na resolucao AUTOMATICA de `/portal`.
 *
 * `completed` e `archived` ficam de fora: continuam alcancaveis por URL e
 * continuam no historico, mas mandar alguem direto para um projeto encerrado
 * responderia a pergunta errada. Um cliente cujo unico projeto terminou ve o
 * estado vazio, que e a verdade (D-18).
 */
const RESOLVABLE_STATUSES: readonly ProjectStatus[] = ['active', 'paused']

/** Este ator pode ABRIR um projeto neste status? */
export function isPortalVisible(status: ProjectStatus, actor: Actor): boolean {
  if (actor.role !== 'client_user') return true
  return !CLIENT_HIDDEN_STATUSES.includes(status)
}

/** Este projeto participa da resolucao automatica de `/portal`? */
export function isPortalResolvable(status: ProjectStatus, actor: Actor): boolean {
  return isPortalVisible(status, actor) && RESOLVABLE_STATUSES.includes(status)
}

/**
 * A decisao de `/portal`, separada da rota para poder ser testada sem Next.
 *
 * Tres saidas, e nenhuma delas escolhe as cegas:
 *
 *   `empty`    nenhum projeto resolvivel. Vira estado vazio com voz — nunca
 *              404, nunca redirect para um projeto encerrado (D-19).
 *   `single`   exatamente um. Redireciona direto, sem seletor.
 *   `choice`   dois ou mais. Mostra a escolha; `.first()` seria arbitrario.
 */
export type PortalResolution =
  | { kind: 'empty' }
  | { kind: 'single'; project: ProjectPublic }
  | { kind: 'choice'; projects: ProjectPublic[] }

export function resolvePortalEntry(
  projects: readonly ProjectPublic[],
  actor: Actor,
): PortalResolution {
  const resolvable = projects.filter((project) => isPortalResolvable(project.status, actor))

  if (resolvable.length === 0) return { kind: 'empty' }
  if (resolvable.length === 1 && resolvable[0]) return { kind: 'single', project: resolvable[0] }

  /*
   * A ORDEM recebida e preservada. Quem ordena e a consulta, com desempate
   * total (`starts_on`, `created_at`, `id`): reordenar aqui criaria uma segunda
   * regra de ordenacao, e as duas discordariam no primeiro empate.
   */
  return { kind: 'choice', projects: resolvable }
}
