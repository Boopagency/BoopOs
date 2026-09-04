import type { Metadata } from 'next'
import { EmptyState } from '@/components/patterns/empty-state'

export const metadata: Metadata = { title: 'Encontros' }

/*
 * A rota existe; a tabela ainda não.
 *
 * Não há `meetings` no schema — é da FASE 13. As reuniões que apareciam aqui, e
 * o "próximo encontro" que aparecia na Home, eram mock com data, hora e link
 * inventados.
 */
export default function MeetingsPage() {
  return (
    <div className="content">
      <EmptyState title="Nenhum encontro marcado ainda.">
        Assim que agendarmos o próximo, ele aparece aqui com data, hora e link.
      </EmptyState>
    </div>
  )
}
