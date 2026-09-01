'use client'

import { useEffect } from 'react'
import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { logger } from '@/lib/logging/logger'

/** Erro inesperado nas rotas fora de portal e admin. */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('app.unhandled_error', { digest: error.digest })
  }, [error])

  return (
    <main id="main" className="flex min-h-dvh flex-col justify-center py-16">
      <Container size="narrow">
        <Callout tone="danger" title="Algo deu errado">
          Ja registramos o problema. Tente novamente em instantes.
        </Callout>
        <Button className="mt-6" onClick={reset}>
          Tentar novamente
        </Button>
      </Container>
    </main>
  )
}
