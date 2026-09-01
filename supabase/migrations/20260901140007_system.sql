-- ═══════════════════════════════════════════════════════════════════════════
-- SISTEMA — activity_log e notifications
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- activity_log — APPEND-ONLY
-- ───────────────────────────────────────────────────────────────────────────
-- Um log que pode ser editado não é auditoria (ADR-0012). Aqui não há UPDATE
-- nem DELETE para ninguém — nem para boop_admin, nem para service_role.
-- Corrigir um evento errado se faz com um evento novo.
create table public.activity_log (
  id          bigint generated always as identity primary key,
  -- Nulo quando a acao e do sistema (cron, automacao).
  --
  -- RESTRICT, e nao SET NULL: uma tabela append-only nao pode participar de
  -- `on delete set null`, porque o proprio SET NULL e um UPDATE e os triggers
  -- abaixo rejeitam UPDATE de todo mundo. As duas regras juntas nao cabem.
  --
  -- Escolhemos manter a imutabilidade e aceitar a consequencia: quem deixou
  -- rastro nao e apagado, e desabilitado (`profile_status = 'disabled'`), que
  -- ja e o ciclo de vida do produto (ADR-0009). Se um dia for preciso apagar
  -- de verdade, o caminho e anonimizar a linha de `profiles` — nunca reescrever
  -- o log (docs/spec-review.md I-12).
  actor_id    uuid references public.profiles (id) on delete restrict,
  -- Nulo em eventos globais. RESTRICT: apagar um cliente nao pode apagar a
  -- trilha do que aconteceu com ele.
  client_id   uuid references public.clients (id)  on delete restrict,
  project_id  uuid references public.projects (id) on delete restrict,
  entity_type text not null check (length(btrim(entity_type)) > 0),
  entity_id   uuid,
  -- Do catalogo em src/config/activity.ts: dominio.verbo_no_passado.
  action      text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  -- IDs e transicoes de estado. NUNCA conteudo, NUNCA PII, NUNCA segredo —
  -- e a regra que mantem o log seguro para exposicao futura ao cliente.
  metadata    jsonb not null default '{}'::jsonb,
  -- Nasce pronto para o feed do cliente (D-05), sem reclassificar historico.
  visibility  public.activity_visibility not null default 'internal',
  request_id  text,
  created_at  timestamptz not null default now(),

  constraint activity_log_metadata_object check (jsonb_typeof(metadata) = 'object')
);

comment on table public.activity_log is
  'Auditoria append-only. Sem UPDATE, sem DELETE, para ninguem (ADR-0012).';
comment on column public.activity_log.metadata is
  'Identificadores e transicoes. NUNCA conteudo, PII ou segredo.';

create index activity_log_client_idx  on public.activity_log (client_id, created_at desc);
create index activity_log_project_idx on public.activity_log (project_id, created_at desc);
create index activity_log_entity_idx  on public.activity_log (entity_type, entity_id);

-- RLS sozinha não garantiria append-only: `service_role` a ignora. Trigger
-- vale para todo mundo.
create trigger activity_log_no_update
  before update on public.activity_log
  for each row execute function app.reject_mutation();

create trigger activity_log_no_delete
  before delete on public.activity_log
  for each row execute function app.reject_mutation();

-- ───────────────────────────────────────────────────────────────────────────
-- notifications — registro de envio
-- ───────────────────────────────────────────────────────────────────────────
-- Todo envio grava a linha ANTES de tentar: pending → sent | failed. Nada sai
-- sem rastro, e falha nunca é silenciosa (.claude/rules/integrations.md).
create table public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid references public.clients (id)  on delete restrict,
  project_id          uuid references public.projects (id) on delete restrict,
  recipient_user_id   uuid references public.profiles (id) on delete set null,
  recipient_email     public.citext not null,
  template            text not null check (length(btrim(template)) > 0),
  -- Contexto minimo para montar o e-mail. NUNCA o corpo, NUNCA dado sensivel.
  payload             jsonb not null default '{}'::jsonb,
  status              public.notification_status not null default 'pending',
  -- Idempotencia dos side-effects: 'content.awaiting_client:{versionId}'
  -- garante que reexecutar o workflow nao dispara dois avisos.
  dedupe_key          text unique,
  provider_message_id text,
  error               text,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,

  constraint notifications_payload_object check (jsonb_typeof(payload) = 'object'),
  constraint notifications_sent_check   check (status <> 'sent'   or sent_at is not null),
  constraint notifications_failed_check check (status <> 'failed' or error   is not null)
);

comment on table public.notifications is
  'Registro de envio (e-mail na V0). Grava antes de tentar; falha fica visivel.';
comment on column public.notifications.dedupe_key is
  'Chave de idempotencia do side-effect (docs/workflows.md).';

-- A fila de reenvio da FASE 16 lê exatamente por isto.
create index notifications_status_idx on public.notifications (status, created_at)
  where status in ('pending', 'failed');

create index notifications_client_idx on public.notifications (client_id, created_at desc);
