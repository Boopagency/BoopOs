import type { Metadata } from 'next'
import { EmptyState } from '@/components/patterns/empty-state'

export const metadata: Metadata = { title: 'Estratégia' }

/*
 * A rota existe; o domínio ainda não.
 *
 * Esta página renderizava uma estratégia inteira vinda de mock — dez capítulos,
 * territórios editoriais, KPIs — com o painel de aprovação ao lado, como se o
 * cliente pudesse aprovar. `strategies` e `strategy_versions` existem no schema
 * e estão vazias; a escrita é da FASE 9 e a aprovação, da FASE 11.
 *
 * A rota permanece pelo deep link. O texto diz o que é verdade hoje.
 */
export default function StrategyPage() {
  return (
    <div className="content">
      <EmptyState title="Sua estratégia ainda está sendo construída.">
        Ela começa depois da imersão e da pesquisa. Quando estiver pronta, você lê por aqui e decide
        junto com a gente.
      </EmptyState>
    </div>
  )
}
