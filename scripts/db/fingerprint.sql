-- ═══════════════════════════════════════════════════════════════════════════
-- Impressão digital do schema — para comparar dois bancos
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Rode nos dois lados (local e staging) e compare os sete hashes. Iguais
-- significa: mesmas colunas, mesmas constraints, mesmos índices, mesmos
-- triggers, mesmos enums, mesmas funções de `app` e a mesma configuração de
-- RLS. É a verificação que sustenta a promessa da FASE 2 — "o banco pode ser
-- recriado do zero a partir do repositório" — sem depender de Docker nem de
-- `supabase db diff`.
--
--   Local:   pnpm db:psql -- -At -f scripts/db/fingerprint.sql
--   Remoto:  cole no SQL editor do projeto, ou use o conector do Supabase.
--
-- `search_path = pg_catalog` NÃO é detalhe: sem ele, `format_type` e
-- `pg_get_*def` escondem o schema dos objetos que estiverem no caminho de
-- busca — e o mesmo schema produz hashes diferentes só porque um lado tem
-- `extensions` no search_path e o outro não. Fixando o caminho, os dois lados
-- qualificam tudo e a comparação passa a significar alguma coisa.
set search_path = pg_catalog;

with colunas as (
  select string_agg(format('%s.%s:%s:%s:%s', c.relname, a.attname,
           format_type(a.atttypid, a.atttypmod), a.attnotnull,
           coalesce(pg_get_expr(d.adbin, d.adrelid), '-')), E'\n' order by c.relname, a.attnum) as s
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
    left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
   where n.nspname = 'public' and c.relkind = 'r'
),
constraints as (
  select string_agg(format('%s:%s', conname, pg_get_constraintdef(con.oid)), E'\n' order by conname) as s
    from pg_constraint con
    join pg_namespace n on n.oid = con.connamespace
   where n.nspname = 'public'
),
indices as (
  select string_agg(indexdef, E'\n' order by indexname) as s
    from pg_indexes where schemaname = 'public'
),
triggers as (
  select string_agg(format('%s:%s', c.relname, pg_get_triggerdef(t.oid)), E'\n' order by c.relname, t.tgname) as s
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where not t.tgisinternal and n.nspname in ('public', 'auth')
),
enums as (
  select string_agg(format('%s:%s', t.typname, e.enumlabel), E'\n' order by t.typname, e.enumsortorder) as s
    from pg_type t join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public'
),
funcoes as (
  select string_agg(format('%s:%s:%s', p.proname, p.prosecdef, md5(p.prosrc)), E'\n' order by p.proname) as s
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app'
),
rls as (
  select string_agg(format('%s:%s', c.relname, c.relrowsecurity), E'\n' order by c.relname) as s
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
)
select 'colunas'     as parte, md5(colunas.s)     as hash from colunas
union all select 'constraints', md5(constraints.s) from constraints
union all select 'indices',     md5(indices.s)     from indices
union all select 'triggers',    md5(triggers.s)    from triggers
union all select 'enums',       md5(enums.s)       from enums
union all select 'funcoes',     md5(funcoes.s)     from funcoes
union all select 'rls',         md5(rls.s)         from rls;
