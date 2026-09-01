/**
 * Concatenacao condicional de classes. Deliberadamente sem dependencia:
 * com os primitivos desta fase, `clsx` + `tailwind-merge` seriam duas
 * dependencias para resolver um problema que ainda nao temos.
 *
 * Gatilho para trocar por `tailwind-merge`: o primeiro caso real de conflito
 * de utilitarios que precise de resolucao por ultima-classe-vence.
 */
export type ClassValue = string | false | null | undefined

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ')
}
