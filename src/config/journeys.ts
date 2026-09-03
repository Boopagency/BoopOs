import { PROJECT_TYPES, type ProjectType } from '@/config/enums'

/**
 * Templates de jornada — o catálogo tipado que a ADR-0006 escolheu em vez de
 * um editor visual.
 *
 * ## As duas metades da jornada
 *
 * O **template** vive aqui, versionado com o código, revisado em PR. A
 * **instância** são linhas em `project_stages`, materializadas na criação do
 * projeto. `projects.journey_key` guarda com qual template o projeto nasceu, e
 * é imutável no banco desde a FASE 6 — trocar o template não pode reescrever
 * as etapas já materializadas.
 *
 * A consequência prática, e é ela que dá segurança para editar este arquivo:
 * mudar um `label` aqui **não** muda nenhum projeto existente, porque `label` é
 * copiado para a linha na criação. O que este arquivo decide é como os projetos
 * FUTUROS nascem.
 *
 * ## O que fica aqui e o que fica no banco
 *
 * | Dado       | Fonte da verdade depois da criação |
 * | ---------- | ---------------------------------- |
 * | ordem      | `project_stages.position`          |
 * | rótulo     | `project_stages.label` (snapshot)  |
 * | estado     | `project_stages.state`             |
 * | **resumo** | **este arquivo**, por `stage_key`  |
 *
 * `summary` é a única coisa que continua vindo do template em tempo de
 * leitura, e por um motivo deliberado: é texto editorial, dirigido ao cliente,
 * e melhorar a redação de uma frase não deveria exigir migration. O preço é
 * que uma `stage_key` histórica precisa continuar existindo aqui — ver
 * `stageSummary()`.
 *
 * ## Chave nova, e não edição de chave
 *
 * Jornada diferente é chave nova (`social.v2`), nunca reescrita de `social.v1`.
 * Chaves antigas permanecem enquanto existir projeto que as use. É o mesmo
 * princípio das migrations: forward-only.
 */

export interface JourneyStageTemplate {
  /** Estável e imutável: é a chave que casa a linha do banco com este texto. */
  key: string
  /** Copiado para `project_stages.label` na criação. Snapshot, não referência. */
  label: string
  /** Uma linha, em pt-BR, visível ao cliente. Lida em tempo de leitura. */
  summary: string
}

export interface JourneyTemplate {
  /** O valor de `projects.journey_key`. Formato `<tipo>.v<n>`. */
  key: string
  /** Para qual `project_type` este template é o padrão. */
  type: ProjectType
  /** Como a jornada se chama para quem administra. Não aparece no portal. */
  label: string
  /** Em ordem. `position` no banco é o índice + 1. */
  stages: readonly JourneyStageTemplate[]
}

/**
 * `social.v1` — a única jornada completa da V0.
 *
 * As oito etapas são as de `docs/product.md#jornada-social-v1`, na ordem de lá.
 * Os mocks do protótipo tinham seis, sem `kickoff` e sem `onboarding`: eram
 * ilustração de tela, não especificação, e a especificação é que vale.
 *
 * A jornada é cíclica — o review reabre `production → publishing → review` para
 * o ciclo seguinte (`projects.cycle`). Quem faz isso é `publishReview`, na
 * FASE 15. A FASE 6 materializa o primeiro ciclo e sabe avançar dentro dele.
 */
const SOCIAL_V1: JourneyTemplate = {
  key: 'social.v1',
  type: 'social',
  label: 'Social media',
  stages: [
    {
      key: 'kickoff',
      label: 'Início do projeto',
      summary: 'Combinamos escopo, ritmo e por onde a gente começa.',
    },
    {
      key: 'onboarding',
      label: 'Onboarding',
      summary: 'Você conta o que só quem está por dentro do negócio sabe.',
    },
    {
      key: 'immersion',
      label: 'Imersão',
      summary: 'Entendemos o negócio, a história e o que a marca quer construir.',
    },
    {
      key: 'research',
      label: 'Pesquisa',
      summary: 'Estudamos a categoria, as concorrentes e como as pessoas compram hoje.',
    },
    {
      key: 'strategy',
      label: 'Estratégia',
      summary: 'Definimos posicionamento, territórios editoriais e o que vamos medir.',
    },
    {
      key: 'production',
      label: 'Produção',
      summary: 'Criamos o ciclo editorial. Parte dele chega para a sua aprovação.',
    },
    {
      key: 'publishing',
      label: 'Publicação',
      summary: 'O que for aprovado entra no ar na ordem combinada.',
    },
    {
      key: 'review',
      label: 'Review',
      summary: 'Olhamos os números juntas e decidimos o que muda no próximo ciclo.',
    },
  ],
}

/**
 * As quatro jornadas mínimas.
 *
 * Elas existem para provar o que a §15 do briefing exige: a arquitetura não
 * depende de social. Um projeto de site nasce com etapas de site, não com
 * "Publicação" e "Review" editorial.
 *
 * São curtas de propósito. `docs/product.md` diz que serão detalhadas "quando
 * houver um projeto real" — inventar dez etapas de branding agora seria
 * escrever ficção que alguém teria de manter. Quatro etapas honestas valem
 * mais do que dez adivinhadas, e a jornada nova é um PR de cinco linhas.
 */
const WEBSITE_V1: JourneyTemplate = {
  key: 'website.v1',
  type: 'website',
  label: 'Site',
  stages: [
    {
      key: 'kickoff',
      label: 'Início do projeto',
      summary: 'Combinamos escopo, prazo e por onde a gente começa.',
    },
    {
      key: 'discovery',
      label: 'Descoberta',
      summary: 'Entendemos o que o site precisa resolver e para quem.',
    },
    {
      key: 'design',
      label: 'Design',
      summary: 'Desenhamos as telas e a forma como a marca aparece nelas.',
    },
    {
      key: 'build',
      label: 'Construção',
      summary: 'Construímos o site e testamos no celular antes de tudo.',
    },
    {
      key: 'launch',
      label: 'Lançamento',
      summary: 'O site entra no ar e acompanhamos os primeiros dias.',
    },
  ],
}

const BRANDING_V1: JourneyTemplate = {
  key: 'branding.v1',
  type: 'branding',
  label: 'Marca',
  stages: [
    {
      key: 'kickoff',
      label: 'Início do projeto',
      summary: 'Combinamos escopo, ritmo e por onde a gente começa.',
    },
    {
      key: 'immersion',
      label: 'Imersão',
      summary: 'Entendemos o negócio, a história e o que a marca quer construir.',
    },
    {
      key: 'positioning',
      label: 'Posicionamento',
      summary: 'Definimos o que a marca defende e onde ela fica na categoria.',
    },
    {
      key: 'identity',
      label: 'Identidade',
      summary: 'Desenhamos como a marca se apresenta e soa.',
    },
    {
      key: 'handover',
      label: 'Entrega',
      summary: 'Você recebe os arquivos e o manual de uso da marca.',
    },
  ],
}

const AUTOMATION_V1: JourneyTemplate = {
  key: 'automation.v1',
  type: 'automation',
  label: 'Automação',
  stages: [
    {
      key: 'kickoff',
      label: 'Início do projeto',
      summary: 'Combinamos escopo e qual processo entra primeiro.',
    },
    {
      key: 'mapping',
      label: 'Mapeamento',
      summary: 'Mapeamos o processo como ele acontece hoje, com quem o executa.',
    },
    {
      key: 'build',
      label: 'Construção',
      summary: 'Construímos a automação e testamos com dados reais.',
    },
    {
      key: 'rollout',
      label: 'Implantação',
      summary: 'A automação entra em uso e acompanhamos as primeiras semanas.',
    },
  ],
}

/**
 * `custom` é a jornada de projeto que ainda não tem forma.
 *
 * Três etapas genéricas, e é o que se pode afirmar sem saber o que o projeto é.
 * Quando um projeto `custom` se repetir, ele ganha template próprio — que é
 * exatamente o gatilho que a ADR-0006 descreve.
 */
const CUSTOM_V1: JourneyTemplate = {
  key: 'custom.v1',
  type: 'custom',
  label: 'Projeto sob medida',
  stages: [
    {
      key: 'kickoff',
      label: 'Início do projeto',
      summary: 'Combinamos escopo, prazo e por onde a gente começa.',
    },
    {
      key: 'execution',
      label: 'Execução',
      summary: 'Tocamos o trabalho combinado e mostramos o andamento aqui.',
    },
    {
      key: 'handover',
      label: 'Entrega',
      summary: 'Você recebe o que foi combinado e fechamos o ciclo.',
    },
  ],
}

/**
 * Todos os templates, indexados por `journey_key`.
 *
 * Chave antiga NUNCA sai daqui enquanto houver projeto que a use: `summary` é
 * lido em tempo de leitura, e remover a chave apagaria o texto da jornada de um
 * projeto vivo. Quando um template for aposentado, ele deixa de ser oferecido
 * na criação (sai de `JOURNEY_BY_TYPE`) e continua nesta tabela.
 */
export const JOURNEY_TEMPLATES: Record<string, JourneyTemplate> = {
  [SOCIAL_V1.key]: SOCIAL_V1,
  [WEBSITE_V1.key]: WEBSITE_V1,
  [BRANDING_V1.key]: BRANDING_V1,
  [AUTOMATION_V1.key]: AUTOMATION_V1,
  [CUSTOM_V1.key]: CUSTOM_V1,
}

/**
 * A jornada com que cada tipo de projeto NASCE hoje.
 *
 * É esta tabela — e não um campo do formulário — que resolve `journey_key`.
 * Quem cria um projeto escolhe o TIPO, que é vocabulário de produto; a chave do
 * template é vocabulário técnico e não aparece na tela (`docs/product.md`).
 *
 * O tipo mapear para exatamente uma chave é o que mantém as duas colunas
 * coerentes. As duas são imutáveis no banco desde a FASE 6, então a coerência
 * decidida aqui, na criação, é a que vale para sempre.
 */
export const JOURNEY_BY_TYPE: Record<ProjectType, string> = {
  social: SOCIAL_V1.key,
  website: WEBSITE_V1.key,
  branding: BRANDING_V1.key,
  automation: AUTOMATION_V1.key,
  custom: CUSTOM_V1.key,
}

/** As chaves que a criação de projeto aceita. Lista fechada, nunca texto livre. */
export const CREATABLE_JOURNEY_KEYS = PROJECT_TYPES.map((type) => JOURNEY_BY_TYPE[type])

/** O template de um tipo de projeto. Usado na criação. */
export function journeyForType(type: ProjectType): JourneyTemplate {
  const template = JOURNEY_TEMPLATES[JOURNEY_BY_TYPE[type]]

  /*
   * Inalcançável: `JOURNEY_BY_TYPE` é `Record<ProjectType, string>` e o teste
   * de paridade confere que toda chave existe em `JOURNEY_TEMPLATES`. O throw
   * está aqui porque o tipo de retorno do índice é `T | undefined` sob
   * `noUncheckedIndexedAccess`, e devolver um template vazio seria pior:
   * criaria projeto sem jornada em silêncio.
   */
  if (!template) throw new Error(`journey template ausente para o tipo ${type}`)

  return template
}

/** O template de uma `journey_key`, ou `null` para chave desconhecida. */
export function journeyByKey(key: string): JourneyTemplate | null {
  return JOURNEY_TEMPLATES[key] ?? null
}

/**
 * O resumo de uma etapa, casando `journey_key` + `stage_key` com o template.
 *
 * **Devolve `null` quando não encontra, e isso é o comportamento correto.**
 *
 * O caso real é um projeto criado com um template que depois foi aposentado, ou
 * uma etapa removida de um template em uso. A tela do cliente não pode quebrar
 * por isso, e também não pode inventar texto: uma frase genérica ("etapa do
 * projeto") ocuparia o lugar de uma explicação e diria menos do que o silêncio.
 * Quem consome omite a linha — bloco vazio desaparece
 * (.claude/rules/frontend.md).
 *
 * A etapa continua com rótulo, posição e estado, que vêm do banco: some o
 * texto de apoio, não a etapa.
 */
export function stageSummary(journeyKey: string, stageKey: string): string | null {
  const template = journeyByKey(journeyKey)
  if (!template) return null

  return template.stages.find((stage) => stage.key === stageKey)?.summary ?? null
}
