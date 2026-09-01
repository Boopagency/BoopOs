-- ═══════════════════════════════════════════════════════════════════════════
-- NÚCLEO — profiles, clients, client_memberships, projects, project_stages
-- ═══════════════════════════════════════════════════════════════════════════
--
-- É aqui que a multi-tenancy nasce: `clients` é o tenant, `projects` pertence
-- a um cliente, e `client_memberships` concede escopo. Ver docs/data-model.md.

-- ───────────────────────────────────────────────────────────────────────────
-- profiles — espelho legível de auth.users
-- ───────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  role         public.user_role      not null default 'client_user',
  status       public.profile_status not null default 'invited',
  full_name    text,
  email        public.citext         not null,
  avatar_url   text,
  invited_at   timestamptz,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Espelho de auth.users legivel pela aplicacao. O papel e GLOBAL; o escopo '
  'vem de client_memberships (ADR-0005).';
comment on column public.profiles.role is
  'Papel global. boop_admin ve tudo; boop_member e client_user dependem de vinculo (D-08).';
comment on column public.profiles.email is
  'Replicado de auth.users por trigger — auth.users nao e legivel por usuario comum.';

-- `citext` já garante unicidade case-insensitive de e-mail.
create unique index profiles_email_key on public.profiles (email);

-- Listagem administrativa filtra por papel e por status ativo.
create index profiles_role_status_idx on public.profiles (role, status);

-- ───────────────────────────────────────────────────────────────────────────
-- clients — O TENANT
-- ───────────────────────────────────────────────────────────────────────────
create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(btrim(name)) > 0),
  slug       public.citext not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status     public.client_status not null default 'active',
  notes      text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.clients is
  'O tenant. Toda linha de dominio do sistema pertence a exatamente um cliente.';
comment on column public.clients.slug is
  'Uso interno. NAO aparece em URL do portal — as rotas usam o id do projeto.';
comment on column public.clients.notes is
  'Anotacao interna da Boop. NUNCA exposta a client_user (docs/security.md).';

-- ───────────────────────────────────────────────────────────────────────────
-- client_memberships — concede ESCOPO, não papel
-- ───────────────────────────────────────────────────────────────────────────
create table public.client_memberships (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id)  on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),

  -- Convidar duas vezes a mesma pessoa para o mesmo cliente é idempotente,
  -- não duplicado (docs/workflows.md#idempotência).
  constraint client_memberships_unique unique (client_id, user_id)
);

comment on table public.client_memberships is
  'Vinculo pessoa <-> cliente. Concede escopo, nunca papel. Suporta D-08: '
  'boop_admin global, boop_member por vinculo, client_user no proprio tenant.';

-- O índice mais consultado do sistema: quase toda policy da FASE 4 vai
-- perguntar "este usuário tem vínculo com este cliente?".
create index client_memberships_user_client_idx
  on public.client_memberships (user_id, client_id);

-- ───────────────────────────────────────────────────────────────────────────
-- projects
-- ───────────────────────────────────────────────────────────────────────────
create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  -- RESTRICT: apagar um cliente com projeto apagaria histórico de entrega.
  -- Arquivar é a operação correta; excluir exige limpar os projetos antes.
  client_id   uuid not null references public.clients (id) on delete restrict,
  name        text not null check (length(btrim(name)) > 0),
  type        public.project_type   not null,
  status      public.project_status not null default 'draft',
  -- Chave do template de jornada em codigo (ex.: 'social.v1'), imutavel:
  -- trocar o template nao pode reescrever as etapas ja materializadas
  -- (ADR-0006).
  journey_key text not null check (length(btrim(journey_key)) > 0),
  cycle       int  not null default 1 check (cycle >= 1),
  starts_on   date,
  ends_on     date,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint projects_period_check check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

comment on table public.projects is
  'Projeto de um cliente. status e a etapa da jornada sao eixos independentes '
  '(docs/spec-review.md I-01).';
comment on column public.projects.cycle is
  'Ciclo editorial corrente. Publicar um review incrementa e reabre as etapas '
  'recorrentes (docs/spec-review.md I-02).';

create index projects_client_status_idx on public.projects (client_id, status);

-- ───────────────────────────────────────────────────────────────────────────
-- project_stages — instância da jornada
-- ───────────────────────────────────────────────────────────────────────────
create table public.project_stages (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  stage_key    text not null check (length(btrim(stage_key)) > 0),
  -- Snapshot do rótulo à época: mudar o template não reescreve o histórico.
  label        text not null check (length(btrim(label)) > 0),
  position     int  not null check (position > 0),
  state        public.stage_state not null default 'pending',
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint project_stages_key_unique      unique (project_id, stage_key),
  constraint project_stages_position_unique unique (project_id, position),
  constraint project_stages_done_check
    check (state <> 'done' or completed_at is not null)
);

comment on table public.project_stages is
  'Etapas materializadas da jornada. O template vive em codigo (ADR-0006).';

-- No máximo uma etapa corrente por projeto — garantido pelo banco, não pela
-- aplicação. A jornada não é barra de progresso: é onde estamos agora.
create unique index project_stages_one_current_idx
  on public.project_stages (project_id)
  where state = 'current';

-- ───────────────────────────────────────────────────────────────────────────
-- Triggers
-- ───────────────────────────────────────────────────────────────────────────
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function app.set_updated_at();

create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function app.set_updated_at();

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function app.set_updated_at();

create trigger project_stages_set_updated_at
  before update on public.project_stages
  for each row execute function app.set_updated_at();

-- Um projeto nunca muda de cliente. Um vínculo nunca muda de lado.
create trigger projects_immutable_tenant
  before update on public.projects
  for each row execute function app.enforce_immutable_columns('client_id');

create trigger client_memberships_immutable
  before update on public.client_memberships
  for each row execute function app.enforce_immutable_columns('client_id', 'user_id');

create trigger project_stages_immutable_project
  before update on public.project_stages
  for each row execute function app.enforce_immutable_columns('project_id');

-- ───────────────────────────────────────────────────────────────────────────
-- Espelho de auth.users
-- ───────────────────────────────────────────────────────────────────────────
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function app.handle_auth_user_email_change();
