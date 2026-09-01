'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logging/logger'

/**
 * Erro inesperado dentro do portal. O cliente ve uma mensagem segura, na voz da
 * Boop; o detalhe tecnico vai para o log com o digest que correlaciona com o
 * servidor. Nunca stack trace, nunca nome de tabela (docs/security.md).
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('portal.unhandled_error', { digest: error.digest })
  }, [error])

  return (
    <div className="content py-20 md:py-28">
      <p className="t-meta text-muted">Algo saiu do lugar</p>
      <h1 className="t-section text-foreground mt-5 max-w-[18ch]">
        Não conseguimos carregar esta página.
      </h1>
      <p className="t-body measure text-muted mt-5">
        Já registramos o problema. Tente de novo — se continuar, a equipe que cuida do seu projeto
        já vai estar sabendo.
      </p>
      <Button className="mt-9" onClick={reset}>
        Tentar de novo
      </Button>
    </div>
  )
}
