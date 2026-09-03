/**
 * `can()` — a matriz de permissoes como funcao pura.
 *
 * Puro de proposito: sem I/O, sem banco, sem `async`. Isso a torna testavel em
 * tabela (`tests/unit/permissions.matrix.test.ts`), rapida o bastante para
 * rodar em qualquer lugar, e — o que mais importa — legivel: da para conferir
 * a regra contra `docs/permissions.md` lendo uma tela de codigo.
 *
 * ## O que `can()` decide, e o que ela NAO decide
 *
 * Ela responde **por papel**: "um `client_user` pode aprovar conteudo?".
 * Ela nao responde **por escopo**: "este `client_user` alcanca ESTE cliente?".
 *
 * A separacao nao e arbitraria. Escopo depende do banco — de `client_memberships`
 * no instante do request — e uma copia disso na aplicacao teria prazo de
 * validade. Quem responde escopo e `requireClientAccess`/`requireProjectAccess`
 * (que consultam sob RLS) e, por baixo delas, as proprias policies.
 *
 * Entao a cadeia completa de uma escrita e:
 *
 *   can(actor, capability)        →  o papel permite isto?
 *   requireClientAccess(clientId) →  este actor alcanca este tenant?
 *   RLS                           →  o banco nega de novo, se os dois erraram
 *
 * ## Por que uma tabela e nao um motor de permissoes
 *
 * Sao tres papeis e um tipo de vinculo. Um motor generico (ABAC, DSL, policy
 * engine) resolveria um problema que este produto nao tem, e trocaria uma
 * tabela conferivel a olho por uma indirecao — ver a lista de overengineering
 * em docs/spec-review.md.
 */
import type { UserRole } from '@/config/enums'

/**
 * As capacidades da V0 cujo recurso **ja existe no schema**.
 *
 * Deliberadamente nao estao aqui `file.*`, `meeting.*`, `metrics.*` e
 * `review.*`: as tabelas chegam em fases posteriores, e capacidade sem recurso
 * e regra que ninguem exercita — nem em teste, nem em producao.
 */
export const CAPABILITIES = [
  /* Clientes */
  'client.read',
  'client.create',
  'client.update',
  'client.archive',
  'client.read_internal_notes',
  /* Pessoas e vinculos */
  'user.list',
  'user.invite',
  'user.disable',
  'membership.grant',
  'membership.revoke',
  /* Projetos */
  'project.read',
  'project.create',
  'project.update',
  'project.advance_stage',
  'project.change_status',
  /* Onboarding */
  'onboarding.template.manage',
  'onboarding.start',
  'onboarding.answer',
  'onboarding.submit',
  'onboarding.read_answers',
  /* Estrategia */
  'strategy.create',
  'strategy.read_draft',
  'strategy.read_published',
  'strategy.send_for_approval',
  'strategy.approve',
  'strategy.request_changes',
  /* Conteudo */
  'content.create',
  'content.read_internal',
  'content.read_shared',
  'content.send_for_approval',
  'content.approve',
  'content.request_changes',
  'content.comment_internal',
  'content.comment_public',
  'content.mark_published',
  'content.archive',
  /* Sistema */
  'activity.read',
  'notification.read',
] as const

export type Capability = (typeof CAPABILITIES)[number]

/**
 * Quem pode o que, por papel global.
 *
 * Cada linha e uma celula de `docs/permissions.md`. Onde o documento diz
 * "escopo", o papel aparece aqui e o escopo e conferido depois — a lista
 * responde "pode em principio", nao "pode neste cliente".
 *
 * As tres linhas vazias sao as mais importantes do arquivo.
 */
const PERMITIDO: Record<Capability, readonly UserRole[]> = {
  'client.read': ['boop_admin', 'boop_member', 'client_user'],
  'client.create': ['boop_admin'],
  'client.update': ['boop_admin', 'boop_member'],
  'client.archive': ['boop_admin'],
  /* `clients.notes` e bastidor da Boop. */
  'client.read_internal_notes': ['boop_admin', 'boop_member'],

  'user.list': ['boop_admin', 'boop_member'],
  /* Convidar e desligar sao escalada e destruicao: ficam com o admin. */
  'user.invite': ['boop_admin'],
  'user.disable': ['boop_admin'],
  'membership.grant': ['boop_admin'],
  'membership.revoke': ['boop_admin'],

  'project.read': ['boop_admin', 'boop_member', 'client_user'],
  'project.create': ['boop_admin'],
  'project.update': ['boop_admin', 'boop_member'],
  /*
   * `advance_stage` e a autoridade sobre a JORNADA inteira na V0 — avancar e
   * tambem corrigir (`setStageState`). Nao ha capacidade separada para a
   * correcao manual: e a mesma decisao, tomada pela mesma pessoa, sobre a
   * mesma linha. Vocabulario novo sem caso novo so aumenta o que precisa ser
   * mantido em duas listas (docs/permissions.md, FASE 6).
   */
  'project.advance_stage': ['boop_admin', 'boop_member'],
  /*
   * Estava na matriz de docs/permissions.md desde a FASE 0 e nao estava aqui.
   * O banco ja cobria o caso — `projects_update` exige `is_boop()` e vinculo —,
   * entao nao houve brecha aberta; o que faltava era a linha da matriz ter
   * representacao em `can()`. Ver a nota sobre paridade em
   * `tests/unit/permissions.matrix.test.ts` (FASE 6).
   */
  'project.change_status': ['boop_admin', 'boop_member'],

  'onboarding.template.manage': ['boop_admin'],
  'onboarding.start': ['boop_admin', 'boop_member'],
  'onboarding.answer': ['boop_admin', 'boop_member', 'client_user'],
  'onboarding.submit': ['boop_admin', 'boop_member', 'client_user'],
  'onboarding.read_answers': ['boop_admin', 'boop_member', 'client_user'],

  'strategy.create': ['boop_admin', 'boop_member'],
  /* Rascunho e trabalho em andamento: o cliente entra quando esta pronto. */
  'strategy.read_draft': ['boop_admin', 'boop_member'],
  'strategy.read_published': ['boop_admin', 'boop_member', 'client_user'],
  'strategy.send_for_approval': ['boop_admin', 'boop_member'],
  /*
   * ⚠️ APROVAR E EXCLUSIVO DO CLIENTE — e a lista NAO tem `boop_admin`.
   *
   * Nao e esquecimento nem excesso de zelo: aprovacao e registro de decisao do
   * cliente, e e o que da valor ao produto inteiro. Escopo global (D-08) diz
   * QUAIS clientes o admin alcanca, nao quais invariantes de dominio ele pode
   * quebrar. Registrar aprovacao recebida por outro canal e um workflow
   * distinto e explicito, que nao existe na V0 (D-03).
   *
   * O banco concorda: `strategy_approvals` e `content_approvals` nao tem
   * policy de INSERT para ninguem.
   */
  'strategy.approve': ['client_user'],
  'strategy.request_changes': ['client_user'],

  'content.create': ['boop_admin', 'boop_member'],
  /* `idea` ate `internal_review` sao bastidor. */
  'content.read_internal': ['boop_admin', 'boop_member'],
  'content.read_shared': ['boop_admin', 'boop_member', 'client_user'],
  'content.send_for_approval': ['boop_admin', 'boop_member'],
  'content.approve': ['client_user'],
  'content.request_changes': ['client_user'],
  'content.comment_internal': ['boop_admin', 'boop_member'],
  'content.comment_public': ['boop_admin', 'boop_member', 'client_user'],
  'content.mark_published': ['boop_admin', 'boop_member'],
  'content.archive': ['boop_admin', 'boop_member'],

  /* D-05: o cliente nao le o log na V0. */
  'activity.read': ['boop_admin', 'boop_member'],
  'notification.read': ['boop_admin'],
}

/** O ator, reduzido ao que a decisao de papel precisa. */
export type PolicyActor = {
  role: UserRole
  status: 'invited' | 'active' | 'disabled'
}

export type PolicyResult = { allowed: true } | { allowed: false; code: string }

const allow = (): PolicyResult => ({ allowed: true })
const deny = (code: string): PolicyResult => ({ allowed: false, code })

/**
 * O papel deste ator permite esta capacidade?
 *
 * Fail closed em duas frentes: perfil que nao esta `active` nao pode nada, e
 * capacidade desconhecida nega — nunca "nao encontrei a regra, entao passa".
 */
export function can(actor: PolicyActor, capability: Capability): PolicyResult {
  /*
   * Mesma regra que `app.actor_role()` aplica no banco: sem perfil ativo, sem
   * papel. As duas camadas dizem a mesma coisa, e e isso que se espera delas.
   */
  if (actor.status !== 'active') return deny('actor.inactive')

  const papeis = PERMITIDO[capability]
  if (!papeis) return deny('capability.unknown')

  return papeis.includes(actor.role) ? allow() : deny(`${capability}.denied`)
}

/** Acucar para os pontos que so querem saber se pode. */
export function isAllowed(actor: PolicyActor, capability: Capability): boolean {
  return can(actor, capability).allowed
}
