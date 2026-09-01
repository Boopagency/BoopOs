import type { Metadata } from 'next'
import { OnboardingFlow } from '@/components/patterns/onboarding-flow'
import { getOnboarding, getProject } from '@/lib/data/portal'

export const metadata: Metadata = { title: 'Onboarding' }

export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const [sections, project] = await Promise.all([getOnboarding(projectId), getProject(projectId)])

  return (
    <OnboardingFlow sections={sections} clientName={project.clientName} projectId={projectId} />
  )
}
