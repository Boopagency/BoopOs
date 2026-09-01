-- ═══════════════════════════════════════════════════════════════════════════
-- CONTEÚDO — item, versão, comentário e aprovação
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A separação item ⟷ versão é a decisão mais importante deste arquivo
-- (ADR-0007, docs/spec-review.md I-03):
--
--   `content_items`    identidade e planejamento — título, canal, data
--   `content_versions` o ENTREGÁVEL — hook, caption, cta
--
-- `hook`, `caption` e `cta` NÃO podem voltar para o item. Se a legenda vivesse
-- no item, editá-la depois da aprovação destruiria o que foi aprovado.

create table public.content_items (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references public.projects (id) on delete cascade,
  client_id           uuid not null references public.clients (id) on delete restrict,
  title               text not null check (length(btrim(title)) > 0),
  channel             public.content_channel not null default 'instagram',
  format              public.content_format  not null default 'other',
  editorial_territory text,
  objective           text,
  -- Derivado pelos workflows a partir da versao corrente. Nenhuma UI escreve
  -- aqui direto (docs/spec-review.md I-04).
  status              public.content_status not null default 'idea',
  current_version_id  uuid,
  scheduled_for       timestamptz,
  published_at        timestamptz,
  -- Substitui a tabela content_publications na V0: nao ha agendador, entao
  -- data + URL bastam (docs/data-model.md).
  published_url       text,
  created_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint content_items_published_check
    check (status <> 'published' or published_at is not null)
);

comment on table public.content_items is
  'Identidade e planejamento da peca. NUNCA guarda o entregavel (ADR-0007).';

-- Os três caminhos de leitura reais do portal e do admin.
create index content_items_project_status_idx    on public.content_items (project_id, status);
create index content_items_project_scheduled_idx on public.content_items (project_id, scheduled_for);
create index content_items_client_status_idx     on public.content_items (client_id, status);

-- ───────────────────────────────────────────────────────────────────────────
create table public.content_versions (
  id                   uuid primary key default gen_random_uuid(),
  content_item_id      uuid not null references public.content_items (id) on delete cascade,
  client_id            uuid not null references public.clients (id) on delete restrict,
  version              int  not null check (version >= 1),
  status               public.content_version_status not null default 'draft',
  hook                 text,
  caption              text,
  cta                  text,
  -- Nota da equipe. NUNCA exposta a client_user (docs/security.md).
  internal_notes       text,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  sent_for_approval_at timestamptz,
  approved_at          timestamptz,

  constraint content_versions_number_unique unique (content_item_id, version),
  -- A visibilidade para o cliente e `sent_for_approval_at is not null`:
  -- simples, auditavel e imune a mudancas futuras no enum de status
  -- (docs/data-model.md).
  constraint content_versions_sent_check
    check (status = 'draft' or sent_for_approval_at is not null)
);

comment on column public.content_versions.internal_notes is
  'Interno. Nunca alcanca o portal do cliente.';
comment on column public.content_versions.sent_for_approval_at is
  'Nulo = o cliente nunca viu esta versao. E o criterio de visibilidade.';

create index content_versions_item_idx on public.content_versions (content_item_id, version desc);
create index content_versions_client_idx on public.content_versions (client_id);

alter table public.content_items
  add constraint content_items_current_version_fkey
  foreign key (current_version_id) references public.content_versions (id)
  on delete set null
  deferrable initially deferred;

-- ───────────────────────────────────────────────────────────────────────────
-- Comentários
-- ───────────────────────────────────────────────────────────────────────────
create table public.content_comments (
  id                 uuid primary key default gen_random_uuid(),
  content_item_id    uuid not null references public.content_items (id) on delete cascade,
  -- Nulo = comentário sobre a peça, não sobre uma versão específica.
  content_version_id uuid references public.content_versions (id) on delete set null,
  client_id          uuid not null references public.clients (id) on delete restrict,
  author_id          uuid references public.profiles (id) on delete set null,
  body               text not null check (length(btrim(body)) > 0),
  -- true = conversa da equipe. O client_user nunca le nem escreve isto:
  -- garantido por RLS (with check) na FASE 4 e pelo workflow.
  is_internal        boolean not null default false,
  created_at         timestamptz not null default now()
);

comment on column public.content_comments.is_internal is
  'true nunca alcanca o portal do cliente (docs/security.md).';

-- O portal lista comentários públicos de uma peça, em ordem.
create index content_comments_item_idx
  on public.content_comments (content_item_id, created_at)
  where not is_internal;

create index content_comments_item_all_idx on public.content_comments (content_item_id, created_at);

-- ───────────────────────────────────────────────────────────────────────────
-- Aprovações
-- ───────────────────────────────────────────────────────────────────────────
create table public.content_approvals (
  id                 uuid primary key default gen_random_uuid(),
  content_version_id uuid not null references public.content_versions (id) on delete cascade,
  client_id          uuid not null references public.clients (id) on delete restrict,
  decided_by         uuid references public.profiles (id) on delete set null,
  decision           public.approval_decision not null,
  note               text,
  created_at         timestamptz not null default now()
);

comment on table public.content_approvals is
  'Decisao do cliente sobre uma VERSAO. So client_user aprova — nem boop_admin '
  '(docs/permissions.md).';

-- O duplo clique em "Aprovar" no celular é o caso comum, não o ataque:
-- a segunda chamada não cria um segundo registro.
create unique index content_approvals_one_approved_idx
  on public.content_approvals (content_version_id)
  where decision = 'approved';

create index content_approvals_version_idx
  on public.content_approvals (content_version_id, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- Triggers
-- ───────────────────────────────────────────────────────────────────────────
create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function app.set_updated_at();

create trigger content_versions_set_updated_at
  before update on public.content_versions
  for each row execute function app.set_updated_at();

create trigger content_items_derive_client
  before insert on public.content_items
  for each row execute function app.derive_client_id('projects', 'project_id');

create trigger content_versions_derive_client
  before insert on public.content_versions
  for each row execute function app.derive_client_id('content_items', 'content_item_id');

create trigger content_comments_derive_client
  before insert on public.content_comments
  for each row execute function app.derive_client_id('content_items', 'content_item_id');

create trigger content_approvals_derive_client
  before insert on public.content_approvals
  for each row execute function app.derive_client_id('content_versions', 'content_version_id');

create trigger content_items_immutable_tenant
  before update on public.content_items
  for each row execute function app.enforce_immutable_columns('client_id', 'project_id');

create trigger content_versions_immutable_tenant
  before update on public.content_versions
  for each row execute function app.enforce_immutable_columns('client_id', 'content_item_id', 'version');
