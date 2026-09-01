-- ═══════════════════════════════════════════════════════════════════════════
-- ESTRATÉGIA — documento versionado e aprovação por versão
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Regra que organiza este arquivo (ADR-0007): a aprovação pertence à VERSÃO,
-- nunca ao documento. Criar a v2 não invalida o registro de que alguém
-- aprovou a v1 — ele continua lá, com nome e data.

create table public.strategies (
  id                 uuid primary key default gen_random_uuid(),
  -- Um projeto, uma estratégia. As revisões viram versões, não documentos.
  project_id         uuid not null unique references public.projects (id) on delete cascade,
  client_id          uuid not null references public.clients (id) on delete restrict,
  title              text not null default 'Direção editorial',
  -- FK adicionada no fim do arquivo: referencia circular com strategy_versions.
  current_version_id uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.strategies is
  'Documento de estrategia do projeto. O conteudo vive nas versoes (ADR-0007).';

create index strategies_client_idx on public.strategies (client_id);

-- ───────────────────────────────────────────────────────────────────────────
create table public.strategy_versions (
  id         uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies (id) on delete cascade,
  client_id  uuid not null references public.clients (id) on delete restrict,
  version    int  not null check (version >= 1),
  status     public.strategy_version_status not null default 'draft',
  summary    text,
  -- Documento editorial estruturado, validado por zod (StrategyContentSchema).
  -- Modelar cada bloco como tabela seria rigidez sem retorno: e um documento
  -- para ler, nao um agregado para consultar (docs/data-model.md).
  content    jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at    timestamptz,
  approved_at timestamptz,

  constraint strategy_versions_number_unique unique (strategy_id, version),
  constraint strategy_versions_content_object check (jsonb_typeof(content) = 'object'),
  -- Uma versão que saiu para o cliente tem que ter saído em algum momento.
  constraint strategy_versions_sent_check
    check (status = 'draft' or sent_at is not null)
);

comment on column public.strategy_versions.status is
  'draft nunca alcanca o cliente. Ver docs/security.md.';

create index strategy_versions_strategy_idx on public.strategy_versions (strategy_id, version desc);
create index strategy_versions_client_status_idx on public.strategy_versions (client_id, status);

-- Referência circular: a estratégia aponta para a versão corrente, e a versão
-- pertence à estratégia. DEFERRABLE para permitir criar as duas na mesma
-- transação sem ordem imposta.
alter table public.strategies
  add constraint strategies_current_version_fkey
  foreign key (current_version_id) references public.strategy_versions (id)
  on delete set null
  deferrable initially deferred;

-- ───────────────────────────────────────────────────────────────────────────
-- Aprovações
-- ───────────────────────────────────────────────────────────────────────────
create table public.strategy_approvals (
  id                  uuid primary key default gen_random_uuid(),
  strategy_version_id uuid not null references public.strategy_versions (id) on delete cascade,
  client_id           uuid not null references public.clients (id) on delete restrict,
  -- SET NULL: se a pessoa sair da empresa, a decisão continua existindo.
  -- Apagar a aprovação junto seria reescrever o histórico.
  decided_by          uuid references public.profiles (id) on delete set null,
  decision            public.approval_decision not null,
  -- Onde vive o texto do "solicitar ajuste". Nao existe strategy_comments na
  -- V0: uma tabela inteira para isso seria desproporcional
  -- (docs/spec-review.md I-11).
  note                text,
  created_at          timestamptz not null default now()
);

comment on table public.strategy_approvals is
  'Decisao do cliente sobre uma VERSAO. Escrita apenas por funcao SQL na '
  'FASE 11 — nunca direto pela API (docs/security.md).';

-- Uma única aprovação válida por versão. É o que faz o duplo clique no
-- celular devolver sucesso em vez de duas aprovações
-- (docs/workflows.md#idempotência).
create unique index strategy_approvals_one_approved_idx
  on public.strategy_approvals (strategy_version_id)
  where decision = 'approved';

create index strategy_approvals_version_idx on public.strategy_approvals (strategy_version_id, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- Triggers
-- ───────────────────────────────────────────────────────────────────────────
create trigger strategies_set_updated_at
  before update on public.strategies
  for each row execute function app.set_updated_at();

create trigger strategy_versions_set_updated_at
  before update on public.strategy_versions
  for each row execute function app.set_updated_at();

create trigger strategies_derive_client
  before insert on public.strategies
  for each row execute function app.derive_client_id('projects', 'project_id');

create trigger strategy_versions_derive_client
  before insert on public.strategy_versions
  for each row execute function app.derive_client_id('strategies', 'strategy_id');

create trigger strategy_approvals_derive_client
  before insert on public.strategy_approvals
  for each row execute function app.derive_client_id('strategy_versions', 'strategy_version_id');

create trigger strategies_immutable_tenant
  before update on public.strategies
  for each row execute function app.enforce_immutable_columns('client_id', 'project_id');

create trigger strategy_versions_immutable_tenant
  before update on public.strategy_versions
  for each row execute function app.enforce_immutable_columns('client_id', 'strategy_id', 'version');
