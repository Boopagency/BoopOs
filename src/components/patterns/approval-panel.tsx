'use client'

import { useRef, useState } from 'react'
import { BoopEyes } from '@/components/brand/boop-eyes'
import { CloudLayer } from '@/components/brand/cloud-layer'
import { Button } from '@/components/ui/button'
import { Field, Textarea } from '@/components/ui/field'
import type { ContentItem } from '@/lib/data/types'
import { cn } from '@/lib/cn'

type Outcome = 'idle' | 'approved' | 'changes'

/*
 * Aprovação — a ação mais importante que o cliente executa.
 *
 * PROTÓTIPO: nada aqui persiste. Não há Server Action, não há rede, não há
 * estado além do local. O workflow real (`approveContentVersion`, com função
 * SQL, índice único e activity log) chega na FASE 11 — o contrato já está
 * escrito em docs/workflows.md.
 *
 * Duas decisões de experiência:
 *
 * 1. Aprovar tem um momento de marca, não um toast. É a única celebração do
 *    produto, e dura o tempo de ler duas linhas (§ docs/design-direction.md).
 * 2. Pedir alteração é igualmente fácil — mesma hierarquia visual, um clique
 *    de distância. Se aprovar for mais fácil que pedir ajuste, o produto está
 *    empurrando o cliente para o "sim", e isso não é transparência.
 *
 * O diálogo é `<dialog>` nativo: foco preso, Esc para fechar e fundo inerte
 * vêm do browser, sem biblioteca.
 */
export function ApprovalPanel({ item, className }: { item: ContentItem; className?: string }) {
  const [outcome, setOutcome] = useState<Outcome>('idle')
  const [note, setNote] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  const alreadyDecided = item.status !== 'awaiting_client'

  if (alreadyDecided && outcome === 'idle') {
    return (
      <div className={cn('border-rule border-t pt-8', className)}>
        <p className="t-body text-muted">
          {item.status === 'approved'
            ? 'Você já aprovou esta versão. Se algo mudar, criamos uma nova e avisamos.'
            : item.status === 'changes_requested'
              ? 'Você pediu um ajuste nesta peça. Estamos trabalhando nele.'
              : 'Esta peça já seguiu o fluxo. Nada depende de você aqui.'}
        </p>
      </div>
    )
  }

  if (outcome === 'approved') {
    return (
      <section
        aria-live="polite"
        className={cn(
          'on-inverse bg-navy relative isolate overflow-hidden rounded-sm px-7 py-12 md:px-10 md:py-14',
          className,
        )}
      >
        <CloudLayer density="single" className="opacity-25 mix-blend-screen" />
        <div className="relative">
          <BoopEyes blink className="fade w-16" />
          <p className="t-section rise rise-1 text-cloud mt-7">Aprovado.</p>
          <p className="t-lead rise rise-2 text-muted-on-inverse mt-3 max-w-[28ch]">
            Agora é com a gente. Você recebe um aviso quando entrar no ar.
          </p>
        </div>
      </section>
    )
  }

  if (outcome === 'changes') {
    return (
      <section
        aria-live="polite"
        className={cn(
          'border-warning bg-surface-soft/60 rounded-sm border-l-2 px-7 py-10',
          className,
        )}
      >
        <p className="t-section text-foreground">Ajuste solicitado.</p>
        <p className="t-lead text-muted mt-3 max-w-[34ch]">
          A equipe já foi avisada. Assim que houver uma nova versão, ela aparece aqui.
        </p>
        {note && (
          <p className="t-body measure border-rule text-muted mt-6 border-l pl-5">“{note}”</p>
        )}
      </section>
    )
  }

  return (
    <section aria-labelledby="decisao" className={cn('border-rule border-t pt-8', className)}>
      <h2 id="decisao" className="t-meta text-muted">
        Esta peça está esperando você
      </h2>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Button size="lg" onClick={() => setOutcome('approved')} className="sm:flex-1">
          Aprovar
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => dialogRef.current?.showModal()}
          className="sm:flex-1"
        >
          Solicitar alteração
        </Button>
      </div>

      <p className="t-label text-muted mt-5">
        Protótipo: nenhuma decisão é registrada. Na versão final, quem aprovou e quando fica
        gravado, e a aprovação vale para esta versão — não para as próximas.
      </p>

      <dialog
        ref={dialogRef}
        aria-labelledby="ajuste-titulo"
        className="border-rule bg-background backdrop:bg-navy/50 w-[min(34rem,calc(100vw-2rem))] rounded-lg border p-0"
      >
        <form
          method="dialog"
          className="p-7 md:p-9"
          onSubmit={() => {
            setOutcome('changes')
          }}
        >
          <h3 id="ajuste-titulo" className="t-title text-foreground">
            O que precisa mudar?
          </h3>
          <p className="t-body text-muted mt-2">
            Quanto mais específico, mais rápido a gente acerta.
          </p>

          <div className="mt-7">
            <Field label="Seu comentário" required>
              {({ id, describedBy }) => (
                <Textarea
                  id={id}
                  aria-describedby={describedBy}
                  required
                  rows={5}
                  placeholder="Ex.: o horário mudou para 11h às 17h."
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              )}
            </Field>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse">
            <Button type="submit" size="lg" className="sm:flex-1">
              Enviar
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="sm:flex-1"
              onClick={() => dialogRef.current?.close()}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </dialog>
    </section>
  )
}
