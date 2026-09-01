import { APP } from '@/config/app'

/**
 * Data e hora em pt-BR, no fuso America/Sao_Paulo (docs/product.md).
 *
 * Há dois tipos de valor no sistema, e tratá-los igual gera erro silencioso:
 *
 *   INSTANTE   '2026-09-30T14:00:00-03:00' — um momento no tempo. Formatado
 *              no fuso de São Paulo.
 *
 *   DATA-CALENDÁRIO  '2026-09-04' — um dia do calendário, sem hora. O
 *              JavaScript parseia isso como meia-noite UTC; formatar em
 *              UTC-3 devolveria o dia ANTERIOR. É o bug clássico de "a data
 *              apareceu um dia atrasada", e ele foi encontrado no QA visual
 *              da FASE 1.5. Por isso data-calendário é formatada em UTC:
 *              o dia renderizado é exatamente o dia escrito.
 *
 * Fixar o fuso também evita divergência entre servidor e browser, que é o
 * outro jeito de errar data em app renderizado nos dois lados.
 */

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

function zoneFor(iso: string): string {
  return CALENDAR_DATE.test(iso) ? 'UTC' : APP.timezone
}

/** `Intl.DateTimeFormat` é caro; cada combinação é criada uma vez só. */
const cache = new Map<string, Intl.DateTimeFormat>()

function formatter(zone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = zone + JSON.stringify(options)
  let found = cache.get(key)
  if (!found) {
    found = new Intl.DateTimeFormat(APP.locale, { ...options, timeZone: zone })
    cache.set(key, found)
  }
  return found
}

function format(iso: string, options: Intl.DateTimeFormatOptions): string {
  return formatter(zoneFor(iso), options).format(new Date(iso))
}

/** "04 de setembro" */
export function formatDayMonth(iso: string): string {
  return format(iso, { day: '2-digit', month: 'long' })
}

/** "04 set" — para listas densas, onde o mês por extenso não cabe. */
export function formatDayMonthShort(iso: string): string {
  return format(iso, { day: '2-digit', month: 'short' }).replace('.', '')
}

/** "04 de setembro de 2026" */
export function formatFullDate(iso: string): string {
  return format(iso, { day: '2-digit', month: 'long', year: 'numeric' })
}

/** "14:00" */
export function formatTime(iso: string): string {
  return format(iso, { hour: '2-digit', minute: '2-digit' })
}

/**
 * "quarta-feira" — em minúsculas, como se escreve em português.
 * `capitalize` do CSS erraria: transformaria em "Quarta-Feira".
 */
export function formatWeekday(iso: string): string {
  return format(iso, { weekday: 'long' })
}

/** "Quarta-feira" — só a primeira letra, para início de frase. */
export function formatWeekdayCapitalized(iso: string): string {
  const day = formatWeekday(iso)
  return day.charAt(0).toUpperCase() + day.slice(1)
}

/** "30 de setembro, 14:00" — o formato padrão da interface. */
export function formatDateTime(iso: string): string {
  return `${formatDayMonth(iso)}, ${formatTime(iso)}`
}

/**
 * Saudação por período do dia, no fuso de São Paulo.
 * Recebe a data para poder ser testada sem congelar o relógio.
 */
export function greeting(now: Date = new Date()): 'Bom dia' | 'Boa tarde' | 'Boa noite' {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: APP.timezone,
      hour: 'numeric',
      hour12: false,
    }).format(now),
  )
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Número com dois dígitos: "03", "12".
 * A direção de arte usa o zero à esquerda como elemento gráfico.
 */
export function padded(value: number): string {
  return String(value).padStart(2, '0')
}
