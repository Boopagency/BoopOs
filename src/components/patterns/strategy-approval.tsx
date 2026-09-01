'use client'

import { useState } from 'react'
import { BoopEyes } from '@/components/brand/boop-eyes'
import { Button } from '@/components/ui/button'
import type { Strategy } from '@/lib/data/types'
import { cn } from '@/lib/cn'

/*
 * Fim da estrategia: aprovar a direcao, ou pedir ajuste.
 *
 * PROTOTIPO: nada persiste. O workflow real (`approveStrategy`) chega na
 * FASE 11 — e la a aprovacao pertence a VERSAO, nunca ao documento
 * (ADR-0007), com quem aprovou e quando registrados.
 */
export function StrategyApproval({
  status,
  className,
}: {
  status: Strategy['status']
  className?: string
}) {
  const [decision, setDecision] = useState<'idle' | 'approved' | 'changes'>('idle')

  if (status === 'approved' && decision === 'idle') {
    return (
      <section className={cn('border-rule border-t pt-10', className)}>
        <p className="t-meta text-success">Direção aprovada</p>
        <p className="t-lead measure text-muted mt-4">
          Esta versão foi aprovada e é a que está guiando a produção. Se a direção mudar, criamos
          uma nova versão — e ela volta para a sua leitura.
        </p>
      </section>
    )
  }

  if (decision === 'approved') {
    return (
      <section aria-live="polite" className={cn('border-rule border-t pt-10', className)}>
        <BoopEyes blink className="w-16" />
        <p className="t-section text-foreground mt-7">Direção aprovada.</p>
        <p className="t-lead measure text-muted mt-3">
          É por aqui que a gente segue. A produção do primeiro ciclo começa agora.
        </p>
      </section>
    )
  }

  if (decision === 'changes') {
    return (
      <section aria-live="polite" className={cn('border-rule border-t pt-10', className)}>
        <p className="t-section text-foreground">Ajuste solicitado.</p>
        <p className="t-lead measure text-muted mt-3">
          Vamos revisar e trazer uma nova versão. Você recebe um aviso quando ela estiver pronta.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="decidir" className={cn('border-rule border-t pt-10', className)}>
      <h2 id="decidir" className="t-section text-foreground max-w-[16ch]">
        Essa é a direção?
      </h2>
      <p className="t-lead measure text-muted mt-4">
        Se fizer sentido, seguimos por aqui. Se alguma coisa não fechou, é melhor ajustar agora do
        que depois de vinte peças produzidas.
      </p>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button size="lg" onClick={() => setDecision('approved')}>
          Aprovar direção
        </Button>
        <Button size="lg" variant="outline" onClick={() => setDecision('changes')}>
          Solicitar ajuste
        </Button>
      </div>

      <p className="t-label text-muted mt-6">Protótipo: nenhuma decisão é registrada.</p>
    </section>
  )
}
