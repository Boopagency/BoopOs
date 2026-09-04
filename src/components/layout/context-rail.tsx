import type { ReactNode } from 'react'

/**
 * A coluna de contexto — e a regra de que ela desaparece.
 *
 * ## Ela é composta pela PÁGINA, e não pela casca
 *
 * O pré-voo desta fase propôs um slot `@rail` (parallel route). A documentação
 * local do Next 16.3.4 desfez a proposta: em navegação client-side o Next
 * **mantém a subpágina ativa de um slot mesmo quando a rota nova não a
 * corresponde** (`parallel-routes.md`). Ir da Home para `/arquivos` levaria a
 * rail da Home junto, com a equipe do projeto ao lado de um estado vazio.
 *
 * Evitar isso exigiria uma página `null` para cada rota sem rail — arquivos que
 * existem só para desligar algo, e que a próxima rota esquece de criar. É a
 * forma exata do antipadrão que este repositório recusa em autorização, movida
 * para layout. A rail é CONTEXTUAL: ela deve trocar com a rota, não persistir.
 *
 * ## Ela é opaca ao domínio
 *
 * Recebe `ReactNode`. Não recebe ciclo, etapa, equipe, projeto nem cliente —
 * quem compõe é a página, que já tem o dado e já passou pelo guard. A casca
 * posiciona e não sabe o que tem dentro (ADR-0027).
 *
 * ## Bloco sem origem não aparece
 *
 * `rail` nulo devolve os filhos direto: **sem grid, sem `<aside>`, sem buraco**.
 * Quem decide se há conteúdo real é a página — `team.length > 0 ? <...> : null`
 * —, porque só ela sabe o que leu. Um componente que sempre renderiza e às
 * vezes devolve `null` por dentro deixaria a coluna vazia na tela.
 *
 * ## Geometria
 *
 * A rail entra em `xl` (1280px), e não em `lg`: em 1024px a sidebar já consome
 * 17rem, e uma terceira coluna deixaria o workspace com menos de 500px. Abaixo
 * de `xl` o mesmo conteúdo desce para o fim do fluxo, com régua acima — mesmo
 * DOM, ordem de leitura preservada, sem `hidden`.
 *
 * Esta é também a fundação geométrica do detalhe de conteúdo da FASE 10:
 * conteúdo à esquerda, linha do tempo à direita é esta primitiva com outro
 * filho (ADR-0028).
 */
export function WorkspaceColumns({ rail, children }: { rail?: ReactNode; children: ReactNode }) {
  if (!rail) return <>{children}</>

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start">
      <div className="min-w-0">{children}</div>

      {/*
        `sticky` + `self-start`, e não um container com `overflow` permanente: o
        Next ignora elementos sticky e fixed ao procurar o alvo de scroll da
        navegação (`link.md`), então o DOCUMENTO continua sendo o eixo — e com
        ele a restauração de scroll do navegador, a âncora `#id` e o colapso da
        barra de URL no celular. `overflow-y-auto` só entra em cena quando o
        conteúdo excede a altura da viewport (ADR-0027).
      */}
      <aside
        aria-label="Contexto do projeto"
        className="border-rule px-[--gutter] py-10 max-xl:border-t xl:sticky xl:top-0 xl:max-h-dvh xl:self-start xl:overflow-y-auto xl:border-l xl:px-7 xl:py-12"
      >
        {rail}
      </aside>
    </div>
  )
}
