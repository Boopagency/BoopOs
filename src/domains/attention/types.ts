import type { AssertClientFacing } from '@/lib/data/projection'
import type { ProjectPublic } from '@/domains/projects/types'

/**
 * O contrato da atenção.
 *
 * ## O que é atenção, e o que não é
 *
 * Atenção é o que **depende do cliente agora**. Não é notícia, não é contexto,
 * não é "coisas que existem no projeto". A pergunta que decide se um estado
 * novo entra aqui é sempre a mesma, e ela é feita antes de qualquer código:
 *
 *     O cliente precisa executar alguma ação?
 *
 * Se a resposta for não, aquilo é conteúdo da Home — não é `AttentionItem`.
 * Uma reunião marcada não vira atenção só por existir; um arquivo entregue
 * também não. Sem acionabilidade, sem atenção.
 *
 * ## Derivada, nunca armazenada
 *
 * Não existe tabela `attention_items`, nem fila, nem dismiss, nem estado
 * persistido (ADR-0025). O resultado é recalculado a cada request a partir dos
 * domínios que já sabem autorizar a si mesmos.
 */

/**
 * Os tipos de atenção que EXISTEM.
 *
 * Um valor só entra aqui quando há, ao mesmo tempo: estado client-facing real,
 * ação real, e ação que o CLIENTE pode executar. Nada é antecipado porque está
 * no roadmap — declarar `content.approve` hoje congelaria a semântica de
 * aprovação antes de a FASE 11 projetar o domínio.
 *
 * Faixas de prioridade reservadas, como orientação para quem acrescentar o
 * próximo — e não como linhas a preencher agora:
 *
 *     00–19  destrava o projeto
 *     20–39  decisão do cliente
 *     40–59  insumo pedido
 *     60–79  tempo
 */
export type AttentionKind = 'onboarding.continue'

export interface AttentionItem {
  /**
   * Estável entre requests, processos e canais: `${kind}:${entityId ?? projectId}`.
   *
   * Serve de chave no React, de `dedupe_key` quando a FASE 16 mandar e-mail, e
   * de correlação em log. Por isso não pode conter PII e não pode ser aleatório.
   */
  id: string
  kind: AttentionKind
  /** Menor = mais urgente. Vem da tabela de `src/config/attention.ts`. */
  priority: number
  /**
   * Quantas PENDÊNCIAS este item representa — nunca unidades internas.
   *
   * Onboarding em rascunho é `1`, e não o número de perguntas que faltam: o
   * numeral gigante precisa significar a mesma coisa em todos os blocos, senão
   * "03" quer dizer três conteúdos numa laje e três perguntas na outra.
   */
  count: number
  /** pt-BR, pronto para renderizar. Sem jargão, sem status cru. */
  title: string
  description: string | null
  /** `href` SEMPRE por `portalHref()`. Nunca literal, nunca concatenado. */
  cta: { label: string; href: string }
  projectId: string
  entityId: string | null
  dueAt: string | null
}

export type _AttentionItemIsSafe = AssertClientFacing<AttentionItem>

/**
 * As três respostas possíveis, e a diferença entre duas delas é a fase inteira.
 *
 * - `attention` — há algo esperando o cliente.
 * - `calm`      — TODAS as sources relevantes responderam, e nenhuma trouxe
 *                 item. É uma afirmação sobre o mundo.
 * - `degraded`  — não foi possível verificar. **Não é calma.** Zero itens
 *                 porque a leitura falhou não é zero pendências.
 */
export type AttentionState = 'attention' | 'calm' | 'degraded'

export interface AttentionResult {
  /** A decisão, já tomada no domínio. A UI não recalcula nada. */
  state: AttentionState
  items: readonly AttentionItem[]
  /** Todas as sources relevantes responderam com sucesso? */
  complete: boolean
  /**
   * Números, nunca erros.
   *
   * Nada técnico atravessa a fronteira do RSC: o componente sabe QUANTAS
   * sources falharam, e nunca por quê. O motivo vai para o log.
   */
  evaluated: number
  failed: number
}

export type _AttentionResultIsSafe = AssertClientFacing<AttentionResult>

/** O que uma source recebe: o projeto JÁ verificado, nunca uma string solta. */
export interface AttentionContext {
  project: ProjectPublic
}

export interface AttentionSource {
  /** Identifica a source em log e em teste. Nunca aparece na tela. */
  key: string
  /**
   * A source se aplica a este projeto? Avaliada ANTES de rodar.
   *
   * Separar isto do `run` é o que faz "todas as sources RELEVANTES" virar
   * código: uma source que não se aplica não conta como avaliada nem como
   * falha, e um projeto sem onboarding continua em calma legítima em vez de
   * parecer degradado.
   */
  appliesTo: (ctx: AttentionContext) => boolean
  run: (ctx: AttentionContext) => Promise<readonly AttentionItem[]>
}

/**
 * O resultado de UMA source, já isolado.
 *
 * `ok: false` não carrega o erro de propósito: quem decide o estado não deve
 * ter como vazar detalhe técnico para a tela nem por engano.
 */
export type SourceOutcome = { ok: true; items: readonly AttentionItem[] } | { ok: false }
