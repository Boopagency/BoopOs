import type { ReactNode } from 'react'
import { PortalShell } from '@/components/layout/portal-shell'
import { visibleSections } from '@/config/app'
import { getClientPublic } from '@/domains/clients/queries'
import { listPortalProjects, requireVisiblePortalProject } from '@/domains/projects/queries'

/**
 * A FRONTEIRA DE AUTORIZAÇÃO DO PORTAL.
 *
 * Ela está no layout do grupo, e não em cada página, e essa é a decisão mais
 * importante desta rota: um guard por página é um guard que a próxima página
 * pode esquecer. Aqui, `/portal/[projectId]` e tudo abaixo dela — dashboard,
 * projeto, conteúdo, estratégia, arquivos, resultados, encontros, onboarding —
 * herdam a mesma checagem, e uma rota nova nasce protegida sem ninguém lembrar.
 *
 * `requireVisiblePortalProject()` faz as duas perguntas que o portal precisa:
 *
 *   1. **tenant**       — a RLS devolve esta linha para este JWT?
 *   2. **visibilidade** — este status pode aparecer para este papel? (`draft`
 *                         não existe para o `client_user`, D-18)
 *
 * As três recusas — não existe, não é seu, não está visível — devolvem 404
 * idêntico. Quem troca uuid na barra de endereços não distingue nenhuma delas
 * (docs/security.md).
 *
 * Os loaders de domínio repetem o guard, e a repetição é de propósito: eles
 * precisam ser seguros onde quer que sejam chamados, inclusive de um lugar que
 * ainda não existe. O custo é uma consulta em cache de request (`cache()` do
 * React); o custo de esquecer é um tenant.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params

  const project = await requireVisiblePortalProject(projectId)

  /*
   * O nome do cliente e a lista de projetos são compostos AQUI, e não dentro do
   * guard: o guard responde uma pergunta de segurança, e misturar leitura de
   * domínio nele faria a próxima pessoa "aproveitá-lo" para buscar dado.
   */
  const [client, projects] = await Promise.all([
    getClientPublic(project.clientId),
    listPortalProjects(),
  ])

  return (
    <PortalShell
      projectId={project.id}
      clientName={client.name}
      projectName={project.name}
      /*
       * A navegacao segue o PRODUTO: uma secao aparece quando a funcionalidade
       * existe, e nunca porque uma tabela ganhou a primeira linha. Um menu que
       * pisca conforme os dados faz a arquitetura do sistema aparecer para quem
       * so queria acompanhar o proprio projeto (D-25).
       */
      sections={visibleSections(project.type)}
      /*
       * O seletor só aparece com mais de um projeto — com um só, a complexidade
       * fica invisível (docs/product.md). Não é um oitavo item de navegação: é
       * troca de contexto no cabeçalho, ao lado do que já estava lá.
       */
      projects={projects.map((item) => ({ id: item.id, name: item.name }))}
    >
      {children}
    </PortalShell>
  )
}
