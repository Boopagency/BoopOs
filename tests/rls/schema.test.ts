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
   * A FASE 2 afirmava aqui "nenhuma policy": RLS ligada sem política nega
   * tudo, que era o baseline seguro de um banco sem autorização escrita. A
   * FASE 4 inverteu a asserção, como o próprio comentário anterior previa.
   *
   * O detalhe — quais operações, em qual tabela, para qual papel — vive em
   * `policy-matrix.test.ts`, que declara a matriz e a confere célula a célula.
   * Aqui fica só o que é varredura: nenhuma tabela sem política.
   */
  it('FASE 4: nenhuma tabela de public ficou sem policy', async () => {
    const { rows } = await db.query<{ tabela: string }>(`
      select c.relname as tabela
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
       order by 1
    `)

    expect(
      rows.map((r) => r.tabela),
      'tabela com RLS e sem policy nega tudo em silêncio',
    ).toEqual([])
  })

  /**
   * `anon` continua com zero, e isso não muda em fase nenhuma: quem não tem
   * sessão não fala com o banco. `authenticated` passou a ter privilégio na
   * FASE 4 — o quanto exatamente está declarado em `policy-matrix.test.ts`,
   * junto da policy que o acompanha.
   */
  it('anon continua sem privilégio nenhum em public', async () => {
    const { rows } = await db.query<{ tabela: string; privilegio: string }>(`
      select table_name as tabela, privilege_type as privilegio
        from information_schema.role_table_grants
       where table_schema = 'public'
         and grantee = 'anon'
       order by 1, 2
    `)

    expect(rows).toEqual([])
  })

  it('authenticated só tem privilégio onde há policy para acompanhar', async () => {
    /* A invariante das duas fechaduras, vista pelo outro lado: um GRANT em
     * tabela sem policy seria uma porta com uma tranca só. */
    const { rows } = await db.query<{ tabela: string }>(`
      select distinct g.table_name as tabela
        from information_schema.role_table_grants g
        join pg_class c on c.relname = g.table_name
        join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
       where g.table_schema = 'public'
         and g.grantee = 'authenticated'
         and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
       order by 1
    `)

    expect(
      rows.map((r) => r.tabela),
      'GRANT sem policy',
    ).toEqual([])
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

    /*
     * A lista é explícita, e não um "pelo menos N": `security definer` ignora
     * RLS por definição, então cada nome aqui é uma função que decide sem ser
     * filtrada. Acrescentar uma sem passar por esta lista é acrescentar
     * superfície sensível em silêncio.
     *
     * As três primeiras são maquinário da FASE 2; as demais, a autorização da
     * FASE 4 (ADR-0004).
     */
    const definers = rows.filter((r) => r.definer).map((r) => r.funcao)
    expect(definers.sort()).toEqual([
      'actor_role',
      'can_answer_submission',
      'derive_client_id',
      'handle_auth_user_email_change',
      'handle_new_auth_user',
      'has_client_access',
      'has_profile_access',
      'has_project_access',
      'has_section_access',
      'has_submission_access',
      'has_template_access',
      'is_boop',
      'is_boop_admin',
      'is_client_user',
    ])
  })
})
