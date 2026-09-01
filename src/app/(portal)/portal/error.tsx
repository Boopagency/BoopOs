'use client'

import { useEffect } from 'react'
import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { logger } from '@/lib/logging/logger'

/**
 * Erro inesperado dentro do portal. O cliente ve uma mensagem segura; o detalhe
 * tecnico vai para o log com o digest que correlaciona com o servidor.
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
    <Container size="narrow">
      <Callout tone="danger" title="Nao conseguimos carregar esta pagina">
        Ja registramos o problema. Tente novamente em instantes.
      </Callout>
      <Button className="mt-6" onClick={reset}>
        Tentar novamente
      </Button>
    </Container>
  )
}
