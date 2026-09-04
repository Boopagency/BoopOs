import type { AttentionSource } from '../types'
import { onboardingSource } from './onboarding'

/**
 * O registro das sources.
 *
 * Uma, porque existe um caso real. A receita para acrescentar a próxima está em
 * `docs/architecture.md`, e ela começa por uma pergunta — "o cliente precisa
 * executar alguma ação?" — que é respondida antes de qualquer código. Se a
 * resposta for não, aquilo é conteúdo da Home e não entra aqui.
 *
 * Mora no domínio, e não em `src/config`, para não criar ciclo: as sources
 * importam a tabela de prioridade de `config/attention.ts`, e um registro lá
 * fecharia o laço.
 */
export const ATTENTION_SOURCES: readonly AttentionSource[] = [onboardingSource]
