import { twMerge } from 'tailwind-merge'

export type ClassValue = string | false | null | undefined

/**
 * Concatena classes e resolve conflitos de utilitario do Tailwind — a ultima
 * vence, como se espera de uma prop `className`.
 *
 * A FASE 1 usava uma versao sem dependencia, com o gatilho documentado:
 * "o primeiro caso real de conflito que precise de resolucao por
 * ultima-classe-vence". Ele apareceu no QA visual da FASE 1.5: um componente
 * de marca com `h-auto` proprio ignorava o `h-6` do chamador e a logo estourava
 * o cabecalho no celular. `tailwind-merge` sao ~7KB e resolvem a classe inteira
 * de problema em vez daquele caso.
 */
export function cn(...values: ClassValue[]): string {
  return twMerge(values.filter(Boolean).join(' '))
}
