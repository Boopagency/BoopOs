import { BoopEyes } from '@/components/brand/boop-eyes'
import type { ProjectStatus } from '@/config/enums'

/**
 * "Tudo certo por aqui." — e por que isto NÃO é um estado vazio.
 *
 * A regra da casa diz que bloco sem conteúdo desaparece. Este é a exceção
 * nomeada (D-26), e a razão é que ele não é uma lista sem itens: é a RESPOSTA à
 * pergunta que o cliente fez ao abrir o portal — "preciso fazer alguma coisa?".
 * Se ele sumir, a resposta some com ele e o cliente vai caçar a informação pelo
 * sistema, que é exatamente o comportamento que a fase existe para acabar.
 *
 * É, com folga, o bloco mais visto do produto: a maioria das visitas acontece
 * quando não há nada pendente. Por isso ele recebe o mesmo cuidado da laje de
 * atenção, em registro invertido — fundo claro, olhos piscando devagar,
 * tipografia em escala de leitura, e nenhum CTA.
 *
 * ## Só aparece quando a afirmação é verdadeira
 *
 * Calma é uma afirmação sobre o mundo, e só pode ser feita quando TODAS as
 * sources relevantes responderam com sucesso. Quando alguma falha, quem
 * renderiza é o `DegradedState` — nunca este componente. A decisão é do
 * domínio, e chega pronta em `AttentionResult.state`.
 */

interface Fala {
  titulo: string
  linha: string
  /** A frase da etapa corrente ainda faz sentido neste status? */
  contextualiza: boolean
}

/*
 * Nenhuma destas frases inventa atividade. Cada uma afirma só o que o banco
 * afirma: o status do projeto. O que a Boop está fazendo, quando aparece, vem
 * do `summary` oficial da etapa corrente — texto de template, não invenção.
 */
const FALA: Record<ProjectStatus, Fala> = {
  active: {
    titulo: 'Tudo certo por aqui.',
    linha: 'Você não precisa fazer nada agora.',
    contextualiza: true,
  },
  paused: {
    titulo: 'Este projeto está pausado no momento.',
    linha: 'A gente avisa quando retomar. Não há nada esperando por você.',
    contextualiza: false,
  },
  completed: {
    titulo: 'Este projeto foi concluído.',
    linha: 'Fica tudo registrado aqui, quando você quiser rever.',
    contextualiza: false,
  },
  archived: {
    titulo: 'Este projeto está arquivado.',
    linha: 'Ele continua acessível como histórico.',
    contextualiza: false,
  },
  /*
   * Um rascunho não alcança um `client_user` — a recusa é 404, e acontece no
   * layout (D-18). Quem chega aqui é da Boop, conferindo o projeto antes de
   * publicá-lo, e a frase diz isso sem fingir que é a visão do cliente.
   */
  draft: {
    titulo: 'Este projeto ainda é um rascunho.',
    linha: 'Ele não aparece para o cliente enquanto estiver assim.',
    contextualiza: false,
  },
}

export function CalmState({
  status,
  stageSummary,
}: {
  status: ProjectStatus
  /** O `summary` da etapa corrente, quando existir. `null` some sem substituto. */
  stageSummary: string | null
}) {
  const fala = FALA[status]

  return (
    <section aria-labelledby="tudo-certo" className="border-rule border-y">
      <div className="content flex items-start gap-5 py-12 md:gap-8 md:py-16">
        <BoopEyes blink className="w-12 shrink-0 md:w-16" />

        <div className="min-w-0">
          <h2 id="tudo-certo" className="t-section text-foreground max-w-[16ch]">
            {fala.titulo}
          </h2>
          <p className="t-lead text-muted mt-4 max-w-[34ch]">{fala.linha}</p>

          {fala.contextualiza && stageSummary && (
            <p className="t-body text-muted mt-5 max-w-[46ch]">{stageSummary}</p>
          )}
        </div>
      </div>
    </section>
  )
}
