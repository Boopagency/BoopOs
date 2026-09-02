# Permissões — Boop OS

## Modelo

**Papel global + escopo por vínculo.**

- `profiles.role` define o que a pessoa _pode fazer_: `boop_admin`,
  `boop_member`, `client_user`.
- `client_memberships` define _sobre quais clientes_ ela pode fazer.

Um `boop_admin` não precisa de vínculo: enxerga tudo. `boop_member` e
`client_user` só enxergam clientes onde têm vínculo. Ver
[ADR-0005](adr/0005-papel-global-e-vinculo-por-cliente.md).

Não há papel por projeto na V0: o cliente vê todos os projetos dele e o
`boop_member` é escopado por cliente. Acrescentar `project_memberships` depois é
aditivo, sem migração destrutiva.

## Papéis

### `boop_admin`

Administra o sistema. Cria clientes, convida e desativa usuários, cria projetos,
altera a jornada, escreve estratégia e conteúdo, publica review, gerencia
integrações, enxerga todos os clientes e todo o activity log.

### `boop_member`

Trabalha nos clientes em que tem vínculo: estratégia, conteúdo, onboarding,
reuniões, arquivos, métricas, reviews. Não administra usuários, não cria clientes,
não configura integrações, não apaga registro.

### `client_user`

Acessa **apenas** os clientes em que tem vínculo. Vê o projeto e a jornada,
responde o onboarding, lê e aprova a estratégia, lê o conteúdo enviado, comenta,
solicita alteração, aprova, baixa arquivos autorizados, vê reuniões, resultados e
reviews publicados.

**Nunca** acessa: dado interno, backlog, rascunho, comentário interno,
configuração, integrações, activity log, outros clientes.

## Matriz de permissões

`✓` permitido · `—` negado · `escopo` permitido dentro do vínculo ·
`própria` apenas os próprios registros

| Ação                                                   | `boop_admin` |   `boop_member`   |              `client_user`               |
| ------------------------------------------------------ | :----------: | :---------------: | :--------------------------------------: |
| **Clientes**                                           |              |                   |                                          |
| `client.list` (todos)                                  |      ✓       |      escopo       |                    —                     |
| `client.read`                                          |      ✓       |      escopo       |         escopo (dados públicos)          |
| `client.create`                                        |      ✓       |         —         |                    —                     |
| `client.update`                                        |      ✓       |      escopo       |                    —                     |
| `client.archive`                                       |      ✓       |         —         |                    —                     |
| `client.read_internal_notes`                           |      ✓       |      escopo       |                    —                     |
| **Usuários**                                           |              |                   |                                          |
| `user.invite_client_user`                              |      ✓       |         —         |                    —                     |
| `user.invite_boop_member`                              |      ✓       |         —         |                    —                     |
| `user.list`                                            |      ✓       |      escopo       |                    —                     |
| `user.disable`                                         |      ✓       |         —         |                    —                     |
| `membership.grant` / `membership.revoke`               |      ✓       |         —         |                    —                     |
| **Projetos**                                           |              |                   |                                          |
| `project.create`                                       |      ✓       |         —         |                    —                     |
| `project.read`                                         |      ✓       |      escopo       |                  escopo                  |
| `project.update`                                       |      ✓       |      escopo       |                    —                     |
| `project.advance_stage`                                |      ✓       |      escopo       |                    —                     |
| `project.change_status`                                |      ✓       |      escopo       |                    —                     |
| **Onboarding**                                         |              |                   |                                          |
| `onboarding.template.manage`                           |      ✓       |         —         |                    —                     |
| `onboarding.start`                                     |      ✓       |      escopo       |                    —                     |
| `onboarding.answer`                                    |      ✓       |      escopo       |        escopo (enquanto `draft`)         |
| `onboarding.submit`                                    |      ✓       |      escopo       |                  escopo                  |
| `onboarding.read_answers`                              |      ✓       |      escopo       |           escopo (as próprias)           |
| **Estratégia**                                         |              |                   |                                          |
| `strategy.create` / `strategy.version.create`          |      ✓       |      escopo       |                    —                     |
| `strategy.read_draft`                                  |      ✓       |      escopo       |                    —                     |
| `strategy.read_published`                              |      ✓       |      escopo       |                  escopo                  |
| `strategy.send_for_approval`                           |      ✓       |      escopo       |                    —                     |
| `strategy.approve`                                     |      —       |         —         |                  escopo                  |
| `strategy.request_changes`                             |      —       |         —         |                  escopo                  |
| **Conteúdo**                                           |              |                   |                                          |
| `content.create` / `content.version.create`            |      ✓       |      escopo       |                    —                     |
| `content.read_internal` (idea → internal_review)       |      ✓       |      escopo       |                    —                     |
| `content.read_shared` (a partir de awaiting_client)    |      ✓       |      escopo       |                  escopo                  |
| `content.send_for_approval`                            |      ✓       |      escopo       |                    —                     |
| `content.approve`                                      |      —       |         —         |                  escopo                  |
| `content.request_changes`                              |      —       |         —         |                  escopo                  |
| `content.comment_internal`                             |      ✓       |      escopo       |                    —                     |
| `content.comment_public`                               |      ✓       |      escopo       |                  escopo                  |
| `content.mark_published`                               |      ✓       |      escopo       |                    —                     |
| `content.archive`                                      |      ✓       |      escopo       |                    —                     |
| **Arquivos**                                           |              |                   |                                          |
| `file.upload`                                          |      ✓       |      escopo       | escopo (resposta de onboarding, FASE 12) |
| `file.read_internal`                                   |      ✓       |      escopo       |                    —                     |
| `file.read_client`                                     |      ✓       |      escopo       |                  escopo                  |
| `file.set_visibility`                                  |      ✓       |      escopo       |                    —                     |
| `file.delete`                                          |      ✓       |         —         |                    —                     |
| **Reuniões**                                           |              |                   |                                          |
| `meeting.create` / `meeting.update` / `meeting.cancel` |      ✓       |      escopo       |                    —                     |
| `meeting.read`                                         |      ✓       |      escopo       |                  escopo                  |
| **Resultados**                                         |              |                   |                                          |
| `metrics.write`                                        |      ✓       |      escopo       |                    —                     |
| `metrics.read`                                         |      ✓       |      escopo       |                  escopo                  |
| **Reviews**                                            |              |                   |                                          |
| `review.create` / `review.update`                      |      ✓       |      escopo       |                    —                     |
| `review.publish`                                       |      ✓       |      escopo       |                    —                     |
| `review.read_draft`                                    |      ✓       |      escopo       |                    —                     |
| `review.read_published`                                |      ✓       |      escopo       |                  escopo                  |
| **Sistema**                                            |              |                   |                                          |
| `activity.read`                                        |      ✓       | escopo (internal) |                    —                     |
| `notification.read` / `notification.resend`            |      ✓       |         —         |                    —                     |
| `integration.manage`                                   |      ✓       |         —         |                    —                     |

### Duas linhas que merecem atenção

**Aprovar é exclusivo do cliente.** Nem `boop_admin` aprova conteúdo ou
estratégia — aprovação é registro de decisão do cliente e falsificá-la destrói o
valor do sistema. Se for preciso registrar aprovação recebida por outro canal
(reunião, WhatsApp), isso vira um workflow explícito e distinto,
`recordOfflineApproval()`, com `metadata.source` marcando a origem. Não existe na
V0 (ver D-03).

**`boop_member` não convida usuário e não apaga nada.** Escalada de privilégio e
destruição de dado ficam com `boop_admin`.

## Onde a permissão é aplicada

Três lugares, nesta ordem. Nenhum deles é opcional.

1. **UI** — esconde o que não é permitido. É conveniência, **não é segurança**.
2. **Workflow** — `can(actor, action, resource)` antes de qualquer efeito. É a
   fronteira real da aplicação.
3. **RLS** — nega de novo no banco, mesmo que 1 e 2 tenham bug.

```ts
// src/lib/auth/policy.ts — a decisão de PAPEL, pura e em tabela
can(actor, 'content.approve')
// → { allowed: false, code: 'content.approve.denied' } para boop_admin

// src/lib/auth/authorization.ts — a decisão de ESCOPO, contra o banco
await requireClientAccess(clientId) // 404 se não alcança
```

**O Actor não carrega `clientIds`.** Versões anteriores deste documento
escreviam `actor.clientIds.includes(v.clientId)`, e isso mudou na FASE 4 por
[ADR-0022](adr/0022-autorizacao-no-banco-e-fim-da-service-role-de-identidade.md):
escopo é estado do banco no instante do request, e uma lista montada no início
dele seria uma foto — revogar um vínculo no meio não teria efeito, e a aplicação
passaria a ter uma segunda verdade sobre acesso competindo com a RLS.

Quem responde escopo são `requireClientAccess()` e `requireProjectAccess()`, que
perguntam **tentando ler o recurso pelo JWT**: se a RLS devolve a linha, o acesso
existe. Ver [`authorization.md`](authorization.md).

A validação de ESTADO (`v.status !== 'awaiting_client'`) pertence ao workflow de
aprovação, que é a FASE 11 — e não existe policy de INSERT nas tabelas de
aprovação justamente para que ela não possa ser pulada.

Funções de policy são **puras**: sem I/O, sem banco. Isso as torna testáveis em
tabela e rápidas.

## Testes obrigatórios

Além dos casos da §38 da especificação:

- Cliente A acessa Cliente A. ✓
- Cliente A **não** acessa Cliente B.
- Cliente A **não** obtém Cliente B trocando o ID na URL (resposta 404).
- Cliente A **não** aprova versão inexistente.
- Cliente A **não** aprova versão que não está `awaiting_client`.
- Cliente A **não** acessa arquivo do Cliente B, nem com o `fileId` correto.
- Cliente A **não** lê arquivo `visibility='internal'` do próprio cliente.
- Cliente A **não** lê conteúdo `in_production` do próprio cliente.
- Cliente A **não** lê comentário `is_internal = true`.
- Não autenticado **não** acessa nada além de `/login`.
- `boop_member` sem vínculo **não** acessa o cliente.
- `boop_member` **não** convida usuário nem apaga registro.
- `boop_admin` **não** aprova conteúdo.
- Usuário `disabled` perde acesso no request seguinte.
- Aprovação duplicada gera **um** registro (idempotência).
- Alterar `client_id` de uma linha existente falha.

A matriz acima é executada como teste guiado por tabela: cada célula vira um caso
em `tests/unit/permissions.matrix.test.ts`, e os caminhos de dado viram teste de
RLS em `tests/rls/`. Ver [`../.claude/rules/testing.md`](../.claude/rules/testing.md).

**Desde a FASE 4 isso é literal.** `tests/unit/permissions.matrix.test.ts`
transcreve a tabela acima linha a linha — deliberadamente transcrita, e não
importada de `policy.ts`: são duas escritas independentes da mesma regra, e o
teste falha quando divergem. As linhas de `file.*`, `meeting.*`, `metrics.*` e
`review.*` ainda não estão lá porque as tabelas não existem; entram com elas.
