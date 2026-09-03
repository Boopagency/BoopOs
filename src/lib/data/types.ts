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

/**
 * O projeto, como o portal precisa dele. Preenchido pelo banco desde a FASE 6.
 *
 * ## Dois campos sairam daqui na FASE 6, e a ausencia e decisao (D-16)
 *
 * `scope: string[]` — "o que combinamos" — **nao tem origem**. Nenhuma coluna
 * do schema o guarda, e `docs/data-model.md` nao o lista nem entre as tabelas
 * adiadas. Enquanto o portal lia mock ele existia como texto ilustrativo; com
 * dado real, mante-lo exigiria inventar o conteudo de um acordo comercial na
 * tela do cliente. O bloco saiu inteiro — bloco sem origem nao aparece.
 *
 * `team` saiu daqui, mas NAO do produto: ele passou a ser carregado a parte,
 * por `listClientTeam()`, porque vem de outra tabela e tem outra fronteira de
 * autorizacao. Compor os dois e papel da tela, nao deste tipo.
 */
export interface ProjectSummary {
  id: string
  clientName: string
  name: string
  type: ProjectType
  /** Ciclo editorial corrente. A jornada e ciclica (docs/product.md). */
  cycle: number
  /**
   * `projects.starts_on` e nullable, e o tipo nao finge o contrario.
   *
   * Um projeto pode ser cadastrado antes de a data de inicio estar combinada.
   * A tela omite a linha quando nao ha data — nunca inventa "hoje" para
   * satisfazer o TypeScript.
   */
  startedOn: string | null
}

export interface JourneyStage {
  key: string
  label: string
  state: StageState
  /**
   * Uma linha explicando o que acontece nesta etapa. Visivel ao cliente.
   *
   * `null` quando a `stage_key` do projeto nao existe mais no template — um
   * projeto criado com uma jornada depois aposentada. A etapa continua com
   * rotulo, posicao e estado, que vem do banco; some so o texto de apoio
   * (`src/config/journeys.ts#stageSummary`).
   */
  summary: string | null
  completedOn?: string | null
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

/*
 * `OnboardingQuestion` e `OnboardingSection` moravam aqui e saíram na FASE 7.
 *
 * Elas descreviam o formulário do PROTÓTIPO — sem `id`, sem `is_required`, com
 * um `placeholder` que o banco não tem e um `type` recortado que omitia
 * `boolean`, `number` e `file`. As formas reais vivem em
 * `src/domains/onboarding/types.ts`, separadas por audiência, como manda a
 * convenção de projeção das FASES 5 e 6.
 */

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
