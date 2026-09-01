/**
 * Read models do portal.
 *
 * NAO sao entidades de dominio. Sao exatamente o que cada tela precisa ler,
 * ja resolvido e ja em pt-BR quando o texto for de produto. As entidades de
 * dominio nascem na fase de cada dominio (docs/architecture.md).
 *
 * O contrato e este arquivo. Hoje `src/lib/data/portal.ts` o preenche a partir
 * de `src/mocks/`; na FASE 5+ passa a preencher a partir de repositories sobre
 * o Supabase. Nenhum componente muda:
 *
 *     MOCK  →  DATA LAYER (este contrato)  →  SUPABASE
 */
import type {
  ContentChannel,
  ContentFormat,
  ContentStatus,
  FileCategory,
  MeetingType,
  ProjectType,
  StageState,
} from '@/config/enums'

export interface ProjectSummary {
  id: string
  clientName: string
  name: string
  type: ProjectType
  /** Ciclo editorial corrente. A jornada e ciclica (docs/product.md). */
  cycle: number
  startedOn: string
  scope: string[]
  team: { name: string; role: string }[]
}

export interface JourneyStage {
  key: string
  label: string
  state: StageState
  /** Uma linha explicando o que acontece nesta etapa. Visivel ao cliente. */
  summary: string
  completedOn?: string
}

/** O bloco mais importante do dashboard: o que depende do cliente. */
export interface AttentionItem {
  id: string
  kind: 'content' | 'strategy' | 'onboarding'
  count: number
  label: string
  href: string
  cta: string
}

export interface Delivery {
  title: string
  description: string
  dueOn: string
}

export interface Meeting {
  id: string
  type: MeetingType
  title: string
  description?: string
  startAt: string
  durationMinutes: number
  status: 'scheduled' | 'completed' | 'cancelled'
  url?: string
}

/** O diferencial da Boop: nao so execucao, aprendizado continuo. */
export interface Insight {
  id: string
  headline: string
  detail: string
  /** De onde veio a leitura. Da credibilidade ao insight. */
  evidence?: string
}

export interface ContentVersionSummary {
  version: number
  hook: string
  caption: string
  cta: string
  createdOn: string
}

export interface ContentItem {
  id: string
  reference: string
  title: string
  channel: ContentChannel
  format: ContentFormat
  status: ContentStatus
  objective: string
  territory: string
  scheduledFor?: string
  currentVersion: ContentVersionSummary
  versionCount: number
  /** Tom da arte, usado para compor o preview enquanto nao ha midia real. */
  previewTone: 'navy' | 'slate' | 'sky' | 'bone'
  comments: ContentComment[]
}

export interface ContentComment {
  id: string
  author: string
  authorSide: 'boop' | 'client'
  body: string
  createdOn: string
}

export interface StrategyChapter {
  number: string
  title: string
  lead: string
  body: string[]
  /** Itens curtos: territorios, series, experimentos, metricas. */
  items?: { label: string; description: string }[]
}

export interface Strategy {
  clientName: string
  title: string
  period: string
  version: number
  status: 'awaiting_client' | 'approved' | 'changes_requested'
  chapters: StrategyChapter[]
}

export interface OnboardingQuestion {
  key: string
  label: string
  help?: string
  type: 'short_text' | 'long_text' | 'single_select' | 'multi_select' | 'url'
  options?: string[]
  placeholder?: string
}

export interface OnboardingSection {
  key: string
  index: number
  title: string
  /** A fala que abre a secao. E o que torna o onboarding conversacional. */
  lead: string
  questions: OnboardingQuestion[]
}

export interface MetricReading {
  key: string
  value: string
  label: string
  delta?: string
}

export interface ResultsPeriod {
  period: string
  metrics: MetricReading[]
  whatHappened: string
  whatWorked: { title: string; detail: string }[]
  whatDidNot: { title: string; detail: string }[]
  learnings: Insight[]
  whatChanges: string[]
}

export interface ProjectFile {
  id: string
  name: string
  category: FileCategory
  kind: string
  sizeLabel: string
  addedOn: string
}
