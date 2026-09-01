/**
 * Paridade `pg_enum` ⟷ `src/config/enums.ts`.
 *
 * Duas fontes para a mesma taxonomia só funcionam enquanto uma máquina confere
 * as duas ([ADR-0003](../../docs/adr/0003-enums-no-postgres.md)). Sem este
 * teste, um valor acrescentado só no Postgres viraria `never` silencioso no
 * TypeScript — ou pior, o contrário.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { PG_ENUMS, PG_ENUMS_PENDENTES } from '@/config/enums'
import { connect } from './support/db'

let db: Client
let noBanco: Map<string, string[]>

beforeAll(async () => {
  db = await connect()

  const { rows } = await db.query<{ tipo: string; valores: string[] }>(`
    select t.typname as tipo,
           array_agg(e.enumlabel::text order by e.enumsortorder) as valores
      from pg_type t
      join pg_enum e on e.enumtypid = t.oid
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public'
     group by t.typname
  `)

  noBanco = new Map(rows.map((r) => [r.tipo, r.valores]))
})

afterAll(async () => {
  await db?.end()
})

describe('paridade de enums', () => {
  it('o conjunto de tipos é exatamente o mesmo dos dois lados', () => {
    expect([...noBanco.keys()].sort()).toEqual(Object.keys(PG_ENUMS).sort())
  })

  it.each(Object.entries(PG_ENUMS))('%s tem os mesmos valores, na mesma ordem', (tipo, valores) => {
    // A ordem importa: `enumsortorder` é o que o Postgres usa para comparar e
    // ordenar. Divergir aqui muda o resultado de um `order by status`.
    expect(noBanco.get(tipo)).toEqual([...valores])
  })

  /**
   * Tripwire deliberado. `file_category` e companhia chegam nas FASES 12 e 13.
   * No dia em que a migration criar o tipo, este teste quebra e o PR é obrigado
   * a mover a chave para `PG_ENUMS` — que é exatamente o momento em que a
   * paridade passa a valer para ela.
   */
  it.each(Object.keys(PG_ENUMS_PENDENTES))(
    '%s ainda não existe no banco — quando existir, mova para PG_ENUMS',
    (tipo) => {
      expect(noBanco.has(tipo)).toBe(false)
    },
  )
})
