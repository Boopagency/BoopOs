import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/layout/container'
import { SectionHeading } from '@/components/patterns/section-heading'
import { PROJECT_TYPE_LABEL } from '@/config/enums'
import { getClientPublic } from '@/domains/clients/queries'
import { updateProjectAction } from '@/domains/projects/actions'
import { JourneyControls } from '@/domains/projects/components/journey-controls'
import { ProjectForm } from '@/domains/projects/components/project-form'
import { ProjectStatusControls } from '@/domains/projects/components/project-status-controls'
import { ProjectStatusMark } from '@/domains/projects/components/project-status-mark'
import { getProjectDetailForBoop, getProjectStagesForBoop } from '@/domains/projects/queries'
import { requireBoop } from '@/lib/auth/authorization'
import { can } from '@/lib/auth/policy'
import { formatDateTime } from '@/lib/format'

type Params = { params: Promise<{ projectId: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { projectId } = await params
  const project = await getProjectDetailForBoop(projectId)
  return { title: project.name }
}

/**
 * Detalhe do projeto, do lado da Boop. É a tela onde a jornada se move.
 *
 * ## O id da URL é endereço, nunca prova
 *
 * `getProjectDetailForBoop()` chama `requireBoop()` e `requireProjectAccess()`,
 * que pergunta ao banco tentando ler a linha. Trocar o uuid dá 404, igual a um
 * uuid inventado — inexistente e inalcançável têm a MESMA resposta.
 *
 * ## Três blocos, e a ordem é a das perguntas
 *
 *   1. **Jornada** — "onde estamos?". É o que se abre a tela para ver e é o que
 *      se vem mudar; por isso vem antes dos dados cadastrais.
 *   2. **Dados** — nome e período.
 *   3. **Status** — o eixo independente da jornada (I-01). Um projeto pausado
 *      está pausado EM alguma etapa; as duas coisas não se misturam, e as duas
 *      seções também não.
 *
 * ## O que NÃO está aqui
 *
 * Onboarding, estratégia, conteúdo, arquivos, resultados. São FASE 7 em diante.
 * Nenhum bloco vazio e nenhum "em breve".
 */
export default async function AdminProjectPage({ params }: Params) {
  const { projectId } = await params

  const [actor, project] = await Promise.all([requireBoop(), getProjectDetailForBoop(projectId)])
  const [client, stages] = await Promise.all([
    getClientPublic(project.clientId),
    getProjectStagesForBoop(projectId),
  ])

  const canManageJourney = can(actor, 'project.advance_stage').allowed
  const canChangeStatus = can(actor, 'project.change_status').allowed
  const canEdit = can(actor, 'project.update').allowed

  return (
    <Container>
      <Link
        href={`/admin/clientes/${project.clientId}`}
        className="t-meta text-muted hover:text-foreground inline-flex items-center gap-2"
      >
        <span aria-hidden="true">←</span> {client.name}
      </Link>

      <SectionHeading
        as="h1"
        eyebrow={`${PROJECT_TYPE_LABEL[project.type]} · Ciclo ${project.cycle}`}
        title={project.name}
        className="mt-8"
        action={<ProjectStatusMark status={project.status} />}
      />

      <p className="t-label text-muted mt-6">
        Criado em {formatDateTime(project.createdAt)} · atualizado em{' '}
        {formatDateTime(project.updatedAt)}
      </p>

      <div className="mt-16 space-y-16">
        <section aria-labelledby="jornada">
          <h2 id="jornada" className="t-title text-foreground">
            Jornada
          </h2>
          <p className="t-body text-muted measure mt-3">
            É o que o cliente vê no portal. Avançar fecha a etapa atual e abre a próxima — as duas
            coisas na mesma transação, nunca uma sem a outra.
          </p>
          <div className="mt-8">
            <JourneyControls projectId={project.id} stages={stages} canManage={canManageJourney} />
          </div>
        </section>

        {canEdit && (
          <section aria-labelledby="dados">
            <h2 id="dados" className="t-title text-foreground">
              Dados do projeto
            </h2>
            <div className="mt-8">
              <ProjectForm
                action={updateProjectAction}
                submitLabel="Salvar alterações"
                project={{
                  id: project.id,
                  name: project.name,
                  type: project.type,
                  startedOn: project.startedOn,
                  endsOn: project.endsOn,
                }}
              />
            </div>
          </section>
        )}

        <section aria-labelledby="status">
          <h2 id="status" className="t-title text-foreground">
            Status do projeto
          </h2>
          <p className="t-body text-muted measure mt-3">
            Status e etapa da jornada são eixos independentes: um projeto pausado está pausado em
            alguma etapa, e concluir a jornada não conclui o projeto.
          </p>
          <div className="mt-8">
            <ProjectStatusControls
              projectId={project.id}
              status={project.status}
              canManage={canChangeStatus}
            />
          </div>
        </section>
      </div>
    </Container>
  )
}
