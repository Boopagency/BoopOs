import { describe, expect, it } from 'vitest'
import {
  CLIENT_DETAIL_COLUMNS,
  CLIENT_LIST_COLUMNS,
  CLIENT_PUBLIC_COLUMNS,
  toClientPublic,
  type ClientDetail,
} from '@/domains/clients/types'
import { findInternalFields, INTERNAL_FIELDS } from '@/lib/data/projection'

/**
 * A convenção de projeção — a dívida column-level da FASE 4, fechada.
 *
 * ## O que este arquivo cobre, e o que não cobre
 *
 * Cobre as listas de colunas e os mapeadores: o que a aplicação PEDE ao banco e
 * o que ela DEVOLVE à tela. A terceira camada — o tipo — não é testável aqui
 * porque ela falha em tempo de compilação: `AssertClientFacing` derruba o
 * `pnpm typecheck`, e um teste que rodasse já teria passado pelo compilador.
 * O caso equivalente está descrito abaixo, para quem for reler.
 *
 * Não cobre o que o banco devolve por papel — isso é
 * `tests/rls/phase5-admin-surface.test.ts`, contra Postgres real, importando
 * estas mesmas constantes.
 */

const colunas = (lista: string): string[] => lista.split(',').map((c) => c.trim())

describe('INTERNAL_FIELDS', () => {
  it('lista os dois campos internos conhecidos do schema', () => {
    /*
     * `notes` é de `clients` e vale agora. `internal_notes` é de
     * `content_versions` e vale a partir da FASE 10 — está aqui antes porque a
     * regra precisa existir ANTES da primeira query de conteúdo, e não depois.
     */
    expect([...INTERNAL_FIELDS]).toEqual(['notes', 'internal_notes'])
  })
})

describe('findInternalFields', () => {
  it('acha campo interno no topo do objeto', () => {
    expect(findInternalFields({ id: '1', notes: 'segredo' })).toEqual(['notes'])
  })

  it('acha campo interno aninhado', () => {
    expect(findInternalFields({ client: { id: '1', internal_notes: 'x' } })).toEqual([
      'internal_notes',
    ])
  })

  it('acha campo interno dentro de lista', () => {
    expect(findInternalFields([{ id: '1' }, { id: '2', notes: null }])).toEqual(['notes'])
  })

  it('não acusa objeto limpo', () => {
    expect(findInternalFields({ id: '1', name: 'Hartmann', slug: 'hartmann' })).toEqual([])
  })

  it('aguenta valor que não é objeto', () => {
    expect(findInternalFields(null)).toEqual([])
    expect(findInternalFields('texto')).toEqual([])
    expect(findInternalFields(42)).toEqual([])
  })

  it('não entra em loop com referência cíclica', () => {
    const a: Record<string, unknown> = { id: '1' }
    a.self = a
    expect(() => findInternalFields(a)).not.toThrow()
  })
})

describe('as listas de colunas de `clients`', () => {
  it('⚠️ a projeção CLIENT-FACING não pede `notes`', () => {
    /* O caso mais importante do arquivo: o que não é buscado não vaza. */
    expect(colunas(CLIENT_PUBLIC_COLUMNS)).not.toContain('notes')
  })

  it('⚠️ a projeção da LISTA não pede `notes`', () => {
    expect(colunas(CLIENT_LIST_COLUMNS)).not.toContain('notes')
  })

  it('a projeção do DETALHE interno pede `notes` — é a única', () => {
    expect(colunas(CLIENT_DETAIL_COLUMNS)).toContain('notes')
  })

  it('⚠️ nenhuma projeção usa `*`', () => {
    for (const lista of [CLIENT_PUBLIC_COLUMNS, CLIENT_LIST_COLUMNS, CLIENT_DETAIL_COLUMNS]) {
      expect(lista).not.toContain('*')
    }
  })

  it('nenhuma projeção pede campo interno além de `notes` no detalhe', () => {
    const permitido = new Set(['notes'])

    for (const lista of [CLIENT_PUBLIC_COLUMNS, CLIENT_LIST_COLUMNS]) {
      for (const coluna of colunas(lista)) {
        expect((INTERNAL_FIELDS as readonly string[]).includes(coluna)).toBe(false)
      }
    }

    for (const coluna of colunas(CLIENT_DETAIL_COLUMNS)) {
      if ((INTERNAL_FIELDS as readonly string[]).includes(coluna)) {
        expect(permitido.has(coluna)).toBe(true)
      }
    }
  })
})

describe('toClientPublic', () => {
  const detalhe: ClientDetail = {
    id: '20000000-0000-4000-8000-000000000001',
    name: 'Hartmann',
    slug: 'hartmann',
    status: 'active',
    notes: 'Nota interna que o cliente nunca pode ler.',
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
  }

  it('⚠️ descarta `notes`', () => {
    const publico = toClientPublic(detalhe)

    expect(findInternalFields(publico)).toEqual([])
    expect(Object.keys(publico)).not.toContain('notes')
  })

  it('mantém exatamente os quatro campos compartilháveis', () => {
    expect(Object.keys(toClientPublic(detalhe)).sort()).toEqual(['id', 'name', 'slug', 'status'])
  })

  it('⚠️ não vaza campo interno NOVO que apareça no detalhe', () => {
    /*
     * O caso que justifica a cópia campo a campo em vez de `const { notes,
     * ...rest }`. O rest spread diz "tudo menos o que eu lembrei de tirar" —
     * uma coluna interna nova entraria sozinha, em silêncio. A lista explícita
     * diz "só isto", e este teste prova a diferença simulando a coluna futura.
     */
    const comCampoNovo = {
      ...detalhe,
      internal_notes: 'campo interno de outra fase',
    } as ClientDetail

    expect(findInternalFields(toClientPublic(comCampoNovo))).toEqual([])
  })
})

/*
 * ── A camada de TIPO, que não roda aqui ─────────────────────────────────────
 *
 * `AssertClientFacing<T>` falha no `tsc`, não no vitest. O equivalente deste
 * arquivo, se pudesse ser escrito como teste, seria:
 *
 *   type Vazado = { id: string; notes: string | null }
 *   export type _ = AssertClientFacing<Vazado>
 *   // → error TS2344: Type 'Vazado' does not satisfy the constraint
 *   //   '{ CAMPO_INTERNO_EM_PROJECAO_CLIENT_FACING: "notes" }'
 *
 * Deixá-lo no código quebraria o `pnpm typecheck`, que é justamente a prova de
 * que a trava funciona. Os asserts reais estão em `domains/*​/types.ts`.
 */
