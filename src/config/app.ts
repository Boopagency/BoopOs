/**
 * Constantes de produto. Nenhuma string fundamental duplicada pelo codigo.
 * Ver docs/product.md.
 */
export const APP = {
  name: 'BOOP OS',
  shortName: 'Boop',
  description:
    'A plataforma da Boop: acompanhe estrategia, conteudo, aprovacoes e resultados da sua marca em um so lugar.',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',
} as const

/**
 * Navegacao do portal do cliente — sete itens (docs/product.md).
 * Os href definitivos passam a incluir o projectId na FASE 6.
 */
export const PORTAL_NAV = [
  { key: 'home', label: 'Inicio' },
  { key: 'project', label: 'Projeto' },
  { key: 'content', label: 'Conteudo' },
  { key: 'strategy', label: 'Estrategia' },
  { key: 'files', label: 'Arquivos' },
  { key: 'results', label: 'Resultados' },
  { key: 'meetings', label: 'Encontros' },
] as const

export type PortalNavKey = (typeof PORTAL_NAV)[number]['key']
