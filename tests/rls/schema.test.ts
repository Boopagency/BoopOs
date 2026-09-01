/**
 * Varredura de schema: o que TEM que ser verdade sobre toda tabela.
 *
 * É a rede que pega o esquecimento — a tabela nova que alguém cria numa
 * migration futura sem ligar RLS. O teste não conhece as tabelas por nome:
 * ele pergunta ao catálogo (.claude/rules/testing.md).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Client } from 'pg'
import { connect } from './support/db'
import { TABELAS } from './support/fixtures'

let db: Client

beforeAll(async () => {
  db = await connect()
})

afterAll(async () => {
  await db?.end()
})

describe('varredura de schema', () => {
  it('nenhuma tabela de public fica sem RLS', async () => {
    const { rows } = await db.query<{ tabela: string }>(`
      select c.relname as tabela
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and not c.relrowsecurity
       order by 1
    `)

    expect(rows.map((r) => r.tabela)).toEqual([])
  })

  it('as tabelas do Marco 1 estão todas lá', async () => {
    const { rows } = await db.query<{ tabela: string }>(`
      select c.relname as tabela
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
       order by 1
    `)

    expect(rows.map((r) => r.tabela).sort()).toEqual([...TABELAS].sort())
  })

  /**
   * O estado da FASE 2 é deny-by-default: RLS ligada, nenhuma policy. A FASE 4
   * escreve as políticas e INVERTE esta asserção — de "nenhuma" para "quatro
   * por tabela". Falhar aqui na FASE 4 é o comportamento desejado: obriga a
   * atualizar o teste junto com as policies, no mesmo PR.
   */
  it('FASE 2: nenhuma policy ainda — RLS ligada sem policy nega tudo', async () => {
    const { rows } = await db.query<{ total: string }>(
      `select count(*)::text as total from pg_policies where schemaname = 'public'`,
    )

    expect(rows[0]?.total).toBe('0')
  })

  it('anon e authenticated não têm privilégio nenhum em public', async () => {
    const { rows } = await db.query<{ tabela: string; papel: string; privilegio: string }>(`
      select table_name as tabela, grantee as papel, privilege_type as privilegio
        from information_schema.role_table_grants
       where table_schema = 'public'
         and grantee in ('anon', 'authenticated')
       order by 1, 2, 3
    `)

    expect(rows).toEqual([])
  })

  /**
   * O teste acima só vale alguma coisa se o GRANT existisse sem o revoke. No
   * Supabase ele existe: toda tabela criada em `public` nasce concedida a anon
   * e authenticated — é assim que a API funciona sem configuração. Aqui
   * criamos uma tabela e olhamos, para que "zero privilégios" seja um
   * resultado, não uma vacuidade.
   */
  it('a concessão padrão existe — quem a tira é a migration', async () => {
    await db.query('begin')
    try {
      await db.query('create table public._sonda_de_grant (id int)')
      const { rows } = await db.query<{ total: string }>(`
        select count(*)::text as total
          from information_schema.role_table_grants
         where table_schema = 'public'
           and table_name = '_sonda_de_grant'
           and grantee in ('anon', 'authenticated')
      `)

      expect(Number(rows[0]?.total)).toBeGreaterThan(0)
    } finally {
      await db.query('rollback')
    }
  })

  it('o schema app não é alcançável por anon nem por authenticated', async () => {
    const { rows } = await db.query<{ papel: string; pode: boolean }>(`
      select papel, has_schema_privilege(papel, 'app', 'usage') as pode
        from unnest(array['anon', 'authenticated']) as papel
    `)

    expect(rows).toEqual([
      { papel: 'anon', pode: false },
      { papel: 'authenticated', pode: false },
    ])
  })

  it('toda tabela com updated_at tem o trigger que a carimba', async () => {
    const { rows } = await db.query<{ tabela: string }>(`
      select c.relname as tabela
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at' and a.attnum > 0
       where n.nspname = 'public' and c.relkind = 'r'
         and not exists (
           select 1
             from pg_trigger t
             join pg_proc p on p.oid = t.tgfoid
            where t.tgrelid = c.oid
              and not t.tgisinternal
              and p.proname = 'set_updated_at'
         )
       order by 1
    `)

    expect(rows.map((r) => r.tabela)).toEqual([])
  })

  /**
   * `client_id` é o eixo da multi-tenancy: numa tabela de folha ele NUNCA vem
   * do input, é derivado do pai por trigger (docs/data-model.md).
   *
   * As exceções estão nomeadas aqui de propósito, e cada uma tem motivo:
   *
   *   projects, client_memberships   raiz do tenant. Não há pai de onde
   *                                  derivar: o client_id É o vínculo, e a FK
   *                                  para `clients` já o valida.
   *   activity_log, notifications    transversais, client_id nulável — um
   *                                  evento pode ser global.
   *
   * A lista ser explícita é o ponto: uma tabela de folha nova não cabe nela
   * sem alguém decidir que cabe, e o teste falha até que isso aconteça.
   */
  it('toda tabela de folha com client_id o deriva por trigger', async () => {
    const { rows } = await db.query<{ tabela: string }>(`
      select c.relname as tabela
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attname = 'client_id' and a.attnum > 0
       where n.nspname = 'public' and c.relkind = 'r'
         and c.relname not in ('projects', 'client_memberships', 'activity_log', 'notifications')
         and not exists (
           select 1
             from pg_trigger t
             join pg_proc p on p.oid = t.tgfoid
            where t.tgrelid = c.oid
              and not t.tgisinternal
              and p.proname = 'derive_client_id'
         )
       order by 1
    `)

    expect(rows.map((r) => r.tabela)).toEqual([])
  })

  it('as funções de app são security definer com search_path fechado', async () => {
    const { rows } = await db.query<{ funcao: string; definer: boolean; config: string[] | null }>(`
      select p.proname as funcao, p.prosecdef as definer, p.proconfig as config
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app'
       order by 1
    `)

    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      // search_path vazio obriga qualificar tudo: é o que impede que um schema
      // plantado no caminho sequestre a função (docs/security.md).
      expect(
        row.config?.some((entry) => entry.startsWith('search_path=')),
        `app.${row.funcao} sem search_path fixado`,
      ).toBe(true)
    }

    const definers = rows.filter((r) => r.definer).map((r) => r.funcao)
    expect(definers.sort()).toEqual([
      'derive_client_id',
      'handle_auth_user_email_change',
      'handle_new_auth_user',
    ])
  })
})
