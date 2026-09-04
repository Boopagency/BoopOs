import { formatFullDate } from '@/lib/format'

export interface ProjectContextProps {
  /** `projects.starts_on`. Nulo quando não houve data combinada. */
  startedOn?: string | null
  /**
   * As pessoas da Boop com vínculo EXPLÍCITO neste cliente
   * (`client_memberships` × `profiles`). Só o nome.
   */
  team?: readonly { name: string }[]
}

/**
 * O contexto do projeto, na coluna da direita.
 *
 * ## O que ele pode dizer
 *
 * Só o que o banco afirma. Não existe próxima entrega, próximo encontro,
 * próximo marco, atividade recente nem "última atualização": três desses nem
 * tabela têm, e o activity log não alcança o cliente em forma nenhuma — nem
 * direto, nem agregado, nem traduzido (D-30). A rail é um lugar novo, e um
 * lugar novo é exatamente onde a ficção tenta voltar.
 *
 * ## Por que ciclo e etapa NÃO estão aqui
 *
 * Porque já estão na coluna principal. A Home imprime "Ciclo N" e o rótulo da
 * etapa no bloco "Agora", e `/projeto` faz o mesmo. Repeti-los ao lado seria a
 * mesma informação duas vezes na mesma tela — o ruído que a FASE 8 já tinha
 * recusado ao decidir quem carrega o `summary` da etapa.
 *
 * O que a rail carrega é o que a coluna principal NÃO diz: desde quando o
 * projeto existe, e quem está nele.
 *
 * ## Sem cargo
 *
 * A V0 não guarda cargo. Transformar `boop_member` em "Estrategista" seria
 * escrever ficção na tela do cliente.
 *
 * Quem decide se a rail existe é a PÁGINA: sem equipe e sem data, ela passa
 * `null` e a coluna inteira desaparece do grid (`WorkspaceColumns`). Este
 * componente não devolve `null` por dentro — isso deixaria um `<aside>` vazio
 * ocupando 19rem.
 */
export function ProjectContext({ startedOn, team = [] }: ProjectContextProps) {
  return (
    <div className="flex flex-col gap-9">
      {startedOn && (
        <section aria-labelledby="contexto-inicio">
          <h2 id="contexto-inicio" className="t-meta text-muted">
            No ar desde
          </h2>
          <p className="t-label text-foreground mt-2">{formatFullDate(startedOn)}</p>
        </section>
      )}

      {team.length > 0 && (
        <section aria-labelledby="contexto-equipe">
          <h2 id="contexto-equipe" className="t-meta text-muted">
            Quem está no projeto
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {team.map((person) => (
              <li key={person.name} className="t-label text-foreground">
                {person.name}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
