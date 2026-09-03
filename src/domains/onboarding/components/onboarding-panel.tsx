'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { messageFor } from '@/config/messages'
import { reopenOnboardingAction, startOnboardingAction } from '@/domains/onboarding/actions'
import { isRenderableType } from '@/domains/onboarding/answers'
import type { AnswerValue, OnboardingForBoop } from '@/domains/onboarding/types'
import { IDLE, type ActionState } from '@/lib/workflow/action-state'
import { formatDateTime } from '@/lib/format'

/**
 * O onboarding do lado da Boop: abrir, ler as respostas, reabrir.
 *
 * ## O que ele NÃO é
 *
 * Não é editor de formulário. O template é catálogo de produto, instalado por
 * migration, e uma UI de gestão dele seria o construtor de formulários que
 * `docs/spec-review.md §4` lista como overengineering — a capacidade
 * `onboarding.template.manage` existir não obriga ninguém a construir tela para
 * ela nesta fase.
 *
 * Também não é dashboard novo: é uma seção da página do projeto, ao lado da
 * jornada, que é onde a pergunta "o que sabemos deste cliente?" aparece.
 *
 * ## Quatro estados, quatro telas diferentes
 *
 *   `unsupported`  bloco explicativo curto e nenhuma ação. Não some porque a
 *                  ausência aqui é informação interna: quem abre a página do
 *                  projeto precisa saber que não há formulário para pedir.
 *   `not_started`  ou o botão de abrir, ou a frase que diz o que falta antes —
 *                  avançar a jornada até `onboarding`.
 *   `draft`        respondendo. Mostra o que já veio, e o que ainda não.
 *   `submitted`    tudo, mais quem enviou e quando, mais "Reabrir".
 */
export function OnboardingPanel({
  projectId,
  onboarding,
  canStart,
  canReopen,
}: {
  projectId: string
  onboarding: OnboardingForBoop
  /**
   * Vêm de `can()` no servidor. São conveniência, não segurança: o workflow
   * nega de novo e a função SQL nega em terceiro lugar
   * (docs/permissions.md#onde-a-permissao-e-aplicada).
   */
  canStart: boolean
  canReopen: boolean
}) {
  const [startState, start, startPending] = useActionState(startOnboardingAction, IDLE)
  const [reopenState, reopen, reopenPending] = useActionState(reopenOnboardingAction, IDLE)

  const state: ActionState = reopenState.status !== 'idle' ? reopenState : startState

  const respostas = new Map<string, AnswerValue>(
    onboarding.answers.map((answer) => [answer.questionId, answer.value]),
  )

  const perguntas = onboarding.sections.flatMap((section) => section.questions)
  const respondidas = perguntas.filter((question) => respostas.has(question.id)).length

  return (
    <div className="space-y-8">
      {state.status === 'error' && <Callout tone="danger">{messageFor(state.code)}</Callout>}
      {state.status === 'success' && state.message && (
        <Callout tone="success">{state.message}</Callout>
      )}

      {onboarding.state === 'unsupported' && (
        <p className="t-body text-muted measure">
          A jornada deste projeto não tem a etapa Onboarding, então não há formulário para abrir. O
          que a equipe precisa saber é combinado direto com o cliente.
        </p>
      )}

      {onboarding.state === 'not_started' &&
        (onboarding.currentStageKey === 'onboarding' ? (
          <div className="flex flex-wrap items-center gap-6">
            <p className="t-body text-muted measure flex-1">
              O formulário ainda não foi aberto. Abrir cria a submissão em rascunho e libera a tela
              para o cliente responder.
            </p>
            {canStart && (
              <form action={start}>
                <input type="hidden" name="projectId" value={projectId} />
                <Button type="submit" disabled={startPending}>
                  {startPending ? 'Abrindo…' : 'Abrir onboarding'}
                </Button>
              </form>
            )}
          </div>
        ) : (
          <Callout tone="warning">
            Avance o projeto para a etapa Onboarding para abrir o formulário. O onboarding só é
            aberto na etapa dele — assim o envio fecha a etapa certa.
          </Callout>
        ))}

      {onboarding.submission && (
        <>
          <div className="border-rule flex flex-wrap items-end justify-between gap-6 border-b pb-6">
            <div>
              <p className="t-meta text-muted">
                {onboarding.state === 'submitted' ? 'Enviado' : 'Em preenchimento'}
              </p>
              <p className="t-title text-foreground mt-2">
                {respondidas} de {perguntas.length} perguntas respondidas
              </p>
              <p className="t-label text-muted mt-1">
                {onboarding.state === 'submitted' && onboarding.submission.submittedOn
                  ? `${formatDateTime(onboarding.submission.submittedOn)}${
                      onboarding.submittedByName ? ` · ${onboarding.submittedByName}` : ''
                    }`
                  : onboarding.submission.startedOn
                    ? `Aberto em ${formatDateTime(onboarding.submission.startedOn)}`
                    : 'Aberto'}
              </p>
            </div>

            {canReopen && onboarding.state === 'submitted' && (
              <form action={reopen}>
                <input type="hidden" name="projectId" value={projectId} />
                <Button type="submit" variant="outline" disabled={reopenPending}>
                  {reopenPending ? 'Reabrindo…' : 'Reabrir onboarding'}
                </Button>
              </form>
            )}
          </div>

          <Answers sections={onboarding.sections} respostas={respostas} />
        </>
      )}
    </div>
  )
}

/**
 * As respostas, para ler.
 *
 * Seção → pergunta → resposta, com o texto do template. Nenhum uuid, nenhum
 * json cru: quem lê isto está tentando entender uma marca, não depurar um
 * banco. Pergunta sem resposta aparece como "sem resposta" e não desaparece —
 * aqui o vazio É a informação: mostra o que ainda falta perguntar de novo.
 */
function Answers({
  sections,
  respostas,
}: {
  sections: OnboardingForBoop['sections']
  respostas: Map<string, AnswerValue>
}) {
  return (
    <div className="space-y-12">
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`secao-${section.id}`}>
          <h3 id={`secao-${section.id}`} className="t-meta text-muted">
            {section.title}
          </h3>

          <dl className="divide-rule border-rule mt-4 divide-y border-t">
            {section.questions.map((question) => (
              <div key={question.id} className="py-5">
                <dt className="t-label text-muted">
                  {question.label}
                  {question.required && <span className="text-danger ml-1">*</span>}
                </dt>
                <dd className="t-body text-foreground measure mt-2 whitespace-pre-wrap">
                  {formatAnswer(question.type, respostas.get(question.id))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

/** O valor em português, e não o jsonb. `false` e `0` são respostas. */
function formatAnswer(type: string, value: AnswerValue | undefined) {
  if (value === undefined) {
    return <span className="text-muted italic">Sem resposta</span>
  }

  if (!isRenderableType(type as never)) {
    return <span className="text-muted italic">Tipo de pergunta ainda não suportado</span>
  }

  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(' · ') : <span className="text-muted italic">Vazio</span>
  }

  return value.trim() === '' ? <span className="text-muted italic">Sem resposta</span> : value
}
