import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Contraste dos tokens, verificado contra o CSS de verdade.
 *
 * O azul da Boop (#00C2FF) é vívido, e isso tem consequência: ele reprova
 * como texto sobre fundo claro (2.03:1) e reprova com off-white por cima
 * (2.03:1). A saída — azul com texto navy — é a mesma combinação da logo.
 *
 * Estes testes leem `globals.css` em vez de repetir os valores, então mudar um
 * token e quebrar acessibilidade falha aqui, não no navegador de alguém.
 *
 * Limiares WCAG 2.1 AA: 4.5:1 texto normal, 3:1 texto grande e componentes.
 */

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)
  if (!match?.[1]) throw new Error(`token --${name} não encontrado em globals.css`)
  return match[1]
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!
}

function ratio(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (high + 0.05) / (low + 0.05)
}

const AA = 4.5
const AA_LARGE = 3

describe('contraste — texto normal (AA 4.5:1)', () => {
  const cases: [string, string, string][] = [
    ['texto principal sobre o fundo', 'navy', 'cloud'],
    ['texto secundário sobre o fundo', 'slate-deep', 'cloud'],
    ['off-white sobre navy', 'cloud', 'navy'],
    ['azul acessível sobre o fundo', 'boop-blue-deep', 'cloud'],
    ['navy sobre a laje slate', 'navy', 'slate'],
    ['navy sobre bone', 'navy', 'bone'],
    ['sky sobre navy', 'sky', 'navy'],
    ['sucesso sobre o fundo', 'success', 'cloud'],
    ['alerta sobre o fundo', 'warning', 'cloud'],
    ['erro sobre o fundo', 'danger', 'cloud'],
  ]

  it.each(cases)('%s', (_label, fg, bg) => {
    expect(ratio(token(fg), token(bg))).toBeGreaterThanOrEqual(AA)
  })
})

describe('contraste — o botão primário', () => {
  it('usa texto navy sobre o azul da marca, como a logo faz', () => {
    expect(ratio(token('navy'), token('boop-blue'))).toBeGreaterThanOrEqual(AA)
  })

  it('off-white sobre o azul da marca continua reprovando — por isso não é usado', () => {
    expect(ratio(token('cloud'), token('boop-blue'))).toBeLessThan(AA_LARGE)
  })

  it('o azul da marca não serve como texto em fundo claro', () => {
    expect(ratio(token('boop-blue'), token('cloud'))).toBeLessThan(AA_LARGE)
  })
})

describe('contraste — texto grande e elementos gráficos (AA 3:1)', () => {
  it('display off-white sobre a laje slate', () => {
    expect(ratio(token('cloud'), token('slate'))).toBeGreaterThanOrEqual(AA_LARGE)
  })

  it('anel de foco sobre o fundo claro', () => {
    expect(ratio(token('boop-blue-deep'), token('cloud'))).toBeGreaterThanOrEqual(AA_LARGE)
  })

  it('anel de foco sobre navy', () => {
    expect(ratio(token('boop-blue'), token('navy'))).toBeGreaterThanOrEqual(AA_LARGE)
  })
})

describe('paleta — fidelidade aos assets oficiais', () => {
  it('usa exatamente o azul dos SVGs da marca', () => {
    expect(token('boop-blue').toUpperCase()).toBe('#00C2FF')
  })

  it('usa exatamente o navy dos SVGs da marca', () => {
    expect(token('navy').toUpperCase()).toBe('#0B1B2C')
  })

  it('usa o off-white quente da marca, nunca branco puro', () => {
    expect(token('cloud').toUpperCase()).toBe('#FFFDF5')
    expect(token('cloud').toUpperCase()).not.toBe('#FFFFFF')
  })

  it('usa o azul claro do mascote', () => {
    expect(token('sky').toUpperCase()).toBe('#7AD7F4')
  })
})
