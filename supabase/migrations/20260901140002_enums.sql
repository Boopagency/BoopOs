-- ═══════════════════════════════════════════════════════════════════════════
-- ENUMS — taxonomias do Marco 1
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Espelhados em `src/config/enums.ts`. Um teste de paridade lê `pg_enum` e
-- falha se os dois divergirem (ADR-0003).
--
-- Só entram aqui as taxonomias das FASES 0–11. Arquivo, reunião, métrica e
-- review têm enums próprios que chegam nas suas fases — trazê-los agora seria
-- schema sem requisito.

-- ── Identidade e acesso ────────────────────────────────────────────────────

-- Papel GLOBAL. O escopo vem de client_memberships, não daqui (ADR-0005).
create type public.user_role as enum (
  'boop_admin',
  'boop_member',
  'client_user'
);

-- Ciclo de vida do acesso. `disabled` derruba o acesso no request seguinte.
create type public.profile_status as enum (
  'invited',
  'active',
  'disabled'
);

create type public.client_status as enum (
  'active',
  'paused',
  'archived'
);

-- ── Projeto ────────────────────────────────────────────────────────────────

create type public.project_type as enum (
  'social',
  'website',
  'branding',
  'automation',
  'custom'
);

-- Eixo INDEPENDENTE da etapa da jornada. Um projeto pausado está pausado em
-- alguma etapa; misturar os dois perderia essa informacao
-- (docs/spec-review.md I-01).
create type public.project_status as enum (
  'draft',
  'active',
  'paused',
  'completed',
  'archived'
);

create type public.stage_state as enum (
  'pending',
  'current',
  'done',
  'skipped'
);

-- ── Onboarding ─────────────────────────────────────────────────────────────

-- `file` existe desde a primeira migration mas so e renderizado a partir da
-- FASE 12 (docs/spec-review.md I-05). Esta aqui porque acrescentar valor a um
-- enum depois e barato, mas mudar o contrato dos templates ja escritos nao e.
create type public.question_type as enum (
  'short_text',
  'long_text',
  'single_select',
  'multi_select',
  'boolean',
  'number',
  'url',
  'file'
);

create type public.onboarding_status as enum (
  'draft',
  'submitted'
);

-- ── Estratégia e conteúdo ──────────────────────────────────────────────────

-- A aprovacao pertence a VERSAO, nunca ao documento (ADR-0007).
create type public.strategy_version_status as enum (
  'draft',
  'awaiting_client',
  'changes_requested',
  'approved',
  'superseded'
);

create type public.content_channel as enum (
  'instagram',
  'linkedin',
  'tiktok',
  'youtube',
  'blog',
  'other'
);

create type public.content_format as enum (
  'reel',
  'carousel',
  'static',
  'story',
  'video',
  'article',
  'other'
);

-- Posicao no pipeline. Derivado pelos workflows a partir da versao corrente —
-- nenhuma UI escreve direto (docs/spec-review.md I-04).
create type public.content_status as enum (
  'idea',
  'planned',
  'in_production',
  'internal_review',
  'awaiting_client',
  'changes_requested',
  'approved',
  'scheduled',
  'published',
  'archived'
);

create type public.content_version_status as enum (
  'draft',
  'awaiting_client',
  'changes_requested',
  'approved',
  'superseded'
);

-- Duas decisoes possiveis, e so o cliente as toma (docs/permissions.md).
create type public.approval_decision as enum (
  'approved',
  'changes_requested'
);

-- ── Sistema ────────────────────────────────────────────────────────────────

-- Nasce pronto para o feed do cliente (D-05), sem reclassificar historico.
create type public.activity_visibility as enum (
  'internal',
  'client'
);

create type public.notification_status as enum (
  'pending',
  'sent',
  'failed'
);
