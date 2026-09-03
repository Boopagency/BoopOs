# Modelo de dados — Boop OS V0

Postgres no Supabase. **É a fonte única da verdade.** Nada de estado de domínio
vivendo apenas no frontend, no Notion ou no Vercel.

> **Desde a FASE 2 este documento é o projeto, não o estado.** O schema que
> existe de verdade está em `supabase/migrations/*.sql`; divergiu, manda a
> migration. Como rodar, testar e conferir o banco:
> [`database.md`](database.md).

Convenções gerais:

- PK `uuid` com `gen_random_uuid()`, exceto `activity_log` (`bigint identity`).
- `created_at`/`updated_at` sempre `timestamptz not null default now()`;
  `updated_at` mantido por trigger.
- Enums do Postgres para taxonomias ([ADR-0003](adr/0003-enums-no-postgres.md)),
  espelhados em `src/config/enums.ts` com teste de paridade.
- `client_id` denormalizado nas tabelas-folha para simplificar RLS e índices.
  **Sempre derivado por trigger a partir do pai** — nunca aceito do input.
- `client_id` e `project_id` são **imutáveis** após o insert (trigger
  `app.enforce_immutable_columns`).
- Toda tabela com RLS habilitada e políticas explícitas para SELECT, INSERT,
  UPDATE e DELETE. Ver [`security.md`](security.md). **Na FASE 2 a RLS foi
  ligada sem nenhuma policy** — negação por padrão; as políticas são a FASE 4.

---

## ERD — Marco 1 (FASES 0–11)

> `files` e `meetings` aparecem no diagrama porque encostam no Marco 1, mas
> nascem nas FASES 12 e 13 — a FASE 2 não as criou. Ver
> [`spec-review.md` I-13](spec-review.md).

```
auth.users ──1:1──▶ profiles
                       │
                       ├──< client_memberships >── clients
                       │                              │
                       │                              ▼
                       │                          projects ──< project_stages
                       │                              │
                       │            ┌─────────────────┼──────────────────┐
                       │            ▼                 ▼                  ▼
                       │   onboarding_submissions  strategies       content_items
                       │            │                 │                  │
                       │            ▼                 ▼                  ▼
                       │   onboarding_answers   strategy_versions   content_versions
                       │            │                 │                  │
                       │            │                 ▼                  ├──< content_comments
                       │            │          strategy_approvals        └──< content_approvals
                       │            │
                       │   onboarding_templates ──< onboarding_sections ──< onboarding_questions
                       │            ▲                                              │
                       │            └──────────────────────────────────────────────┘
                       │
                       ├──< activity_log        (append-only)
                       └──< notifications       (log de envio)

                            files       (polimórfica: entity_type + entity_id)
                            meetings
```

## ERD — restante da V0 (FASES 12–20)

```
projects ──< account_metrics
content_items ──< content_metrics
projects ──< monthly_reviews
```

---

## Tabelas

### Núcleo

#### `profiles`

Espelho de `auth.users` legível pela aplicação. `auth.users` não é consultável
por usuário comum, então nome e e-mail são replicados por trigger.

| Coluna                      | Tipo              | Notas                                                             |
| --------------------------- | ----------------- | ----------------------------------------------------------------- |
| `id`                        | `uuid` PK         | FK → `auth.users(id)` ON DELETE CASCADE                           |
| `role`                      | `user_role`       | `boop_admin \| boop_member \| client_user`, default `client_user` |
| `status`                    | `profile_status`  | `invited \| active \| disabled`, default `invited`                |
| `full_name`                 | `text`            |                                                                   |
| `email`                     | `citext not null` | sincronizado de `auth.users` por trigger                          |
| `avatar_url`                | `text`            |                                                                   |
| `invited_at`                | `timestamptz`     |                                                                   |
| `last_seen_at`              | `timestamptz`     | atualizado no máximo 1×/hora                                      |
| `created_at` / `updated_at` | `timestamptz`     |                                                                   |

Não existe tabela de convite: convidar = criar o usuário em `auth.users`, criar o
`profiles` com `status='invited'` e criar o vínculo. `user.joined` é registrado no
primeiro login. Ver [ADR-0009](adr/0009-autenticacao-magic-link-e-convites.md).

#### `clients`

O **tenant**. Toda linha do sistema pertence a exatamente um cliente.

| Coluna                      | Tipo                     | Notas                                         |
| --------------------------- | ------------------------ | --------------------------------------------- |
| `id`                        | `uuid` PK                |                                               |
| `name`                      | `text not null`          |                                               |
| `slug`                      | `citext not null unique` | uso interno; **não** aparece em URL do portal |
| `status`                    | `client_status`          | `active \| paused \| archived`                |
| `notes`                     | `text`                   | interno, nunca exposto a `client_user`        |
| `created_by`                | `uuid`                   | FK → `profiles(id)`                           |
| `created_at` / `updated_at` |                          |                                               |

#### `client_memberships`

Concede **escopo**, não papel. O papel é global, em `profiles.role`.

| Coluna                     | Tipo            | Notas                             |
| -------------------------- | --------------- | --------------------------------- |
| `id`                       | `uuid` PK       |                                   |
| `client_id`                | `uuid not null` | FK → `clients` ON DELETE CASCADE  |
| `user_id`                  | `uuid not null` | FK → `profiles` ON DELETE CASCADE |
| `created_by`, `created_at` |                 |                                   |

`unique (client_id, user_id)` · índice `(user_id, client_id)` — é o índice mais
consultado do sistema, avaliado em quase toda policy.

#### `projects`

| Coluna                                   | Tipo                     | Notas                                                   |
| ---------------------------------------- | ------------------------ | ------------------------------------------------------- |
| `id`                                     | `uuid` PK                |                                                         |
| `client_id`                              | `uuid not null`          | FK → `clients` ON DELETE RESTRICT                       |
| `name`                                   | `text not null`          |                                                         |
| `type`                                   | `project_type`           | `social \| website \| branding \| automation \| custom` |
| `status`                                 | `project_status`         | `draft \| active \| paused \| completed \| archived`    |
| `journey_key`                            | `text not null`          | ex.: `social.v1`; imutável após criação                 |
| `cycle`                                  | `int not null default 1` | incrementado ao publicar um review                      |
| `starts_on` / `ends_on`                  | `date`                   |                                                         |
| `created_by`, `created_at`, `updated_at` |                          |                                                         |

#### `project_stages`

Instância da jornada. O template está em código.

| Coluna                        | Tipo            | Notas                                   |
| ----------------------------- | --------------- | --------------------------------------- |
| `id`                          | `uuid` PK       |                                         |
| `project_id`                  | `uuid not null` | FK → `projects` ON DELETE CASCADE       |
| `stage_key`                   | `text not null` | do template                             |
| `label`                       | `text not null` | snapshot do rótulo à época              |
| `position`                    | `int not null`  |                                         |
| `state`                       | `stage_state`   | `pending \| current \| done \| skipped` |
| `started_at` / `completed_at` | `timestamptz`   |                                         |

`unique (project_id, stage_key)` ·
`unique index on (project_id) where state = 'current'` — no máximo uma etapa
corrente por projeto, garantido pelo banco.

### Onboarding

#### `onboarding_templates`

`id` · `key citext unique` · `name` · `project_type` · `version int` ·
`is_active bool` · `created_at`.
Templates são criados por migration/seed na V0 — não há editor de formulário.

#### `onboarding_sections`

`id` · `template_id` FK CASCADE · `key` · `title` · `description` · `position`.
`unique (template_id, key)`, `unique (template_id, position)`.

#### `onboarding_questions`

`id` · `section_id` FK CASCADE · `key` · `label` · `help_text` ·
`type question_type` · `is_required bool` · `options jsonb` · `position`.
`unique (section_id, key)`.

`question_type`: `short_text · long_text · single_select · multi_select ·
boolean · number · url · file`.
`file` existe no enum desde a primeira migration, mas só é renderizado a partir
da FASE 12 ([spec-review I-05](spec-review.md#i-05-a-onboarding-com-pergunta-do-tipo-file-chega-antes-de-arquivos)).

#### `onboarding_submissions`

`id` · `project_id` FK **unique** · `client_id` (derivado) · `template_id` ·
`status onboarding_status` (`draft | submitted`) · `started_at` · `submitted_at` ·
`submitted_by` · `created_at` · `updated_at`.

#### `onboarding_answers`

`id` · `submission_id` FK CASCADE · `question_id` FK RESTRICT · `value jsonb` ·
`updated_at`. `unique (submission_id, question_id)`.

`value` em `jsonb` uniformiza todos os tipos: texto vira `"..."`, múltipla escolha
vira `["a","b"]`, arquivo vira `{"file_id":"…"}`. O autosave é um `upsert` na
chave `(submission_id, question_id)` — idempotente por construção. A validação
por tipo acontece em zod, na aplicação.

### Estratégia

#### `strategies`

`id` · `project_id` FK **unique** · `client_id` · `title` ·
`current_version_id` · `created_at` · `updated_at`.
Um projeto tem uma estratégia; a estratégia tem N versões.

#### `strategy_versions`

`id` · `strategy_id` FK CASCADE · `client_id` · `version int` ·
`status strategy_version_status` (`draft | awaiting_client | changes_requested |
approved | superseded`) · `summary text` · `content jsonb` · `created_by` ·
`created_at` · `sent_at` · `approved_at`.
`unique (strategy_id, version)`.

`content` é um documento estruturado validado por zod
(`StrategyContentSchema`): blocos `context`, `understanding`, `opportunity`,
`audience`, `positioning`, `territories[]`, `direction`, `series[]`,
`experiments[]`, `kpis[]`. Modelar cada bloco como tabela seria rigidez sem
retorno — é um documento editorial, não um agregado consultável.
**A forma do documento é versionada junto com o código**; mudanças no schema
exigem migração de dados ou tolerância a versões antigas (o schema tem
`doc_version`).

#### `strategy_approvals`

`id` · `strategy_version_id` FK CASCADE · `client_id` · `decided_by` ·
`decision approval_decision` (`approved | changes_requested`) · `note text` ·
`created_at`.
`unique index on (strategy_version_id) where decision = 'approved'` —
uma única aprovação válida por versão (idempotência de duplo clique).

### Conteúdo

#### `content_items`

Identidade e planejamento. **Nunca guarda o entregável.**

| Coluna                                   | Tipo              | Notas                                                              |
| ---------------------------------------- | ----------------- | ------------------------------------------------------------------ |
| `id`                                     | `uuid` PK         |                                                                    |
| `project_id`                             | `uuid not null`   | FK → `projects` CASCADE                                            |
| `client_id`                              | `uuid not null`   | derivado por trigger                                               |
| `title`                                  | `text not null`   | título de trabalho                                                 |
| `channel`                                | `content_channel` | `instagram \| linkedin \| tiktok \| youtube \| blog \| other`      |
| `format`                                 | `content_format`  | `reel \| carousel \| static \| story \| video \| article \| other` |
| `editorial_territory`                    | `text`            |                                                                    |
| `objective`                              | `text`            |                                                                    |
| `status`                                 | `content_status`  | dez estados, derivado pelos workflows                              |
| `current_version_id`                     | `uuid`            | FK → `content_versions` DEFERRABLE                                 |
| `scheduled_for`                          | `timestamptz`     |                                                                    |
| `published_at`                           | `timestamptz`     |                                                                    |
| `published_url`                          | `text`            | substitui `content_publications` na V0                             |
| `created_by`, `created_at`, `updated_at` |                   |                                                                    |

Índices: `(project_id, status)`, `(project_id, scheduled_for)`,
`(client_id, status)`.

#### `content_versions`

`id` · `content_item_id` FK CASCADE · `client_id` · `version int` ·
`status content_version_status` · `hook text` · `caption text` · `cta text` ·
`internal_notes text` (nunca exposto ao cliente) · `created_by` · `created_at` ·
`sent_for_approval_at` · `approved_at`.
`unique (content_item_id, version)`.

A visibilidade para o cliente é `sent_for_approval_at is not null` — simples,
auditável, imune a mudanças futuras no enum de status.

#### `content_comments`

`id` · `content_item_id` FK CASCADE · `content_version_id` FK NULL ·
`client_id` · `author_id` · `body text` · `is_internal bool not null default
false` · `created_at`.
O cliente só lê e só escreve `is_internal = false`, garantido por RLS
(`with check`) e pelo workflow.

#### `content_approvals`

`id` · `content_version_id` FK CASCADE · `client_id` · `decided_by` ·
`decision approval_decision` · `note text` · `created_at`.
`unique index on (content_version_id) where decision = 'approved'`.

### Arquivos

#### `files`

Única tabela polimórfica do sistema — uma exceção consciente
([ADR-0008](adr/0008-uploads-privados-com-url-assinada.md)).

| Coluna           | Tipo                   | Notas                                                                                      |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `id`             | `uuid` PK              |                                                                                            |
| `client_id`      | `uuid not null`        |                                                                                            |
| `project_id`     | `uuid`                 | nulo para arquivo de cliente                                                               |
| `uploaded_by`    | `uuid not null`        |                                                                                            |
| `entity_type`    | `file_entity_type`     | `content_version \| strategy_version \| onboarding_answer \| project \| client \| meeting` |
| `entity_id`      | `uuid`                 | sem FK — validado pelo workflow                                                            |
| `visibility`     | `file_visibility`      | `internal \| client` — **essencial**: o cliente só vê "arquivos autorizados" (§9)          |
| `status`         | `file_status`          | `pending \| ready` — o upload é em dois passos                                             |
| `storage_bucket` | `text not null`        |                                                                                            |
| `storage_path`   | `text not null unique` | derivado de UUID, nunca do nome enviado                                                    |
| `original_name`  | `text not null`        | apenas para exibição, sanitizado                                                           |
| `mime_type`      | `text not null`        | validado **no servidor**, após o upload                                                    |
| `size_bytes`     | `bigint not null`      | validado no servidor                                                                       |
| `checksum`       | `text`                 | opcional, para deduplicação futura                                                         |
| `created_at`     |                        |                                                                                            |

Trade-off aceito: `entity_id` sem FK. Alternativas (uma tabela de arquivo por
entidade, ou seis colunas FK anuláveis) custariam mais do que entregam num
sistema com um único formato de upload. O workflow valida a existência da
entidade e o acesso a ela antes de gravar.

Path: `clients/{clientId}/projects/{projectId}/{entityType}/{entityId}/{fileId}{ext}`.
**O path nunca é usado como autorização** — a decisão vem da tabela.

### Reuniões

#### `meetings`

`id` · `client_id` · `project_id` (nullable) · `type meeting_type`
(`immersion | strategy | review | checkin | other`) · `title` · `description` ·
`start_at timestamptz` · `end_at timestamptz` ·
`timezone text not null default 'America/Sao_Paulo'` · `meeting_url text` ·
`status meeting_status` (`scheduled | completed | cancelled`) · `created_by` ·
`created_at` · `updated_at`.

`meeting_url` é preenchida manualmente na V0. `CalendarAdapter` virá depois sem
alterar este schema.

### Analytics — FASE 14

#### `account_metrics`

`id` · `client_id` · `project_id` · `channel content_channel` ·
`period_start date` · `period_end date` · `reach bigint` · `followers bigint` ·
`views bigint` · `shares bigint` · `saves bigint` · `extra jsonb` ·
`source metric_source` (`manual` na V0) · `created_by` · `created_at`.
`unique (project_id, channel, period_start, period_end)` — reimportar o mesmo
período atualiza em vez de duplicar.

#### `content_metrics`

`id` · `content_item_id` FK CASCADE · `client_id` · `measured_on date` ·
mesmas métricas + `extra jsonb` · `source` · `created_by` · `created_at`.
`unique (content_item_id, measured_on)`.

Colunas explícitas para as cinco métricas do §26 (consultáveis, agregáveis,
tipadas) e `extra jsonb` para o resto. `source` já existe para o dia em que a
Meta API entrar — sem migration de esquema.

### Reviews — FASE 15

#### `monthly_reviews`

`id` · `client_id` · `project_id` · `period_month date` (sempre dia 1) ·
`title` · `summary text` · `wins jsonb` · `losses jsonb` · `learnings jsonb` ·
`next_actions jsonb` · `status review_status` (`draft | published`) ·
`published_at` · `created_by` · `created_at` · `updated_at`.
`unique (project_id, period_month)`.

Publicar um review dispara `startNextCycle()`: incrementa `projects.cycle` e
reabre as etapas recorrentes.

### Sistema

#### `activity_log`

**Append-only.** Sem UPDATE, sem DELETE, para ninguém — nem para `boop_admin`.

| Coluna        | Tipo                          | Notas                                                             |
| ------------- | ----------------------------- | ----------------------------------------------------------------- |
| `id`          | `bigint` identity PK          | ordenação natural, mais barato que uuid                           |
| `actor_id`    | `uuid`                        | nulo quando a ação é do sistema                                   |
| `client_id`   | `uuid`                        | nulo em eventos globais                                           |
| `project_id`  | `uuid`                        |                                                                   |
| `entity_type` | `text not null`               |                                                                   |
| `entity_id`   | `uuid`                        |                                                                   |
| `action`      | `text not null`               | ex.: `content.approved`                                           |
| `metadata`    | `jsonb not null default '{}'` | IDs e transições. **Nunca PII, nunca segredo**                    |
| `visibility`  | `activity_visibility`         | `internal \| client` — nasce pronto para o feed do cliente (D-05) |
| `request_id`  | `text`                        | correlação com o log estruturado                                  |
| `created_at`  | `timestamptz`                 |                                                                   |

Índices: `(client_id, created_at desc)`, `(project_id, created_at desc)`,
`(entity_type, entity_id)`.

Catálogo de ações em [`workflows.md`](workflows.md#catálogo-de-eventos).

#### `notifications`

Registro de envio (e-mail na V0; in-app depois, se necessário).

`id` · `client_id` · `project_id` · `recipient_user_id` · `recipient_email` ·
`template text not null` · `payload jsonb` ·
`status notification_status` (`pending | sent | failed`) ·
`dedupe_key text unique` · `provider_message_id text` · `error text` ·
`created_at` · `sent_at`.

`dedupe_key` é o mecanismo de idempotência dos side-effects: por exemplo
`content.awaiting_client:{versionId}` garante que a mesma versão não gere dois
avisos, mesmo com replay do workflow.

---

## Tabelas que a especificação pede e que **não** entram agora

| Tabela                                   | Motivo                                                                                                                                | Quando                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `research_items`, `research_collections` | Pesquisa é etapa da jornada; o resultado é entregue dentro da Estratégia. Nenhuma fase do roadmap a constrói                          | Quando houver biblioteca de pesquisa reutilizável    |
| `meeting_notes`                          | Nota de reunião cabe em `meetings.description` na V0                                                                                  | Quando houver ata estruturada                        |
| `project_memberships`                    | Cliente vê todos os projetos dele; `boop_member` é escopado por cliente                                                               | Quando um cliente exigir separação por projeto       |
| `strategy_comments`                      | "Solicitar ajuste" cabe em `strategy_approvals.note`                                                                                  | Quando houver discussão encadeada na estratégia      |
| `content_publications`                   | Não há publicação automatizada; `published_at` + `published_url` bastam                                                               | Quando existir agendador                             |
| `integrations`, `integration_events`     | Não há integração externa de domínio antes da FASE 17                                                                                 | FASE 17 (Notion)                                     |
| `automation_runs`                        | Side-effects rodam inline com registro em `notifications`                                                                             | FASE 18, se houver retry automático                  |
| `invitations`                            | Convidar já cria usuário + vínculo; `profiles.status` cobre o resto                                                                   | Provavelmente nunca                                  |
| `project_scope` (ou `projects.scope`)    | **D-16, FASE 6.** O bloco "O que combinamos" era texto de protótipo e não tinha origem. Saiu da tela em vez de virar coluna inventada | Quando houver contrato/escopo estruturado de verdade |
| cargo em `profiles`                      | **D-16, FASE 6.** "Quem está no projeto" mostra só o nome. `boop_member` não é cargo, e derivar "Estrategista" dele seria ficção      | Quando a operação precisar de papel funcional        |

## Integridade que o banco garante (não a aplicação)

1. `unique (client_id, user_id)` em `client_memberships`.
2. No máximo uma etapa `current` por projeto (índice parcial).
3. Uma única aprovação por versão de conteúdo e de estratégia (índice parcial).
4. `unique (submission_id, question_id)` — autosave idempotente.
5. `unique (project_id, period_month)` em reviews.
6. `unique (storage_path)` em `files`.
7. `client_id`/`project_id` imutáveis (trigger).
8. `client_id` sempre derivado do pai (trigger), nunca do input.
9. `activity_log` sem UPDATE/DELETE (ausência de policy + `REVOKE`).
