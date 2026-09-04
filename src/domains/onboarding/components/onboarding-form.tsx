'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { messageFor } from '@/config/messages'
import { saveOnboardingAnswerAction, submitOnboardingAction } from '@/domains/onboarding/actions'
import { isAnswerPresent, isRenderableType, missingRequired } from '@/domains/onboarding/answers'
import type {
  AnswerValue,
  OnboardingAnswer,
  OnboardingQuestion,
  OnboardingSection,
} from '@/domains/onboarding/types'
import { padded } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * O onboarding, agora com banco atrás.
 *
 * A forma editorial é a mesma do protótipo da FASE 1.5 — uma seção por vez,
 * paginação "02 / 06" em vez de barrinha, a fala que abre a seção — porque ela
 * está certa. O que mudou é tudo o que estava faltando: as perguntas vêm do
 * template, as respostas são gravadas, e "Finalizar" é uma transação.
 *
 * ## O autosave, e por que ele tem três gatilhos
 *
 * Um debounce sozinho perde resposta em dois momentos reais, e os dois
 * acontecem no celular:
 *
 *   1. a pessoa digita e toca "Continuar" antes do debounce vencer;
 *   2. a pessoa digita e sai do campo para outro app.
 *
 * Por isso: **debounce** enquanto digita, **blur** ao sair do campo, e um
 * **flush** obrigatório antes de trocar de seção ou enviar. As três escrevem a
 * mesma fila (`pendentes`), e a fila é por PERGUNTA — o `upsert` em
 * `(submission_id, question_id)` torna repetir inofensivo.
 *
 * Não há `beforeunload`: ele é o gatilho menos confiável de todos (o iOS
 * ignora em boa parte dos casos), e desenhar a confiabilidade em cima dele
 * seria trocar três garantias por um diálogo que às vezes aparece. O que
 * protege quem fecha o navegador é o debounce curto e o blur.
 *
 * ## Falha de gravação não vira sucesso
 *
 * Uma resposta que falhou volta para a fila e o rótulo diz "Erro ao salvar".
 * Enviar chama o flush primeiro: se ele não conseguir gravar, o envio **não
 * acontece** — mandar uma submissão sabendo que uma resposta ficou para trás
 * seria a forma mais cara de perder dado nesta tela.
 */

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

/** Curto o bastante para não perder nada, longo o bastante para não gaguejar. */
const DEBOUNCE_MS = 700

function initialAnswerMap(answers: readonly OnboardingAnswer[]): Record<string, AnswerValue> {
  const map: Record<string, AnswerValue> = {}
  for (const answer of answers) map[answer.questionId] = answer.value
  return map
}

/**
 * A seção onde a pessoa parou.
 *
 * Derivado das RESPOSTAS, e não de uma coluna `current_section` — que seria
 * estado de navegação virando estado de banco, e ficaria errado no dia em que
 * o template mudasse de tamanho.
 *
 * Três regras, nesta ordem, e a ordem é o que faz a retomada parecer certa:
 *
 *   1. a primeira seção com OBRIGATÓRIA faltando — é o que impede o envio, e
 *      portanto é onde o trabalho está;
 *   2. senão, a primeira seção em que nada foi respondido — a pessoa ainda não
 *      chegou lá;
 *   3. senão, a última — está tudo respondido, e o que falta é enviar.
 *
 * A regra 1 olha só obrigatórias de propósito: pular uma opcional é uma
 * escolha, e voltar a pessoa para ela seria tratá-la como pendência.
 */
function resumeIndex(
  sections: readonly OnboardingSection[],
  answers: Record<string, AnswerValue>,
): number {
  if (Object.keys(answers).length === 0) return 0

  const obrigatoriaFaltando = sections.findIndex((section) =>
    section.questions.some(
      (question) =>
        question.required &&
        isRenderableType(question.type) &&
        !isAnswerPresent(question.type, answers[question.id]),
    ),
  )
  if (obrigatoriaFaltando !== -1) return obrigatoriaFaltando

  const intocada = sections.findIndex((section) =>
    section.questions.every((question) => answers[question.id] === undefined),
  )
  if (intocada !== -1) return intocada

  return sections.length - 1
}

export function OnboardingForm({
  projectId,
  sections,
  answers: initial,
}: {
  projectId: string
  sections: OnboardingSection[]
  answers: OnboardingAnswer[]
}) {
  const [answers, setAnswers] = useState(() => initialAnswerMap(initial))
  const [index, setIndex] = useState(() => resumeIndex(sections, initialAnswerMap(initial)))
  const [save, setSave] = useState<SaveState>('idle')
  const [saveCode, setSaveCode] = useState<string | undefined>(undefined)
  const [faltando, setFaltando] = useState<string[]>([])
  const [submitCode, setSubmitCode] = useState<string | undefined>(undefined)
  const [enviando, setEnviando] = useState(false)

  const pendentes = useRef(new Map<string, AnswerValue>())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /*
   * O flush em andamento, e se o último falhou. São `ref` e não estado, e a
   * razão é um bug real:
   *
   * clicar em "Enviar" tira o foco do campo, então o `blur` dispara um flush
   * ANTES do flush do envio. O segundo encontrava a fila já esvaziada pelo
   * primeiro — que ainda estava no ar — e concluía "não há nada pendente, pode
   * enviar", com `save` ainda em `idle` porque o `setSave('error')` do primeiro
   * não tinha acontecido. A submissão saía com uma resposta que nunca gravou.
   *
   * `emVoo` encadeia os flushes (o segundo espera o primeiro), e `falhou`
   * responde sobre a última tentativa sem depender de um `setState` que talvez
   * ainda não tenha sido aplicado.
   */
  const emVoo = useRef<Promise<boolean> | null>(null)
  const falhou = useRef(false)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  /** Grava tudo o que está na fila. Devolve `false` se alguma falhou. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }

    const anterior = emVoo.current

    const corrente = (async (): Promise<boolean> => {
      if (anterior) await anterior

      const lote = [...pendentes.current.entries()]
      if (lote.length === 0) return !falhou.current

      pendentes.current.clear()
      setSave('saving')

      const resultados = await Promise.all(
        lote.map(([questionId, value]) =>
          saveOnboardingAnswerAction({ projectId, questionId, value }),
        ),
      )

      const falha = resultados.find((resultado) => resultado.status === 'error')

      if (falha) {
        /* De volta para a fila: o próximo gatilho tenta de novo. Só não
         * sobrescreve o que a pessoa digitou depois. */
        for (const [questionId, value] of lote) {
          if (!pendentes.current.has(questionId)) pendentes.current.set(questionId, value)
        }
        falhou.current = true
        setSave('error')
        setSaveCode(falha.code)
        return false
      }

      falhou.current = false
      setSave('saved')
      setSaveCode(undefined)
      return true
    })()

    emVoo.current = corrente

    try {
      return await corrente
    } finally {
      if (emVoo.current === corrente) emVoo.current = null
    }
  }, [projectId])

  function alterar(question: OnboardingQuestion, value: AnswerValue) {
    setAnswers((anterior) => ({ ...anterior, [question.id]: value }))
    setFaltando((anterior) => anterior.filter((id) => id !== question.id))
    pendentes.current.set(question.id, value)

    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), DEBOUNCE_MS)
  }

  function irPara(proximo: number) {
    void flush()
    setIndex(proximo)
  }

  const perguntasRenderizaveis = sections.flatMap((section) =>
    section.questions.filter((question) => isRenderableType(question.type)),
  )

  async function enviar() {
    setSubmitCode(undefined)
    setEnviando(true)

    try {
      const gravou = await flush()
      if (!gravou) return

      const pendentesObrigatorias = missingRequired(perguntasRenderizaveis, answers)

      if (pendentesObrigatorias.length > 0) {
        setFaltando(pendentesObrigatorias.map((question) => question.id))
        setSubmitCode('onboarding.required_missing')

        /* Leva a pessoa até a PRIMEIRA que falta — e não até a última, que é
         * onde um `findLast` a deixaria. */
        const primeira = pendentesObrigatorias[0]
        const secao = sections.findIndex((section) =>
          section.questions.some((question) => question.id === primeira?.id),
        )
        if (secao !== -1) setIndex(secao)
        return
      }

      const dados = new FormData()
      dados.set('projectId', projectId)
      const resultado = await submitOnboardingAction({ status: 'idle' }, dados)

      if (resultado.status === 'error') setSubmitCode(resultado.code)
      /* Sucesso não é tratado aqui: a action revalida, o servidor devolve a
       * página com `state = 'submitted'`, e quem mostra "Recebemos tudo" é o
       * banco — não um `useState` que acha que enviou. */
    } finally {
      setEnviando(false)
    }
  }

  const section = sections[index]
  if (!section) return null

  const total = sections.length
  const primeira = index === 0
  const ultima = index === total - 1

  return (
    <div className="content py-12 md:py-20">
      {/* Progresso: paginacao editorial, nao barrinha. */}
      <div className="flex items-center justify-between gap-6">
        <p className="t-meta text-muted" data-numeric>
          <span className="text-foreground">{padded(index + 1)}</span> / {padded(total)}
        </p>
        <ol className="flex gap-1.5" aria-label={`Seção ${index + 1} de ${total}`}>
          {sections.map((entry, i) => (
            <li
              key={entry.key}
              aria-current={i === index ? 'step' : undefined}
              className={cn(
                'h-1 w-7 rounded-sm transition-colors duration-(--motion-default)',
                i < index ? 'bg-navy' : i === index ? 'bg-accent' : 'bg-rule-strong/40',
              )}
            >
              <span className="sr-only">{entry.title}</span>
            </li>
          ))}
        </ol>
      </div>

      {/*
        O título da seção é o `h1` da página: é o que responde "onde estou" para
        quem navega por cabeçalho. A fala de abertura vem depois, como texto —
        ela conversa, não titula.
      */}
      <div key={section.key} className="mt-14 md:mt-20">
        <h1 className="t-meta rise rise-1 text-muted">{section.title}</h1>
        {section.lead && (
          <p className="t-section rise rise-2 measure text-foreground mt-5">{section.lead}</p>
        )}

        <div className="rise rise-3 mt-12 max-w-2xl space-y-10">
          {section.questions.map((question) => (
            <QuestionField
              key={question.id}
              question={question}
              value={answers[question.id]}
              missing={faltando.includes(question.id)}
              onChange={(value) => alterar(question, value)}
              onFlush={() => void flush()}
            />
          ))}
        </div>
      </div>

      <div className="border-rule mt-14 border-t pt-8">
        <div className="flex flex-wrap items-center gap-4">
          {ultima ? (
            <Button
              size="lg"
              onClick={() => void enviar()}
              disabled={enviando}
              className="max-sm:w-full"
            >
              {enviando ? 'Enviando…' : 'Enviar respostas'}
            </Button>
          ) : (
            <Button size="lg" onClick={() => irPara(index + 1)} className="max-sm:w-full">
              Continuar →
            </Button>
          )}

          {!primeira && (
            <Button variant="quiet" onClick={() => irPara(index - 1)}>
              Voltar
            </Button>
          )}

          <SaveIndicator state={save} {...(saveCode ? { code: saveCode } : {})} />
        </div>

        {submitCode && (
          <p className="t-label text-danger mt-5" role="alert">
            {messageFor(submitCode)}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * O retorno do autosave: discreto, no canto, e nunca um toast por tecla.
 *
 * `aria-live="polite"` para quem não vê a mudança de rótulo; `polite` e não
 * `assertive` porque isto não interrompe nada — a pessoa está escrevendo.
 */
function SaveIndicator({ state, code }: { state: SaveState; code?: string }) {
  const texto =
    state === 'saving'
      ? 'Salvando…'
      : state === 'saved'
        ? 'Salvo'
        : state === 'error'
          ? code
            ? messageFor(code)
            : 'Erro ao salvar'
          : 'Suas respostas salvam sozinhas'

  return (
    <p
      aria-live="polite"
      className={cn(
        't-label ml-auto max-sm:ml-0 max-sm:w-full',
        state === 'error' ? 'text-danger' : 'text-muted',
      )}
    >
      {texto}
    </p>
  )
}

/** Um controle por tipo de pergunta. Alvo de toque nunca menor que 44px. */
function QuestionField({
  question,
  value,
  missing,
  onChange,
  onFlush,
}: {
  question: OnboardingQuestion
  value: AnswerValue | undefined
  missing: boolean
  onChange: (value: AnswerValue) => void
  onFlush: () => void
}) {
  const erro = missing ? 'Esta resposta é obrigatória.' : undefined

  /*
   * `file` (FASE 12) e qualquer tipo que o banco ganhe antes da tela: a
   * pergunta aparece, marcada como indisponível. Um input falso que não sobe
   * arquivo nenhum seria pior do que dizer a verdade.
   */
  if (!isRenderableType(question.type)) {
    return (
      <Field label={question.label} {...(question.help ? { help: question.help } : {})}>
        {() => (
          <p className="border-rule text-muted t-label border-l-2 py-1 pl-4">
            Esta pergunta ainda não pode ser respondida por aqui. A equipe vai combinar com você.
          </p>
        )}
      </Field>
    )
  }

  const agrupado =
    question.type === 'single_select' ||
    question.type === 'multi_select' ||
    question.type === 'boolean'

  return (
    <Field
      label={question.label}
      required={question.required}
      group={agrupado}
      {...(question.help ? { help: question.help } : {})}
      {...(erro ? { error: erro } : {})}
    >
      {({ id, describedBy, invalid }) => {
        if (question.type === 'long_text') {
          return (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              rows={5}
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => onChange(event.target.value)}
              onBlur={onFlush}
            />
          )
        }

        if (question.type === 'number') {
          return (
            <Input
              id={id}
              type="number"
              inputMode="decimal"
              aria-describedby={describedBy}
              aria-invalid={invalid}
              value={typeof value === 'number' ? String(value) : ''}
              onChange={(event) => {
                const numero = Number(event.target.value)
                /* Campo esvaziado vira `""`, e `Number('')` é 0 — que seria uma
                 * resposta que ninguém deu. */
                onChange(event.target.value === '' || !Number.isFinite(numero) ? '' : numero)
              }}
              onBlur={onFlush}
            />
          )
        }

        if (question.type === 'boolean') {
          return (
            <Choices
              describedBy={describedBy}
              options={[
                { label: 'Sim', value: true },
                { label: 'Não', value: false },
              ]}
              selected={(option) => value === option}
              onPick={(option) => {
                onChange(option)
                onFlush()
              }}
            />
          )
        }

        if (question.type === 'single_select') {
          return (
            <Choices
              describedBy={describedBy}
              options={question.options.map((option) => ({ label: option, value: option }))}
              selected={(option) => value === option}
              onPick={(option) => {
                onChange(option)
                onFlush()
              }}
            />
          )
        }

        if (question.type === 'multi_select') {
          const marcadas = Array.isArray(value) ? value : []
          return (
            <Choices
              describedBy={describedBy}
              options={question.options.map((option) => ({ label: option, value: option }))}
              selected={(option) => marcadas.includes(option)}
              onPick={(option) => {
                onChange(
                  marcadas.includes(option)
                    ? marcadas.filter((entry) => entry !== option)
                    : [...marcadas, option],
                )
                onFlush()
              }}
            />
          )
        }

        return (
          <Input
            id={id}
            type={question.type === 'url' ? 'url' : 'text'}
            inputMode={question.type === 'url' ? 'url' : undefined}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onFlush}
          />
        )
      }}
    </Field>
  )
}

/**
 * Grupo de botões de escolha. Serve a `single_select`, `multi_select` e
 * `boolean` — os três são "escolha entre alternativas visíveis", e um `select`
 * nativo esconderia o que existe para escolher.
 *
 * 48px de altura: acima dos 44px mínimos, e confortável com o polegar.
 */
function Choices<T extends string | boolean>({
  describedBy,
  options,
  selected,
  onPick,
}: {
  describedBy: string | undefined
  options: { label: string; value: T }[]
  selected: (value: T) => boolean
  onPick: (value: T) => void
}) {
  return (
    <div aria-describedby={describedBy} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const marcada = selected(option.value)
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={marcada}
            onClick={() => onPick(option.value)}
            className={cn(
              't-label h-12 rounded-sm border px-4 transition-colors duration-(--motion-fast)',
              marcada
                ? 'border-navy bg-navy text-on-inverse'
                : 'border-rule-strong text-foreground hover:border-muted',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
