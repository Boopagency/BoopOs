'use client'

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { useId } from 'react'
import { cn } from '@/lib/cn'

/*
 * `use client` por causa do `useId`, que garante que label e controle
 * continuem associados depois da hidratação. Formulário é interação: é
 * exatamente o caso em que a folha vira Client Component (docs/architecture.md).
 */

export interface FieldProps {
  label: string
  help?: string
  error?: string
  required?: boolean
  /**
   * O controle é um CONJUNTO de botões, não um único elemento — escolha única,
   * múltipla, sim/não.
   *
   * Muda a semântica, e não a aparência: `fieldset` + `legend` no lugar de
   * `label` + `htmlFor`. Uma `label` apontando para um `id` que não pertence a
   * nenhum controle é uma associação que o leitor de tela não consegue seguir,
   * e um grupo de botões não tem "o" controle para apontar.
   */
  group?: boolean
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode
}

/**
 * Campo com label sempre associada e erro ligado por `aria-describedby`
 * (.claude/rules/frontend.md). O shell cuida da acessibilidade; o controle
 * só se preocupa com aparência.
 */
export function Field({ label, help, error, required, group, children }: FieldProps) {
  const id = useId()
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined

  const marca = required && (
    <span className="text-danger ml-1" aria-hidden="true">
      *
    </span>
  )

  const corpo = (
    <>
      {help && (
        <p id={helpId} className="t-label text-muted">
          {help}
        </p>
      )}

      {children({ id, describedBy, invalid: Boolean(error) })}

      {error && (
        <p id={errorId} className="t-label text-danger" role="alert">
          {error}
        </p>
      )}
    </>
  )

  if (group) {
    return (
      <fieldset className="space-y-2.5 border-0 p-0">
        <legend className="t-label text-foreground mb-2.5 p-0">
          {label}
          {marca}
        </legend>
        {corpo}
      </fieldset>
    )
  }

  return (
    <div className="space-y-2.5">
      <label htmlFor={id} className="t-label text-foreground block">
        {label}
        {marca}
      </label>

      {corpo}
    </div>
  )
}

const CONTROL =
  'w-full rounded-sm border border-rule-strong bg-surface px-4 text-foreground ' +
  'transition-colors duration-[--motion-fast] placeholder:text-muted/60 ' +
  'hover:border-muted focus:border-accent-text ' +
  'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-50'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export function Input({ className, ...props }: InputProps) {
  return <input className={cn(CONTROL, 't-body h-12', className)} {...props} />
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, rows = 5, ...props }: TextareaProps) {
  return <textarea rows={rows} className={cn(CONTROL, 't-body py-3', className)} {...props} />
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

/**
 * `select` nativo, e nao um combobox proprio.
 *
 * Sem biblioteca de UI (ADR-0018), e um `select` reimplementado a mao custaria
 * teclado, leitor de tela e o seletor nativo do celular — que e melhor do que
 * qualquer lista flutuante em uma tela de 5 polegadas.
 *
 * A seta e um SVG embutido em `data:` porque `appearance-none` apaga a nativa.
 * Nao e biblioteca de icones: sao onze bytes de path, no proprio arquivo.
 */
export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        CONTROL,
        't-body h-12 appearance-none bg-[length:0.65rem] bg-[right_1rem_center] bg-no-repeat pr-10',
        "bg-[image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%234e6076' stroke-width='1.5'/></svg>\")]",
        className,
      )}
      {...props}
    />
  )
}
