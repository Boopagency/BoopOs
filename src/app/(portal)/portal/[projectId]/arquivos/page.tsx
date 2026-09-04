import type { Metadata } from 'next'
import { EmptyState } from '@/components/patterns/empty-state'

export const metadata: Metadata = { title: 'Arquivos' }

/*
 * A rota existe; nem a tabela nem o bucket existem.
 *
 * `files` é da FASE 12, junto com o bucket privado, a validação de MIME no
 * servidor e o download por URL assinada. Até lá não há arquivo nenhum — os que
 * esta página listava eram mock, com tamanho e data inventados.
 */
export default function FilesPage() {
  return (
    <div className="content">
      <EmptyState title="Ainda não há arquivos por aqui.">
        Materiais de marca, estratégia e conteúdo aparecem nesta página conforme forem entregues.
      </EmptyState>
    </div>
  )
}
