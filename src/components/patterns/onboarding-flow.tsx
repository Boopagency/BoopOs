'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BoopEyes } from '@/components/brand/boop-eyes'
import { CloudLayer } from '@/components/brand/cloud-layer'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { portalHref } from '@/config/app'
import type { OnboardingSection } from '@/lib/data/types'
import { padded } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * Onboarding quase conversacional.
 *
 * Uma secao por vez, cada uma abrindo com uma fala e nao com um titulo de
 * formulario. O progresso e "02 / 06" em caixa alta, nao uma barrinha: e a
 * mesma paginacao de um impresso.
 *
 * PROTOTIPO: as respostas ficam so no estado local. O autosave com debounce e
 * o upsert por (submission_id, question_id) chegam na FASE 7 — o modelo ja
 * esta em docs/data-model.md, e e ele que torna o autosave idempotente.
 */
export function OnboardingFlow({
  sections,
  clientName,
  projectId,
}: {
  sections: OnboardingSection[]
  clientName: string
  projectId: string
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)

  const total = sections.length
  const section = sections[index]

  function setAnswer(key: string, value: string) {
    setAnswers((previous) => ({ ...previous, [key]: value }))
  }

  if (done) {
    return (
      <div className="on-emphasis bg-surface-emphasis relative isolate min-h-[70vh] overflow-hidden">
        <CloudLayer density="horizon" className="opacity-40" />
        <div className="content relative flex min-h-[70vh] flex-col justify-center py-20">
          <BoopEyes blink className="fade w-20" />
          <h1 className="t-display rise rise-1 text-cloud mt-10 max-w-[13ch]">Recebemos tudo.</h1>
          <p className="t-lead rise rise-2 text-navy mt-8 max-w-[38ch]">
            Agora é com a gente. A equipe lê tudo antes da imersão, e a próxima etapa do projeto já
            está aberta.
          </p>
          <div className="rise rise-3 mt-12">
            <Link
              href={portalHref(projectId, '')}
              className="t-meta bg-navy text-on-inverse hover:bg-navy/90 inline-flex h-14 items-center rounded-sm px-8 transition-colors max-sm:w-full max-sm:justify-center"
            >
              Ver o projeto
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!section) return null

  const first = index === 0
  const last = index === total - 1

  return (
    <div className="content py-12 md:py-20">
      {/* Progresso: paginacao editorial, nao barrinha. */}
      <div className="flex items-center justify-between gap-6">
        <p className="t-meta text-muted" data-numeric>
          <span className="text-foreground">{padded(section.index)}</span> / {padded(total)}
        </p>
        <ol className="flex gap-1.5" aria-label={`Seção ${section.index} de ${total}`}>
          {sections.map((entry, i) => (
            <li
              key={entry.key}
              aria-current={i === index ? 'step' : undefined}
              className={cn(
                'h-1 w-7 rounded-sm transition-colors duration-[--motion-default]',
                i < index ? 'bg-navy' : i === index ? 'bg-accent' : 'bg-rule-strong/40',
              )}
            >
              <span className="sr-only">{entry.title}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* A fala que abre a secao. */}
      <div key={section.key} className="mt-14 md:mt-20">
        <p className="t-meta rise rise-1 text-muted">{section.title}</p>
        <p className="t-section rise rise-2 measure text-foreground mt-5">
          {section.lead.replace('{cliente}', clientName)}
        </p>

        <div className="rise rise-3 mt-12 max-w-2xl space-y-10">
          {section.questions.map((question) => (
            <Field
              key={question.key}
              label={question.label}
              {...(question.help ? { help: question.help } : {})}
            >
              {({ id, describedBy }) =>
                question.type === 'long_text' ? (
                  <Textarea
                    id={id}
                    aria-describedby={describedBy}
                    rows={5}
                    placeholder={question.placeholder ?? ''}
                    value={answers[question.key] ?? ''}
                    onChange={(event) => setAnswer(question.key, event.target.value)}
                  />
                ) : question.type === 'single_select' ? (
                  <div role="group" aria-describedby={describedBy} className="flex flex-wrap gap-2">
                    {(question.options ?? []).map((option) => {
                      const selected = answers[question.key] === option
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setAnswer(question.key, option)}
                          className={cn(
                            't-label h-12 rounded-sm border px-4 transition-colors duration-[--motion-fast]',
                            selected
                              ? 'border-navy bg-navy text-on-inverse'
                              : 'border-rule-strong text-foreground hover:border-muted',
                          )}
                        >
                          {option}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    type={question.type === 'url' ? 'url' : 'text'}
                    placeholder={question.placeholder ?? ''}
                    value={answers[question.key] ?? ''}
                    onChange={(event) => setAnswer(question.key, event.target.value)}
                  />
                )
              }
            </Field>
          ))}
        </div>
      </div>

      <div className="border-rule mt-14 flex flex-wrap items-center gap-4 border-t pt-8">
        <Button
          size="lg"
          onClick={() => (last ? setDone(true) : setIndex(index + 1))}
          className="max-sm:w-full"
        >
          {last ? 'Finalizar' : 'Continuar →'}
        </Button>

        {!first && (
          <Button variant="quiet" onClick={() => setIndex(index - 1)}>
            Voltar
          </Button>
        )}

        <p className="t-label text-muted ml-auto max-sm:w-full">
          Protótipo: as respostas não são salvas.
        </p>
      </div>
    </div>
  )
}
