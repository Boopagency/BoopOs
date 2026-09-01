# Workflows — Boop OS

Um **workflow** é um caso de uso do domínio. É a única forma de escrever no
sistema. Server Actions e Route Handlers não contêm lógica: adaptam HTTP e
delegam.

## Contrato

Todo workflow executa exatamente estes passos, nesta ordem:

1. **Validar input** — zod `.strict()`. Campo desconhecido é rejeitado.
2. **Autenticar** — carrega o `actor`. Sem sessão ou perfil não ativo, para aqui.
3. **Autorizar** — `can(actor, action, resource)`. Nega em 404 quando revelar a
   existência do recurso já seria vazamento.
4. **Executar** — a operação principal.
5. **Garantir consistência** — operações multi-linha rodam dentro de uma função
   SQL; unicidade e transições são garantidas pelo banco.
6. **Registrar activity log** — na mesma transação quando houver função SQL.
7. **Side-effects** — e-mail e projeções, **depois** do commit, isolados.
8. **Tratar falha** — erro de domínio tipado; nunca stack trace para o cliente.

```ts
export const approveContentVersion = defineWorkflow({
  name: 'content.approve',
  input: z.object({ versionId: z.string().uuid(), note: z.string().max(2000).optional() }).strict(),
  authorize: async (actor, input, ctx) => {
    const version = await ctx.repos.content.getVersionForApproval(input.versionId)
    if (!version) return notFound()
    return canApproveContentVersion(actor, version)
  },
  handler: async ({ actor, input, ctx }) => {
    // função SQL: aprova + atualiza item + grava activity log, atomicamente
    const result = await ctx.db.rpc('approve_content_version', {
      p_version_id: input.versionId,
      p_note: input.note ?? null,
    })

    ctx.after(() => ctx.email.send('content_approved_internal', { ... }))
    return result
  },
})
```

`defineWorkflow` devolve uma função chamável por Server Action, Route Handler ou
teste. `ctx.after()` enfileira side-effects que rodam depois do commit e **nunca**
derrubam o workflow: falha vira linha `failed` em `notifications`.

## Consistência: quando usar função SQL

`supabase-js` não abre transação. Operações que tocam mais de uma linha e não
podem ficar pela metade rodam como função Postgres (`security definer`, chamada
via `rpc`). Ver [ADR-0011](adr/0011-workflows-transacionais-em-sql.md).

**Rodam em SQL** (V0 — cinco funções, não mais):

| Função                     | Por que precisa ser atômica                                |
| -------------------------- | ---------------------------------------------------------- |
| `approve_content_version`  | aprovação + status do item + activity log                  |
| `request_content_changes`  | decisão + status do item + activity log                    |
| `create_content_version`   | nova versão + `superseded` na anterior + ponteiro + status |
| `approve_strategy_version` | aprovação + status da versão + activity log                |
| `submit_onboarding`        | status da submissão + avanço de etapa + activity log       |

Todo o resto é escrita de uma linha só, seguida de `logActivity()`. Se essa
segunda escrita falhar, o log estruturado registra a inconsistência e a operação
principal permanece válida — perder uma linha de auditoria é preferível a perder
a operação.

## Idempotência

| Mecanismo                                                                  | Onde                                  |
| -------------------------------------------------------------------------- | ------------------------------------- |
| Índice único parcial `where decision='approved'`                           | aprovação de conteúdo e de estratégia |
| Guarda de estado dentro da função SQL (`where status = 'awaiting_client'`) | todas as transições                   |
| `upsert` em `(submission_id, question_id)`                                 | autosave do onboarding                |
| `unique (client_id, user_id)`                                              | convite repetido                      |
| `notifications.dedupe_key`                                                 | e-mail duplicado                      |
| `unique (project_id, period_month)`                                        | review republicado                    |

Repetir uma ação já concluída devolve **sucesso**, não erro: o duplo clique no
celular é o caso comum, não o ataque.

## Catálogo de workflows

### Clientes e usuários

| Workflow             | Papel        | Efeitos                                                     | Evento               |
| -------------------- | ------------ | ----------------------------------------------------------- | -------------------- |
| `createClient`       | `boop_admin` | cria cliente                                                | `client.created`     |
| `updateClient`       | Boop         |                                                             | `client.updated`     |
| `archiveClient`      | `boop_admin` |                                                             | `client.archived`    |
| `inviteUser`         | `boop_admin` | cria `auth.users` + `profiles` + vínculo; e-mail de convite | `client.invited`     |
| `grantClientAccess`  | `boop_admin` | vínculo                                                     | `membership.granted` |
| `revokeClientAccess` | `boop_admin` | remove vínculo                                              | `membership.revoked` |
| `disableUser`        | `boop_admin` | `status='disabled'`                                         | `user.disabled`      |
| `recordFirstLogin`   | sistema      | `status='active'`                                           | `user.joined`        |

### Projetos

| Workflow              | Papel                | Efeitos                                                 | Evento                   |
| --------------------- | -------------------- | ------------------------------------------------------- | ------------------------ |
| `createProject`       | `boop_admin`         | cria projeto + materializa `project_stages` do template | `project.created`        |
| `advanceStage`        | Boop                 | fecha a etapa atual, abre a próxima                     | `project.stage_changed`  |
| `setStageState`       | Boop                 | correção manual (`skipped`, volta atrás)                | `project.stage_changed`  |
| `changeProjectStatus` | Boop                 | pausa, conclui, arquiva                                 | `project.status_changed` |
| `startNextCycle`      | sistema (via review) | `cycle++`, reabre etapas recorrentes                    | `project.cycle_started`  |

### Onboarding

| Workflow               | Papel        | Efeitos                                     | Evento                 |
| ---------------------- | ------------ | ------------------------------------------- | ---------------------- |
| `startOnboarding`      | Boop         | cria submissão a partir do template         | `onboarding.started`   |
| `saveOnboardingAnswer` | cliente/Boop | upsert; só enquanto `draft`                 | — (ruidoso demais)     |
| `submitOnboarding`     | cliente      | `submitted` + avança etapa + e-mail interno | `onboarding.completed` |
| `reopenOnboarding`     | `boop_admin` | volta para `draft`                          | `onboarding.reopened`  |

### Estratégia

| Workflow                  | Papel       | Efeitos                                       | Evento                       |
| ------------------------- | ----------- | --------------------------------------------- | ---------------------------- |
| `createStrategy`          | Boop        | cria a estratégia do projeto                  | `strategy.created`           |
| `createStrategyVersion`   | Boop        | v(n+1) em `draft`; anterior vira `superseded` | `strategy.version_created`   |
| `sendStrategyForApproval` | Boop        | `awaiting_client` + e-mail ao cliente         | `strategy.sent_for_approval` |
| `approveStrategy`         | **cliente** | aprovação + avanço de etapa + e-mail interno  | `strategy.approved`          |
| `requestStrategyChanges`  | **cliente** | decisão + nota + e-mail interno               | `strategy.changes_requested` |

### Conteúdo

| Workflow                   | Papel       | Efeitos                                   | Evento                      |
| -------------------------- | ----------- | ----------------------------------------- | --------------------------- |
| `createContentItem`        | Boop        | item em `idea`/`planned`                  | `content.created`           |
| `updateContentItem`        | Boop        | planejamento (título, canal, data)        | `content.updated`           |
| `createContentVersion`     | Boop        | nova versão; item volta a `in_production` | `content.version_created`   |
| `submitContentForApproval` | Boop        | `awaiting_client` + e-mail ao cliente     | `content.sent_for_approval` |
| `approveContent`           | **cliente** | aprovação + e-mail interno                | `content.approved`          |
| `requestContentChanges`    | **cliente** | decisão + nota + e-mail interno           | `content.changes_requested` |
| `commentOnContent`         | ambos       | comentário (interno ou público)           | `content.commented`         |
| `scheduleContent`          | Boop        | `scheduled` + `scheduled_for`             | `content.scheduled`         |
| `markContentPublished`     | Boop        | `published` + URL                         | `content.published`         |
| `archiveContent`           | Boop        |                                           | `content.archived`          |

### Arquivos · Reuniões · Resultados · Reviews

| Workflow                                            | Papel        | Efeitos                                        | Evento                                        |
| --------------------------------------------------- | ------------ | ---------------------------------------------- | --------------------------------------------- |
| `requestUpload`                                     | Boop/cliente | valida, cria `files` `pending`, assina URL     | —                                             |
| `confirmUpload`                                     | Boop/cliente | revalida no servidor, `ready`                  | `file.uploaded`                               |
| `setFileVisibility`                                 | Boop         | `internal ↔ client`                            | `file.visibility_changed`                     |
| `deleteFile`                                        | `boop_admin` | remove objeto + linha                          | `file.deleted`                                |
| `createMeeting` / `updateMeeting` / `cancelMeeting` | Boop         |                                                | `meeting.created` / `.updated` / `.cancelled` |
| `recordAccountMetrics` / `recordContentMetrics`     | Boop         | upsert por período                             | `metrics.recorded`                            |
| `createMonthlyReview`                               | Boop         | rascunho                                       | `review.created`                              |
| `publishMonthlyReview`                              | Boop         | publica + `startNextCycle` + e-mail ao cliente | `review.published`                            |

## Catálogo de eventos

`activity_log.action` usa `dominio.verbo_no_passado`, sempre em inglês. Lista
canônica em `src/config/activity.ts`; um teste garante que nenhum workflow
registre ação fora dela.

```
client.created · client.updated · client.archived · client.invited
membership.granted · membership.revoked · user.joined · user.disabled
project.created · project.stage_changed · project.status_changed · project.cycle_started
onboarding.started · onboarding.completed · onboarding.reopened
strategy.created · strategy.version_created · strategy.sent_for_approval
strategy.approved · strategy.changes_requested
content.created · content.updated · content.version_created
content.sent_for_approval · content.approved · content.changes_requested
content.commented · content.scheduled · content.published · content.archived
file.uploaded · file.visibility_changed · file.deleted
meeting.created · meeting.updated · meeting.cancelled
metrics.recorded · review.created · review.published
integration.failed · automation.failed
```

`visibility` de cada evento é definida no catálogo, não no local da chamada — é o
que permitirá ligar o histórico para o cliente (D-05) sem reclassificar o passado.

## Erros

```ts
type WorkflowError = {
  code: string // 'content.version_not_pending'
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500
  message: string // texto de produto, em português
  details?: unknown // apenas para o log; nunca vai para o cliente
}
```

`404` sempre que revelar a existência do recurso já seria vazamento. `409` para
conflito de estado (aprovar algo já aprovado por outra pessoa). Erro inesperado
vira `500` genérico no cliente e log completo com `requestId` no servidor.

## Regras de escrita de workflow

- Um workflow, um caso de uso. Se o nome precisa de "e", são dois.
- Nunca receber `clientId` do cliente: derivar do recurso.
- Nunca confiar em estado enviado pela UI: reler do banco antes de decidir.
- Nunca fazer chamada externa dentro da transação de domínio.
- Nunca deixar side-effect derrubar a operação principal.
- Toda mudança de estado registra activity log. Toda leitura, nenhum.
