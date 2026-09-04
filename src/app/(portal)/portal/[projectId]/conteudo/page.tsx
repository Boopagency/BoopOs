import type { Metadata } from 'next'
import { EmptyState } from '@/components/patterns/empty-state'

export const metadata: Metadata = { title: 'Conteúdo' }

/*
 * A rota existe; o domínio ainda não.
 *
 * Até a FASE 8 esta página lia `src/mocks/hartmann.ts` e mostrava doze peças
 * inventadas — com legenda, objetivo, território e versão — como se fossem o
 * conteúdo do cliente. `content_items` e `content_versions` existem no schema
 * desde a FASE 2 e estão vazias: não há caminho de escrita nem leitura
 * client-facing até a FASE 10.
 *
 * A rota NÃO some, e isso é decisão: deep link é o principal caminho de entrada
 * do produto, e uma URL que já existiu e passa a dar 404 quebra qualquer link
 * já compartilhado. Ela sai da navegação (o produto não anuncia sala vazia) e
 * responde uma frase verdadeira para quem chegar por endereço.
 */
export default function ContentPage() {
  return (
    <div className="content">
      <EmptyState title="O primeiro ciclo ainda está em produção.">
        Assim que houver conteúdo pronto para você ver, ele aparece aqui — e avisamos por e-mail.
      </EmptyState>
    </div>
  )
}
