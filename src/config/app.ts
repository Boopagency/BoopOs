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
 * Navegação do portal — sete itens, e um oitavo exige justificativa escrita
 * (CLAUDE.md).
 *
 * `slug` vazio é a raiz do projeto. Os href são montados a partir do
 * projectId, porque toda rota do portal é escopada por projeto
 * (docs/product.md).
 */
export const PORTAL_NAV = [
  { key: 'home', label: 'Início', slug: '' },
  { key: 'project', label: 'Projeto', slug: 'projeto' },
  { key: 'content', label: 'Conteúdo', slug: 'conteudo' },
  { key: 'strategy', label: 'Estratégia', slug: 'estrategia' },
  { key: 'results', label: 'Resultados', slug: 'resultados' },
  { key: 'meetings', label: 'Encontros', slug: 'encontros' },
  { key: 'files', label: 'Arquivos', slug: 'arquivos' },
] as const

export type PortalNavKey = (typeof PORTAL_NAV)[number]['key']

/**
 * No celular a barra inferior carrega só o que se usa toda semana. O resto
 * vive atrás de "Mais" — sete botões numa barra de 375px seria ilegível, e
 * a alternativa (sidebar) é justamente o que a direção proíbe.
 */
export const MOBILE_PRIMARY: PortalNavKey[] = ['home', 'project', 'content']

export function portalHref(projectId: string, slug: string): string {
  return slug ? `/portal/${projectId}/${slug}` : `/portal/${projectId}`
}
