/**
 * Paridade sem banco: `src/config/enums.ts` ⟷ tipos gerados do Postgres.
 *
 * `database.types.ts` exporta `Constants.public.Enums`, que é a lista de
 * valores lida do banco no momento em que os tipos foram gerados. Comparar com
 * `PG_ENUMS` fecha o terceiro lado do triângulo:
 *
 *     Postgres  ⟷  enums.ts     tests/rls/enums.test.ts   (precisa de banco)
 *     tipos     ⟷  enums.ts     este arquivo              (não precisa)
 *
 * O caso que este teste pega e o outro não: alguém roda `pnpm db:types` depois
 * de uma migration e esquece de atualizar `enums.ts`. O de RLS pegaria também,
 * mas só em quem tem Postgres rodando — este falha para todo mundo, na hora.
 */
import { describe, expect, it } from 'vitest'
import { PG_ENUMS, PG_ENUMS_PENDENTES } from '@/config/enums'
import { Constants } from '@/lib/supabase/database.types'

const gerados = Constants.public.Enums as Record<string, readonly string[]>

describe('enums.ts ⟷ tipos gerados', () => {
  it('cobre exatamente os mesmos tipos', () => {
    expect(Object.keys(gerados).sort()).toEqual(Object.keys(PG_ENUMS).sort())
  })

  it.each(Object.entries(PG_ENUMS))('%s tem os mesmos valores, na mesma ordem', (tipo, valores) => {
    expect(gerados[tipo]).toEqual([...valores])
  })

  it.each(Object.keys(PG_ENUMS_PENDENTES))('%s ainda não chegou ao banco', (tipo) => {
    expect(tipo in gerados).toBe(false)
  })
})
