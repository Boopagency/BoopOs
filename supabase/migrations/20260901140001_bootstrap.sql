-- ═══════════════════════════════════════════════════════════════════════════
-- BOOTSTRAP — schema auxiliar, extensões e funções de infraestrutura
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Nada de domínio aqui. Só o maquinário que as tabelas de domínio usam:
-- carimbo de `updated_at`, derivação de tenant, imutabilidade de tenant,
-- espelho de `auth.users` e a rejeição de mutação para tabelas append-only.
--
-- Ver docs/data-model.md e docs/database.md.

-- ── Extensões ──────────────────────────────────────────────────────────────
-- `citext` é a única extensão do projeto. Justificativa: e-mail e slug são
-- identificadores naturalmente case-insensitive, e `citext` evita que
-- "Hartmann" e "hartmann" coexistam como slugs distintos sem obrigar toda
-- query a lembrar de `lower()`. `gen_random_uuid()` NÃO precisa de extensão:
-- é núcleo do Postgres desde a 13.
create extension if not exists citext with schema public;

-- ── Schema auxiliar ────────────────────────────────────────────────────────
-- Funções internas ficam fora de `public` para não serem expostas pelo
-- PostREST. `config.toml` expõe apenas `public` e `graphql_public`; o revoke
-- abaixo é a segunda camada.
create schema if not exists app;

revoke all on schema app from public;
revoke all on schema app from anon, authenticated;
grant usage on schema app to postgres, service_role;

comment on schema app is
  'Funcoes internas de infraestrutura. Nao exposto via API. Ver docs/database.md.';

-- ═══════════════════════════════════════════════════════════════════════════
-- updated_at
-- ═══════════════════════════════════════════════════════════════════════════
-- Uma função para todas as tabelas (docs/roadmap.md FASE 2). Não é
-- `security definer`: só toca em NEW, não lê nada.
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function app.set_updated_at() is
  'Carimba updated_at em todo UPDATE. Anexar como BEFORE UPDATE FOR EACH ROW.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Derivação de client_id
-- ═══════════════════════════════════════════════════════════════════════════
-- REGRA CENTRAL DE MULTI-TENANCY (docs/data-model.md):
--
--   `client_id` NUNCA vem do input. É sempre derivado do pai.
--
-- O valor que o cliente enviar é descartado — não validado, descartado. Isso
-- torna estruturalmente impossível gravar uma linha do Cliente A apontando
-- para o Cliente B, mesmo que a aplicação tenha um bug.
--
-- SECURITY DEFINER é necessário de verdade aqui: a partir da FASE 4 a RLS
-- estará ativa e o usuário que insere pode não enxergar a linha-pai. Sem
-- definer, a derivação falharia justamente sob RLS.
--
-- `search_path = ''` obriga qualificar tudo; a única interpolação é `%I` sobre
-- valores fixados na definição do trigger (nunca entrada de usuário).
create or replace function app.derive_client_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_table text := tg_argv[0];  -- tabela pai em `public`
  v_fk_column    text := tg_argv[1];  -- coluna FK nesta tabela
  v_parent_id    uuid;
  v_client_id    uuid;
begin
  execute format('select ($1).%I', v_fk_column) into v_parent_id using new;

  if v_parent_id is null then
    raise exception 'derive_client_id: %.% nao pode ser nulo',
      tg_table_name, v_fk_column
      using errcode = '23502';
  end if;

  execute format('select client_id from public.%I where id = $1', v_parent_table)
    into v_client_id using v_parent_id;

  if v_client_id is null then
    raise exception 'derive_client_id: pai % nao encontrado em public.% (tabela %)',
      v_parent_id, v_parent_table, tg_table_name
      using errcode = '23503';
  end if;

  new.client_id := v_client_id;
  return new;
end;
$$;

comment on function app.derive_client_id() is
  'BEFORE INSERT: deriva client_id do pai e descarta o valor do input. '
  'Args: (tabela_pai, coluna_fk). Ver docs/database.md#tenant.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Imutabilidade de tenant
-- ═══════════════════════════════════════════════════════════════════════════
-- Depois que uma linha pertence a um cliente, ela pertence para sempre.
-- Sem isto, uma policy de UPDATE mal escrita permitiria migrar uma linha de
-- tenant — o erro clássico de RLS descrito em docs/security.md.
create or replace function app.enforce_immutable_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_column text;
  v_old    text;
  v_new    text;
begin
  foreach v_column in array tg_argv loop
    execute format('select ($1).%I::text', v_column) into v_old using old;
    execute format('select ($1).%I::text', v_column) into v_new using new;

    if v_old is distinct from v_new then
      raise exception '%.% e imutavel (tentou % -> %)',
        tg_table_name, v_column, coalesce(v_old, 'null'), coalesce(v_new, 'null')
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$$;

comment on function app.enforce_immutable_columns() is
  'BEFORE UPDATE: rejeita alteracao das colunas passadas em TG_ARGV. '
  'Usado para client_id e project_id. Ver docs/database.md#imutabilidade.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Append-only
-- ═══════════════════════════════════════════════════════════════════════════
-- RLS sozinha não bastaria: `service_role` a ignora por definição. Um trigger
-- vale para todo mundo, inclusive para quem tem bypass.
create or replace function app.reject_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% e append-only: % nao e permitido', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

comment on function app.reject_mutation() is
  'Rejeita UPDATE/DELETE. Vale inclusive para service_role, que ignora RLS.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Espelho de auth.users
-- ═══════════════════════════════════════════════════════════════════════════
-- `auth.users` não é legível por usuário comum, então nome e e-mail são
-- replicados em `public.profiles` (docs/data-model.md#profiles).
--
-- O perfil nasce com `status = 'invited'`; o primeiro login promove para
-- `active` na FASE 3. Não existe tabela de convite (ADR-0009).
create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, invited_at)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function app.handle_new_auth_user() is
  'AFTER INSERT em auth.users: cria o profile espelho.';

create or replace function app.handle_auth_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
     set email = new.email
   where id = new.id
     and email is distinct from new.email;

  return new;
end;
$$;

comment on function app.handle_auth_user_email_change() is
  'AFTER UPDATE OF email em auth.users: mantem o espelho em dia.';
