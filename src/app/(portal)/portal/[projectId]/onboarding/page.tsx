import type { Metadata } from 'next'
import { OnboardingForm } from '@/domains/onboarding/components/onboarding-form'
import {
  OnboardingNotStarted,
  OnboardingSubmitted,
  OnboardingUnsupported,
} from '@/domains/onboarding/components/onboarding-states'
import { getOnboardingForClient } from '@/domains/onboarding/queries'

export const metadata: Metadata = { title: 'Onboarding' }

/**
 * O onboarding do cliente.
 *
 * A autorização NÃO está aqui: ela está no layout de `/portal/[projectId]`,
 * que chama `requireVisiblePortalProject()` e vale para esta página e para
 * todas as irmãs (ADR da FASE 6). `getOnboardingForClient` carrega o mesmo
 * guard de novo, porque loader seguro por tabela — e não por página — é o que
 * sobrevive à próxima tela.
 *
 * O `state` decide, e as quatro respostas são realmente diferentes. Nenhuma
 * delas é 404: quem não deveria estar aqui já parou no layout.
 */
export default async function OnboardingPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const onboarding = await getOnboardingForClient(projectId)

  if (onboarding.state === 'unsupported') return <OnboardingUnsupported projectId={projectId} />
  if (onboarding.state === 'not_started') return <OnboardingNotStarted projectId={projectId} />
  if (onboarding.state === 'submitted') return <OnboardingSubmitted projectId={projectId} />

  return (
    <OnboardingForm
      projectId={projectId}
      sections={onboarding.sections}
      answers={onboarding.answers}
    />
  )
}
