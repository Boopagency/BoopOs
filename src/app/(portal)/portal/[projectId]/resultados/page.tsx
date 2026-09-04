import type { Metadata } from 'next'
import { EmptyState } from '@/components/patterns/empty-state'

export const metadata: Metadata = { title: 'Resultados' }

/*
 * A rota existe; a origem ainda não.
 *
 * `account_metrics` e `content_metrics` **não existem no schema** — são da
 * FASE 14. Os números que esta página mostrava, e as leituras que os
 * acompanhavam, eram inteiramente inventados.
 *
 * O texto abaixo já era o certo antes desta fase; o que mudou é que agora ele é
 * a página inteira, em vez de um caminho que quase nunca era tomado.
 */
export default function ResultsPage() {
  return (
    <div className="content">
      <EmptyState title="Ainda não temos resultados por aqui.">
        Estamos coletando os primeiros sinais. Depois da primeira publicação, esta página começa a
        contar a história.
      </EmptyState>
    </div>
  )
}
