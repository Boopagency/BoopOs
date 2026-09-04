import type { ProjectType } from '@/config/enums'

/**
 * Constantes de produto. Nenhuma string fundamental duplicada pelo código.
 * Ver docs/product.md.
 */
export const APP = {
  name: 'BOOP OS',
  shortName: 'Boop',
  description:
    'A plataforma da Boop: acompanhe estratégia, conteúdo, aprovações e resultados da sua marca em um só lugar.',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
} as const

/**
 * As seções do portal, e o que decide se elas aparecem.
 *
 * ## A navegação segue o PRODUTO, nunca a contagem de linhas
 *
 * `available` é uma constante em código, alterada por commit de fase. Ela
 * responde "esta funcionalidade existe?", e não "este cliente tem dados?".
 *
 * A diferença é o cliente. Um menu que aparece quando a primeira linha é criada
 * e some quando a última é apagada faz a arquitetura do sistema piscar na cara
 * de quem está tentando só acompanhar o próprio projeto. Quando a FASE 10
 * ligar Conteúdo, ele aparece para todo mundo — inclusive para quem tem zero
 * peças, que vê um estado vazio honesto e continua sabendo onde a seção fica.
 *
 * ## O teto de sete continua valendo
 *
 * Sete chaves, e uma oitava exige justificativa escrita (CLAUDE.md). O que
 * mudou é que o teto deixou de ser piso: hoje duas estão disponíveis, porque
 * duas existem de verdade.
 *
 * O onboarding não está aqui e não vai estar: ele é uma TAREFA, não uma área. É
 * alcançado pelo bloco de atenção e pela etapa da jornada. Uma pendência que
 * vira item de menu deixa de ser pendência e vira lugar.
 */
export interface PortalSection {
  key: PortalNavKey
  label: string
  slug: string
  /** A funcionalidade existe no produto? Muda por fase, nunca por consulta. */
  available: boolean
  /**
   * Tipos de projeto a que a seção se aplica. `null` = todos.
   *
   * Existe para o caso real de uma seção não fazer sentido em um tipo de
   * projeto. Hoje nenhuma usa — e olhar para o TIPO não é olhar para os dados.
   */
  appliesTo: readonly ProjectType[] | null
}

export const PORTAL_SECTIONS: readonly PortalSection[] = [
  { key: 'home', label: 'Início', slug: '', available: true, appliesTo: null },
  { key: 'project', label: 'Projeto', slug: 'projeto', available: true, appliesTo: null },
  /* As rotas abaixo existem e respondem. O que não existe é o domínio. */
  { key: 'strategy', label: 'Estratégia', slug: 'estrategia', available: false, appliesTo: null },
  { key: 'content', label: 'Conteúdo', slug: 'conteudo', available: false, appliesTo: null },
  { key: 'files', label: 'Arquivos', slug: 'arquivos', available: false, appliesTo: null },
  { key: 'meetings', label: 'Encontros', slug: 'encontros', available: false, appliesTo: null },
  { key: 'results', label: 'Resultados', slug: 'resultados', available: false, appliesTo: null },
] as const

export type PortalNavKey =
  'home' | 'project' | 'strategy' | 'content' | 'files' | 'meetings' | 'results'

/** As seções que este projeto realmente mostra. */
export function visibleSections(type: ProjectType): readonly PortalSection[] {
  return PORTAL_SECTIONS.filter(
    (section) =>
      section.available && (section.appliesTo === null || section.appliesTo.includes(type)),
  )
}

/**
 * A barra inferior do celular só se paga com três destinos ou mais.
 *
 * Com dois, ela custa 56px permanentes mais a área de gestos para oferecer UM
 * link que a Home já oferece — e o painel "Mais" não teria o que abrir. Abaixo
 * do limiar, a navegação compacta do cabeçalho vale nos dois breakpoints.
 *
 * O componente continua no repositório, testado, esperando a FASE 9 ou 10.
 */
export const BOTTOM_NAV_THRESHOLD = 3

/**
 * A barra inferior existe para este conjunto de seções?
 *
 * A pergunta é de PRODUTO, então a resposta mora aqui, ao lado do limiar que a
 * define — e não dentro da casca, que só desenha. Até a FASE 8.5 a comparação
 * estava escrita no `portal-shell.tsx`, e um teste lia o código-fonte da casca
 * para conferi-la: a regra certa no arquivo errado (ADR-0027).
 *
 * A FASE 9 liga Estratégia, `sections` chega a três, e a barra acende sozinha —
 * sem ninguém tocar em layout.
 */
export function showsBottomNav(sections: readonly PortalSection[]): boolean {
  return sections.length >= BOTTOM_NAV_THRESHOLD
}

export function portalHref(projectId: string, slug: string): string {
  return slug ? `/portal/${projectId}/${slug}` : `/portal/${projectId}`
}
