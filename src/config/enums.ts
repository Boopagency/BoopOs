/**
 * Taxonomias canonicas do dominio.
 *
 * Status nunca e string solta no codigo (CLAUDE.md). Este arquivo e a fonte
 * unica em TypeScript; a FASE 2 cria os enums equivalentes no Postgres e um
 * teste de paridade falha se os dois divergirem
 * ([ADR-0003](../../docs/adr/0003-enums-no-postgres.md)).
 *
 * Os valores vem de docs/data-model.md. Acrescentar aqui exige acrescentar la.
 */

export const USER_ROLES = ['boop_admin', 'boop_member', 'client_user'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** Ciclo de vida do acesso. `disabled` derruba a pessoa no request seguinte. */
export const PROFILE_STATUSES = ['invited', 'active', 'disabled'] as const
export type ProfileStatus = (typeof PROFILE_STATUSES)[number]

export const CLIENT_STATUSES = ['active', 'paused', 'archived'] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const PROJECT_TYPES = ['social', 'website', 'branding', 'automation', 'custom'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

export const PROJECT_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const STAGE_STATES = ['pending', 'current', 'done', 'skipped'] as const
export type StageState = (typeof STAGE_STATES)[number]

/**
 * `file` existe no enum desde a primeira migration, mas so e renderizado a
 * partir da FASE 12 (docs/spec-review.md I-05).
 */
export const QUESTION_TYPES = [
  'short_text',
  'long_text',
  'single_select',
  'multi_select',
  'boolean',
  'number',
  'url',
  'file',
] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const ONBOARDING_STATUSES = ['draft', 'submitted'] as const
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number]

export const CONTENT_STATUSES = [
  'idea',
  'planned',
  'in_production',
  'internal_review',
  'awaiting_client',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'archived',
] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

/**
 * O que o cliente pode enxergar. Espelha a policy de RLS descrita em
 * docs/security.md — conteudo em `idea`, `planned`, `in_production` ou
 * `internal_review` nunca alcanca o portal.
 */
export const CLIENT_VISIBLE_CONTENT_STATUSES = [
  'awaiting_client',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
] as const satisfies readonly ContentStatus[]

export function isClientVisible(status: ContentStatus): boolean {
  return (CLIENT_VISIBLE_CONTENT_STATUSES as readonly ContentStatus[]).includes(status)
}

export const CONTENT_CHANNELS = [
  'instagram',
  'linkedin',
  'tiktok',
  'youtube',
  'blog',
  'other',
] as const
export type ContentChannel = (typeof CONTENT_CHANNELS)[number]

export const CONTENT_FORMATS = [
  'reel',
  'carousel',
  'static',
  'story',
  'video',
  'article',
  'other',
] as const
export type ContentFormat = (typeof CONTENT_FORMATS)[number]

export const STRATEGY_VERSION_STATUSES = [
  'draft',
  'awaiting_client',
  'changes_requested',
  'approved',
  'superseded',
] as const
export type StrategyVersionStatus = (typeof STRATEGY_VERSION_STATUSES)[number]

/**
 * Status da VERSAO, distinto do status do item. A aprovacao pertence a versao
 * ([ADR-0007](../../docs/adr/0007-versionamento-e-aprovacao.md)).
 */
export const CONTENT_VERSION_STATUSES = [
  'draft',
  'awaiting_client',
  'changes_requested',
  'approved',
  'superseded',
] as const
export type ContentVersionStatus = (typeof CONTENT_VERSION_STATUSES)[number]

/** Duas decisoes possiveis, e so `client_user` as toma (docs/permissions.md). */
export const APPROVAL_DECISIONS = ['approved', 'changes_requested'] as const
export type ApprovalDecision = (typeof APPROVAL_DECISIONS)[number]

/** Nasce pronto para o feed do cliente (D-05), sem reclassificar historico. */
export const ACTIVITY_VISIBILITIES = ['internal', 'client'] as const
export type ActivityVisibility = (typeof ACTIVITY_VISIBILITIES)[number]

export const NOTIFICATION_STATUSES = ['pending', 'sent', 'failed'] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

export const MEETING_TYPES = ['immersion', 'strategy', 'review', 'checkin', 'other'] as const
export type MeetingType = (typeof MEETING_TYPES)[number]

export const MEETING_STATUSES = ['scheduled', 'completed', 'cancelled'] as const
export type MeetingStatus = (typeof MEETING_STATUSES)[number]

export const FILE_CATEGORIES = ['brand', 'strategy', 'content', 'reference', 'other'] as const
export type FileCategory = (typeof FILE_CATEGORIES)[number]

/* ── Paridade com o Postgres ───────────────────────────────────────────────
 * O contrato do [ADR-0003](../../docs/adr/0003-enums-no-postgres.md), escrito
 * de forma que uma maquina possa conferir: cada chave e um tipo em `pg_enum`,
 * e o valor e a lista exata, na ordem exata. `tests/rls/enums.test.ts` le o
 * banco e compara. Divergiu, quebrou.
 */
export const PG_ENUMS = {
  user_role: USER_ROLES,
  profile_status: PROFILE_STATUSES,
  client_status: CLIENT_STATUSES,
  project_type: PROJECT_TYPES,
  project_status: PROJECT_STATUSES,
  stage_state: STAGE_STATES,
  question_type: QUESTION_TYPES,
  onboarding_status: ONBOARDING_STATUSES,
  strategy_version_status: STRATEGY_VERSION_STATUSES,
  content_channel: CONTENT_CHANNELS,
  content_format: CONTENT_FORMATS,
  content_status: CONTENT_STATUSES,
  content_version_status: CONTENT_VERSION_STATUSES,
  approval_decision: APPROVAL_DECISIONS,
  activity_visibility: ACTIVITY_VISIBILITIES,
  notification_status: NOTIFICATION_STATUSES,
} as const satisfies Record<string, readonly string[]>

/**
 * Taxonomias que existem em TypeScript mas ainda NAO no Postgres: a tabela
 * delas chega na sua fase (arquivos na 12, reunioes na 13). Estao aqui porque
 * o protótipo ja as usa.
 *
 * O teste de paridade exige que continuem ausentes do banco. Quando a
 * migration da FASE 12 criar `file_category`, o teste quebra — e quebrar e o
 * comportamento certo: e o lembrete de mover a chave para `PG_ENUMS` no mesmo
 * PR, em vez de deixar as duas fontes divergirem em silencio.
 */
export const PG_ENUMS_PENDENTES = {
  file_category: FILE_CATEGORIES,
  meeting_type: MEETING_TYPES,
  meeting_status: MEETING_STATUSES,
} as const satisfies Record<string, readonly string[]>

/* ── Rotulos em pt-BR ──────────────────────────────────────────────────────
 * A interface nunca mostra o valor do enum. "Aguardando sua aprovacao", nunca
 * "awaiting_client" (.claude/rules/frontend.md).
 */

export const CLIENT_STATUS_LABEL: Record<ClientStatus, string> = {
  active: 'Ativo',
  paused: 'Pausado',
  archived: 'Arquivado',
}

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  boop_admin: 'Admin Boop',
  boop_member: 'Time Boop',
  client_user: 'Cliente',
}

export const PROFILE_STATUS_LABEL: Record<ProfileStatus, string> = {
  invited: 'Convidada',
  active: 'Ativa',
  disabled: 'Desligada',
}

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: 'Ideia',
  planned: 'Planejado',
  in_production: 'Em produção',
  internal_review: 'Revisão interna',
  awaiting_client: 'Aguardando você',
  changes_requested: 'Ajuste solicitado',
  approved: 'Aprovado',
  scheduled: 'Agendado',
  published: 'Publicado',
  archived: 'Arquivado',
}

export const CONTENT_FORMAT_LABEL: Record<ContentFormat, string> = {
  reel: 'Reel',
  carousel: 'Carrossel',
  static: 'Estático',
  story: 'Story',
  video: 'Vídeo',
  article: 'Artigo',
  other: 'Outro',
}

export const CONTENT_CHANNEL_LABEL: Record<ContentChannel, string> = {
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  blog: 'Blog',
  other: 'Outro',
}

export const FILE_CATEGORY_LABEL: Record<FileCategory, string> = {
  brand: 'Marca',
  strategy: 'Estratégia',
  content: 'Conteúdo',
  reference: 'Referências',
  other: 'Outros',
}

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  immersion: 'Imersão',
  strategy: 'Estratégia',
  review: 'Review mensal',
  checkin: 'Check-in',
  other: 'Encontro',
}
