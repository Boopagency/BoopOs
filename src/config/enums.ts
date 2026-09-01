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

export const PROJECT_TYPES = ['social', 'website', 'branding', 'automation', 'custom'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

export const PROJECT_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const STAGE_STATES = ['pending', 'current', 'done', 'skipped'] as const
export type StageState = (typeof STAGE_STATES)[number]

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

export const MEETING_TYPES = ['immersion', 'strategy', 'review', 'checkin', 'other'] as const
export type MeetingType = (typeof MEETING_TYPES)[number]

export const MEETING_STATUSES = ['scheduled', 'completed', 'cancelled'] as const
export type MeetingStatus = (typeof MEETING_STATUSES)[number]

export const FILE_CATEGORIES = ['brand', 'strategy', 'content', 'reference', 'other'] as const
export type FileCategory = (typeof FILE_CATEGORIES)[number]

/* ── Rotulos em pt-BR ──────────────────────────────────────────────────────
 * A interface nunca mostra o valor do enum. "Aguardando sua aprovacao", nunca
 * "awaiting_client" (.claude/rules/frontend.md).
 */

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
