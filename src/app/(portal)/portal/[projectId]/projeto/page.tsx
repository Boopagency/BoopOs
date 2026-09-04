import type { Metadata } from 'next'
import { WorkspaceColumns } from '@/components/layout/context-rail'
import { CurrentStage } from '@/components/patterns/current-stage'
import { ProjectContext } from '@/components/patterns/project-context'
import { ProjectJourney } from '@/components/patterns/project-journey'
import { SectionHeading } from '@/components/patterns/section-heading'
import { getClientPublic } from '@/domains/clients/queries'
import { currentStage, journeyState } from '@/domains/projects/journey'
import {
  getPortalJourney,
  listClientTeam,
  requireVisiblePortalProject,
} from '@/domains/projects/queries'
import { formatFullDate } from '@/lib/format'

export const metadata: Metadata = { title: 'Projeto' }

/*
 * A página do projeto responde "onde estamos e o que vem" — em profundidade.
 *
 * ## Ela deixou de ser uma segunda Home (D-29)
 *
 * Até a FASE 8 esta tela repetia a jornada da Home, repetia a próxima entrega e
 * listava encontros passados. Duas telas respondendo a mesma pergunta é uma
 * decisão em forma de sistema — um módulo por entidade —, não em forma de
 * produto. Agora a Home mostra três etapas e um ponteiro; aqui está a jornada
 * inteira, com o resumo de cada etapa.
 *
 * ## O que saiu, e por quê
 *
 * "Próxima entrega" não tem origem em lugar nenhum do schema — é irmã do
 * `project.scope` que a FASE 6 cortou (D-16). "Encontros que já aconteceram"
 * vinha de mock, e `meetings` só existe a partir da FASE 13.
 *
 * ## O que esta página nunca mostra
 *
 * Activity log, em nenhuma forma: nem direto, nem agregado, nem traduzido para
 * linguagem de cliente. Ele é bastidor da Boop, e `listRecentActivityForBoop()`
 * começa com `requireBoop()` justamente por isso. Se um dia quisermos uma linha
 * do tempo para o cliente, ela será superfície própria, com contrato
 * client-facing explícito e origem própria — nunca uma projeção do log (D-30).
 *
 * ## "Quem está no projeto" é real, e mudou de coluna na FASE 8.5
 *
 * Vem de `client_memberships` cruzado com `profiles`: as pessoas da Boop com
 * vínculo EXPLÍCITO neste cliente. Sem cargo — a V0 não guarda cargo, e
 * transformar `boop_member` em "Estrategista" seria escrever ficção na tela do
 * cliente. Sem ninguém vinculado, o bloco some.
 *
 * O que mudou é o LUGAR: era uma seção no meio da leitura, e virou a rail de
 * contexto. Equipe responde "com quem eu falo", e essa pergunta acompanha a
 * página inteira em vez de interromper a jornada no meio. **Migrou, não foi
 * duplicado** — a mesma lista em dois lugares seria a mesma informação
 * competindo consigo mesma (ADR-0027).
 */
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params

  const project = await requireVisiblePortalProject(projectId)

  const [client, stages, team] = await Promise.all([
    getClientPublic(project.clientId),
    getPortalJourney(projectId),
    listClientTeam(project.clientId),
  ])

  const stage = currentStage(stages)

  /*
   * "Quem está no projeto" MIGROU para a rail — não foi duplicado. Equipe é
   * contexto, não conteúdo, e contexto é exatamente o que a coluna da direita
   * existe para carregar. A data de início continua na linha de cabeçalho
   * abaixo, então a rail não a repete.
   */
  return (
    <WorkspaceColumns rail={team.length > 0 ? <ProjectContext team={team} /> : null}>
      <section className="content py-12 md:py-16">
        <p className="t-meta text-muted">
          {client.name}
          {/* `starts_on` é nullable: sem data combinada, a linha não a menciona. */}
          {project.startedOn && ` · desde ${formatFullDate(project.startedOn)}`}
        </p>
        <h1 className="t-display text-foreground mt-5 max-w-[12ch]">{project.name}</h1>
      </section>

      <div className="border-rule border-t">
        <CurrentStage
          cycle={project.cycle}
          stage={stage}
          state={journeyState(stages)}
          summary={stage?.summary ?? null}
        />
      </div>

      {stages.length > 0 && (
        <section aria-labelledby="jornada-completa" className="content py-14 md:py-20">
          <SectionHeading
            eyebrow={`Ciclo ${project.cycle}`}
            title="A jornada"
            lead="Cada etapa tem começo, fim e uma entrega. Quando o ciclo fecha, produção, publicação e review recomeçam."
          />
          <h2 id="jornada-completa" className="sr-only">
            Etapas do projeto
          </h2>
          <ProjectJourney stages={stages} detailed className="mt-12 md:mt-16" />
        </section>
      )}
    </WorkspaceColumns>
  )
}
