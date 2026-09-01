-- ═══════════════════════════════════════════════════════════════════════════
-- ONBOARDING — templates schema-driven e respostas do cliente
-- ═══════════════════════════════════════════════════════════════════════════
--
-- O formulário vem do banco, não do código (docs/product.md). Na V0 os
-- templates nascem por migration/seed: não há editor de formulário, e
-- construir um seria overengineering (docs/spec-review.md §4).

-- ───────────────────────────────────────────────────────────────────────────
-- Template — não pertence a tenant nenhum: é da Boop, servido a todos
-- ───────────────────────────────────────────────────────────────────────────
create table public.onboarding_templates (
  id           uuid primary key default gen_random_uuid(),
  key          public.citext not null,
  name         text not null check (length(btrim(name)) > 0),
  project_type public.project_type not null,
  version      int  not null default 1 check (version >= 1),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint onboarding_templates_key_version_unique unique (key, version)
);

comment on table public.onboarding_templates is
  'Formulario de onboarding. Nao tem client_id: e da Boop, nao de um cliente.';

-- Só um template ativo por (chave, tipo de projeto): sem isso, "qual
-- formulário abrir?" viraria ambíguo na FASE 7.
create unique index onboarding_templates_active_idx
  on public.onboarding_templates (key, project_type)
  where is_active;

create table public.onboarding_sections (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.onboarding_templates (id) on delete cascade,
  key         text not null check (length(btrim(key)) > 0),
  title       text not null check (length(btrim(title)) > 0),
  -- A fala que abre a secao. E o que torna o onboarding conversacional em vez
  -- de formulario (docs/product.md).
  description text,
  position    int  not null check (position > 0),
  created_at  timestamptz not null default now(),

  constraint onboarding_sections_key_unique      unique (template_id, key),
  constraint onboarding_sections_position_unique unique (template_id, position)
);

create table public.onboarding_questions (
  id          uuid primary key default gen_random_uuid(),
  section_id  uuid not null references public.onboarding_sections (id) on delete cascade,
  key         text not null check (length(btrim(key)) > 0),
  label       text not null check (length(btrim(label)) > 0),
  help_text   text,
  type        public.question_type not null,
  is_required boolean not null default false,
  -- Alternativas de single_select/multi_select. jsonb porque o formato varia
  -- com o tipo da pergunta e nunca e consultado relacionalmente.
  options     jsonb,
  position    int not null check (position > 0),
  created_at  timestamptz not null default now(),

  constraint onboarding_questions_key_unique      unique (section_id, key),
  constraint onboarding_questions_position_unique unique (section_id, position),
  -- Pergunta de escolha sem alternativa é um template quebrado.
  constraint onboarding_questions_options_check check (
    (type in ('single_select', 'multi_select') and jsonb_typeof(options) = 'array')
    or (type not in ('single_select', 'multi_select'))
  )
);

create index onboarding_questions_section_idx
  on public.onboarding_questions (section_id, position);

-- ───────────────────────────────────────────────────────────────────────────
-- Submissão — aqui o tenant entra
-- ───────────────────────────────────────────────────────────────────────────
create table public.onboarding_submissions (
  id           uuid primary key default gen_random_uuid(),
  -- Um onboarding por projeto na V0. Reabrir usa `reopenOnboarding`, não uma
  -- segunda submissão (docs/workflows.md).
  project_id   uuid not null unique references public.projects (id) on delete cascade,
  -- Derivado por trigger a partir de project_id. NUNCA aceito do input.
  client_id    uuid not null references public.clients (id) on delete restrict,
  -- RESTRICT: apagar um template apagaria o significado das respostas.
  template_id  uuid not null references public.onboarding_templates (id) on delete restrict,
  status       public.onboarding_status not null default 'draft',
  started_at   timestamptz,
  submitted_at timestamptz,
  submitted_by uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint onboarding_submissions_submitted_check
    check (status <> 'submitted' or submitted_at is not null)
);

comment on column public.onboarding_submissions.client_id is
  'Derivado de project_id por trigger e imutavel. Ver docs/database.md#tenant.';

create index onboarding_submissions_client_idx on public.onboarding_submissions (client_id);

-- ───────────────────────────────────────────────────────────────────────────
-- Respostas
-- ───────────────────────────────────────────────────────────────────────────
create table public.onboarding_answers (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.onboarding_submissions (id) on delete cascade,
  -- RESTRICT: a resposta perde o sentido sem a pergunta.
  question_id   uuid not null references public.onboarding_questions (id) on delete restrict,
  -- jsonb uniformiza todos os tipos: texto vira "…", multipla escolha vira
  -- ["a","b"], arquivo vira {"file_id":"…"}. A validacao por tipo acontece em
  -- zod, na aplicacao (docs/data-model.md).
  value         jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- É o que torna o autosave idempotente: um upsert nesta chave, quantas
  -- vezes o debounce disparar (docs/workflows.md#idempotência).
  constraint onboarding_answers_unique unique (submission_id, question_id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- Triggers
-- ───────────────────────────────────────────────────────────────────────────
create trigger onboarding_templates_set_updated_at
  before update on public.onboarding_templates
  for each row execute function app.set_updated_at();

create trigger onboarding_submissions_set_updated_at
  before update on public.onboarding_submissions
  for each row execute function app.set_updated_at();

create trigger onboarding_answers_set_updated_at
  before update on public.onboarding_answers
  for each row execute function app.set_updated_at();

create trigger onboarding_submissions_derive_client
  before insert on public.onboarding_submissions
  for each row execute function app.derive_client_id('projects', 'project_id');

create trigger onboarding_submissions_immutable_tenant
  before update on public.onboarding_submissions
  for each row execute function app.enforce_immutable_columns('client_id', 'project_id');

create trigger onboarding_answers_immutable
  before update on public.onboarding_answers
  for each row execute function app.enforce_immutable_columns('submission_id', 'question_id');
