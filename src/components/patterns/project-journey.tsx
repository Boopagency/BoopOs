import { BoopEyes } from '@/components/brand/boop-eyes'
import type { JourneyStage } from '@/lib/data/types'
import { formatDayMonthShort } from '@/lib/format'
import { cn } from '@/lib/cn'

/*
 * A jornada como pedreira, não como barra de progresso.
 *
 * A apresentação da Boop é feita de blocos de mármore em fileira, e a frase
 * da marca é "não construímos coisas genéricas" sobre blocos idênticos. A
 * jornada empresta esse gesto: cada etapa é um bloco.
 *
 *   concluída → bloco cheio, em navy
 *   atual     → bloco em azul da marca, e os olhos olhando para ele
 *   pendente  → só o contorno; a pedra ainda não foi trabalhada
 *
 * Não existe percentual (docs/design-direction.md). "67%" não responde "em que
 * etapa estamos" — o bloco responde.
 *
 * `summary` é opcional e pode ser `null`: um projeto criado com um template
 * depois aposentado perde o texto de apoio, e não a etapa. A linha some; o
 * bloco, o rótulo e o estado continuam (`src/config/journeys.ts`).
 *
 * Duas composições, não uma redimensionada: no desktop os blocos ficam em
 * fileira, no celular viram uma trilha vertical contínua. No celular os olhos
 * ficam à direita da linha, nunca por cima do rótulo.
 */

const RAIL: Record<JourneyStage['state'], string> = {
  done: 'bg-navy',
  current: 'bg-accent',
  pending: 'bg-rule-strong/45',
  skipped: 'bg-rule-strong/25',
}

const BLOCK: Record<JourneyStage['state'], string> = {
  done: 'bg-navy',
  current: 'bg-accent',
  pending: 'border border-rule-strong',
  skipped: 'border border-dashed border-rule-strong',
}

const STATE_LABEL: Record<JourneyStage['state'], string> = {
  done: 'Concluída',
  current: 'Em andamento',
  pending: 'A seguir',
  skipped: 'Pulada',
}

function stageMeta(stage: JourneyStage): string {
  return stage.completedOn ? formatDayMonthShort(stage.completedOn) : STATE_LABEL[stage.state]
}

export function ProjectJourney({
  stages,
  className,
  detailed = false,
  variant = 'full',
}: {
  stages: readonly JourneyStage[]
  className?: string
  /** `true` mostra o resumo de cada etapa. Usado na página do projeto. */
  detailed?: boolean
  /**
   * `glance` é a jornada RESUMIDA da Home: três etapas, anterior · atual ·
   * próxima. `full` é a de `/projeto`.
   *
   * A variante muda SÓ a grade do desktop. Rótulos, estados, os olhos sobre a
   * etapa corrente e o `sr-only` com o estado por extenso são os mesmos — uma
   * fonte de estilo, um teste de acessibilidade, dois usos.
   */
  variant?: 'full' | 'glance'
}) {
  return (
    <div className={className}>
      {/* ── Celular: trilha vertical contínua ─────────────────────────── */}
      <ol className="sm:hidden">
        {stages.map((stage) => {
          const current = stage.state === 'current'
          return (
            <li key={stage.key} className="flex gap-5">
              <span
                aria-hidden="true"
                className={cn('w-1 shrink-0 rounded-sm', RAIL[stage.state])}
              />
              <div className={cn('min-w-0 flex-1', detailed ? 'py-4' : 'py-3.5')}>
                <div className="flex items-center justify-between gap-3">
                  <p className={cn('t-meta', current ? 'text-foreground' : 'text-muted')}>
                    {stage.label}
                  </p>
                  {current && <BoopEyes gaze="down" className="w-9 shrink-0" />}
                </div>
                <p className={cn('t-label mt-1', current ? 'text-accent-text' : 'text-muted/75')}>
                  <span className="sr-only">{STATE_LABEL[stage.state]}. </span>
                  {stageMeta(stage)}
                </p>
                {detailed && stage.summary && (
                  <p className="t-body text-muted mt-2">{stage.summary}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/* ── Desktop: blocos em fileira ────────────────────────────────── */}
      <ol
        className={cn(
          'hidden sm:grid sm:grid-cols-3 sm:gap-x-5 sm:gap-y-10',
          variant === 'full' && 'lg:grid-cols-6',
        )}
      >
        {stages.map((stage) => {
          const current = stage.state === 'current'
          return (
            <li key={stage.key} className="relative">
              {current && (
                <BoopEyes
                  gaze="down"
                  className="absolute -top-7 left-0 w-11"
                  label="Etapa em andamento"
                />
              )}
              <div
                aria-hidden="true"
                className={cn('rounded-sm', current ? 'h-4' : 'h-3', BLOCK[stage.state])}
              />
              <p className={cn('t-meta mt-4', current ? 'text-foreground' : 'text-muted')}>
                {stage.label}
              </p>
              <p className={cn('t-label mt-1', current ? 'text-accent-text' : 'text-muted/75')}>
                <span className="sr-only">{STATE_LABEL[stage.state]}. </span>
                {stageMeta(stage)}
              </p>
              {detailed && stage.summary && (
                <p className="t-body text-muted mt-3 max-w-[32ch]">{stage.summary}</p>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
