import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  formatDayMonth,
  formatDayMonthShort,
  formatTime,
  formatWeekday,
  formatWeekdayCapitalized,
  greeting,
  padded,
} from '@/lib/format'

/**
 * O caso que motivou estes testes: no QA visual da FASE 1.5, a próxima entrega
 * marcada para 2026-09-04 aparecia como "03 de setembro".
 *
 * Causa: `new Date('2026-09-04')` é meia-noite UTC; formatado em UTC-3 volta
 * para o dia anterior. Data-calendário passou a ser formatada em UTC, e estes
 * testes falhariam antes da correção.
 */
describe('format — data-calendário', () => {
  it('não desloca o dia de uma data sem hora', () => {
    expect(formatDayMonth('2026-09-04')).toBe('04 de setembro')
  })

  it('não desloca em nenhum dia do mês, inclusive no primeiro', () => {
    expect(formatDayMonth('2026-01-01')).toBe('01 de janeiro')
    expect(formatDayMonth('2026-03-01')).toBe('01 de março')
  })

  it('mantém o dia na forma curta', () => {
    expect(formatDayMonthShort('2026-08-26')).toBe('26 de ago')
  })

  it('preserva o ano da data escrita', () => {
    expect(formatDayMonth('2026-12-31')).toBe('31 de dezembro')
  })
})

describe('format — instante com fuso', () => {
  it('formata a hora no fuso de São Paulo', () => {
    expect(formatTime('2026-09-30T14:00:00-03:00')).toBe('14:00')
  })

  it('converte um instante em UTC para o horário local', () => {
    // 17:00 UTC é 14:00 em São Paulo.
    expect(formatTime('2026-09-30T17:00:00Z')).toBe('14:00')
  })

  it('junta data e hora no formato da interface', () => {
    expect(formatDateTime('2026-09-30T14:00:00-03:00')).toBe('30 de setembro, 14:00')
  })

  it('usa o dia correto quando o instante cruza a meia-noite UTC', () => {
    // 01:00 UTC do dia 05 ainda é dia 04 em São Paulo.
    expect(formatDayMonth('2026-09-05T01:00:00Z')).toBe('04 de setembro')
  })
})

describe('format — dia da semana', () => {
  it('devolve o dia em minúsculas, como se escreve em português', () => {
    expect(formatWeekday('2026-09-30T14:00:00-03:00')).toBe('quarta-feira')
  })

  it('capitaliza apenas a primeira letra, nunca as duas palavras', () => {
    const value = formatWeekdayCapitalized('2026-09-30T14:00:00-03:00')
    expect(value).toBe('Quarta-feira')
    expect(value).not.toBe('Quarta-Feira')
  })
})

describe('format — auxiliares', () => {
  it('usa a saudação do período, no fuso de São Paulo', () => {
    expect(greeting(new Date('2026-09-01T12:00:00Z'))).toBe('Bom dia') // 09:00 em SP
    expect(greeting(new Date('2026-09-01T18:00:00Z'))).toBe('Boa tarde') // 15:00 em SP
    expect(greeting(new Date('2026-09-01T23:00:00Z'))).toBe('Boa noite') // 20:00 em SP
  })

  it('mantém o zero à esquerda, que é elemento gráfico', () => {
    expect(padded(3)).toBe('03')
    expect(padded(12)).toBe('12')
  })
})
