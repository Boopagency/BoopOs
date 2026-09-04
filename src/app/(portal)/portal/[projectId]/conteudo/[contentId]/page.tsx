import { notFound } from 'next/navigation'

/*
 * Não existe conteúdo real até a FASE 10, então não existe detalhe de conteúdo.
 *
 * O 404 aqui é a verdade, e é o mesmo 404 de qualquer id inexistente do portal
 * — a redação de `not-found.tsx` não distingue "não existe" de "não é seu",
 * exatamente para não confirmar a existência de nada (docs/security.md).
 */
export default function ContentDetailPage() {
  notFound()
}
