import type { AttentionKind } from '@/domains/attention/types'

/**
 * A política de ordem da atenção — uma TABELA, não uma cadeia de `if`.
 *
 * Uma linha, porque existe um `AttentionKind`. As faixas abaixo são orientação
 * para quem acrescentar o próximo, e não linhas a preencher agora: um kind
 * declarado sem source que o emita é semântica congelada antes do domínio
 * existir (`src/domains/attention/types.ts`).
 *
 *     00–19  destrava o projeto     — o trabalho para sem isso
 *     20–39  decisão do cliente     — aprovar, pedir ajuste
 *     40–59  insumo pedido          — algo que só ele tem
 *     60–79  tempo                  — algo com hora marcada
 *
 * `Record<AttentionKind, number>` é deliberado: acrescentar um kind sem a
 * prioridade correspondente não compila.
 */
export const PRIORITY: Record<AttentionKind, number> = {
  /* Onboarding parado bloqueia a etapa seguinte do projeto inteiro. */
  'onboarding.continue': 10,
}
