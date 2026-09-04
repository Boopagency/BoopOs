import type { JourneyState } from '@/domains/projects/journey'
import type { ProjectStage } from '@/domains/projects/types'

/**
 * "Agora" — onde o projeto está, sem inventar nada.
 *
 * A frase de apoio é o `summary` OFICIAL do template da jornada
 * (`src/config/journeys.ts`), escrito uma vez e revisado como produto. O que
 * este bloco nunca faz é descrever atividade que o banco não afirma: "a equipe
 * está analisando três concorrentes" seria ficção com cara de transparência, e
 * o cliente não tem como saber a diferença.
 *
 * ## Os casos de borda são reais, e cada um tem uma frase própria
 *
 *   etapa corrente        rótulo + a frase oficial dela
 *   `summary` nulo        só o rótulo — a linha some, não vira parágrafo vazio
 *   jornada concluída     "Este ciclo foi concluído."
 *   nada começou          "O projeto ainda não começou."
 *   entre etapas          "Nenhuma etapa está em andamento no momento."
 *   sem etapa nenhuma     o bloco inteiro desaparece
 *
 * Todos deriváveis de `project_stages`. Nenhum inventado.
 */

const SEM_CORRENTE: Record<Exclude<JourneyState, 'in_progress' | 'empty'>, string> = {
  complete: 'Este ciclo foi concluído.',
  stalled: 'Nenhuma etapa está em andamento no momento.',
}

export function CurrentStage({
  cycle,
  stage,
  state,
  summary,
}: {
  cycle: number
  /** A etapa corrente, quando existe. */
  stage: ProjectStage | undefined
  state: JourneyState
  /**
   * A frase de apoio, ou `null` quando ela já foi dita acima.
   *
   * Quem decide é a Home: no estado de calma o bloco de atenção já carrega o
   * `summary`, e repeti-lo aqui imprimiria a mesma frase duas vezes na mesma
   * tela. A decisão de composição mora na composição, não no componente.
   */
  summary: string | null
}) {
  /* Jornada sem etapa nenhuma não tem o que dizer. */
  if (state === 'empty') return null

  return (
    <section aria-labelledby="agora" className="content py-12 md:py-16">
      <p className="t-meta text-muted">Ciclo {cycle}</p>

      <h2 id="agora" className="t-section text-foreground mt-3 max-w-[18ch]">
        {stage ? stage.label : SEM_CORRENTE[state === 'complete' ? 'complete' : 'stalled']}
      </h2>

      {summary && <p className="t-lead text-muted measure mt-5">{summary}</p>}
    </section>
  )
}
