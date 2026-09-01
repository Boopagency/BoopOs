import type { ReactNode } from 'react'
import { PortalShell } from '@/components/layout/portal-shell'
import { getProject } from '@/lib/data/portal'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await getProject(projectId)

  return (
    <PortalShell
      projectId={project.id}
      clientName={project.clientName}
      projectName={project.name}
      cycle={project.cycle}
    >
      {children}
    </PortalShell>
  )
}
