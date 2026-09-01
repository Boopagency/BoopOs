'use client'

import { useEffect } from 'react'
import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { logger } from '@/lib/logging/logger'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('admin.unhandled_error', { digest: error.digest })
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
