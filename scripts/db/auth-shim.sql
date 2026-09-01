-- ═══════════════════════════════════════════════════════════════════════════
-- SHIM DE `auth` — SÓ PARA POSTGRES NU. NÃO É SUPABASE.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- ⚠️  Este arquivo NÃO é uma migration e NUNCA roda em staging nem em produção.
--
-- O caminho oficial de desenvolvimento é `supabase start`, que sobe o stack
-- inteiro (Postgres + GoTrue + PostgREST + Storage) em Docker. Quando há
-- Docker, use ele: `pnpm db:reset`.
--
-- Este shim existe para o caso em que NÃO há Docker — contêiner de CI, ambiente
-- de agente, máquina restrita. Ele recria a superfície mínima de `auth` de que
-- as migrations dependem, para que dê para responder à pergunta que importa:
--
--     "As migrations deste repositório recriam o banco do zero?"
--
-- O que ele NÃO faz: GoTrue, login, e-mail, JWT de verdade, Storage, PostgREST.
-- Um teste que precise de qualquer uma dessas coisas precisa de `supabase start`.
--
-- Ver docs/database.md#sem-docker.

-- ── Papéis ─────────────────────────────────────────────────────────────────
-- Mesmos nomes e mesmos atributos do Supabase hospedado. `service_role` nasce
-- com BYPASSRLS de propósito: é assim que ela se comporta em produção, e é
-- exatamente por isso que ela nunca serve para PROVAR isolamento
-- (docs/security.md).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator noinherit login;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'postgres') then
    create role postgres superuser login;
  end if;
end;
$$;

-- Os papéis são do cluster, não do banco: sobrevivem ao `drop database` do
-- reset. Regravar a mesma concessão só geraria ruído.
set client_min_messages = warning;
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to postgres;
reset client_min_messages;

grant usage on schema public to anon, authenticated, service_role;

-- FIDELIDADE QUE IMPORTA: no Supabase hospedado, toda tabela criada em `public`
-- nasce com GRANT para anon, authenticated e service_role — é assim que a API
-- funciona sem configuração. A migration 20260901140008 REVOGA esse grant de
-- anon e authenticated.
--
-- Se o shim não reproduzisse a concessão, o revoke não teria o que revogar e o
-- teste "anon não tem privilégio" passaria por vacuidade: verde local, furo em
-- produção. Então concedemos aqui, exatamente como lá, para que o revoke da
-- migration seja testado de verdade.
alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to postgres, anon, authenticated, service_role;

-- ── Schema auth ────────────────────────────────────────────────────────────
create schema if not exists auth;
grant usage on schema auth to postgres, service_role;

comment on schema auth is
  'SHIM LOCAL. Sem Docker nao ha GoTrue; isto e o minimo que as migrations '
  'exigem. Nunca aplicado em staging ou producao. Ver scripts/db/auth-shim.sql.';

-- ── auth.users ─────────────────────────────────────────────────────────────
-- Subconjunto das colunas reais do GoTrue: apenas as que este repositório
-- toca (`public.profiles` espelha `id`, `email` e `raw_user_meta_data`).
-- Deliberadamente sem `encrypted_password`: nenhuma senha entra no repositório,
-- nem de mentira.
create table if not exists auth.users (
  instance_id        uuid,
  id                 uuid primary key,
  aud                varchar(255),
  role               varchar(255),
  email              varchar(255) unique,
  email_confirmed_at timestamptz,
  raw_app_meta_data  jsonb,
  raw_user_meta_data jsonb,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

comment on table auth.users is
  'SHIM. A tabela real do GoTrue tem dezenas de colunas a mais.';

-- ── Funções de identidade ──────────────────────────────────────────────────
-- Cópia fiel da implementação do Supabase: é o contrato que as policies da
-- FASE 4 vão usar, então divergir aqui tornaria os testes mentirosos.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.email()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.email(), auth.jwt()
  to anon, authenticated, service_role;
