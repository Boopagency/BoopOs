# Autorização — Boop OS

Como o sistema decide **o que cada pessoa pode ver e fazer**. A FASE 3 respondeu
"quem é"; isto responde o resto.

O raciocínio de _por que_ assim está em [ADR-0004](adr/0004-rls-com-funcoes-security-definer.md),
[ADR-0005](adr/0005-papel-global-e-vinculo-por-cliente.md) e
[ADR-0022](adr/0022-autorizacao-no-banco-e-fim-da-service-role-de-identidade.md).
A obrigação curta está em [`.claude/rules/security.md`](../.claude/rules/security.md).
A matriz por ação, em [`permissions.md`](permissions.md).

## As três camadas

```
UI          esconde o que não é permitido        conveniência, NÃO é segurança
  ↓
can()       o papel permite esta ação?           função pura, src/lib/auth/policy.ts
guards      este ator alcança este recurso?      consultam sob RLS
  ↓
RLS         o banco nega de novo                 a barreira final
```

Nenhuma é opcional, e a ordem importa. A UI pode ter bug; `can()` pode ter bug;
a RLS é a que sobra.

## Papel global × escopo por vínculo

`profiles.role` diz o que a pessoa **pode fazer**. `client_memberships` diz
**sobre quais clientes**. Vínculo não tem papel próprio na V0.

| Papel         | Escopo                                               |
| ------------- | ---------------------------------------------------- |
| `boop_admin`  | todos os clientes, sem precisar de vínculo (D-08)    |
| `boop_member` | só clientes com vínculo explícito                    |
| `client_user` | só o próprio tenant, e só a superfície compartilhada |

`status <> 'active'` → **nada**. A regra vale nas duas camadas: `can()` recusa
antes de olhar o papel, e `app.actor_role()` devolve `NULL` no banco. É isso que
faz a revogação valer no request seguinte, sem esperar o JWT expirar.

## As funções `app.*`

Todas `security definer`, `stable`, `search_path = ''`, identidade sempre de
`(select auth.uid())` — **nunca** de argumento. O schema `app` não é exposto
pelo PostgREST e não tem `usage` para `anon` nem `authenticated`: elas existem
para as policies, não para a API.

### Decisão de papel

| Função             | Responde                                       |
| ------------------ | ---------------------------------------------- |
| `actor_role()`     | o papel de quem pede, ou `NULL` se inativo     |
| `is_boop_admin()`  | é `boop_admin` ativo?                          |
| `is_boop()`        | é da Boop (admin ou member) e está ativo?      |
| `is_client_user()` | é `client_user` ativo? (usado para RESTRINGIR) |

### Resolução de escopo

`has_client_access(client_id)` é o coração: `boop_admin` sempre; os demais só com
vínculo **de perfil ativo**. `NULL` devolve `false` — fail closed.

`has_project_access(project_id)` resolve projeto → cliente e delega. Um
`project_id` vindo da URL é endereço, nunca prova.

### Resolvedores das tabelas sem `client_id`

Regra desta fase: **toda tabela sem `client_id` ganha exatamente uma função que
resolve o seu escopo.** Não é invenção caso a caso — é o que substitui o
`has_client_access(client_id)` que essas tabelas não podem escrever.

| Função                      | Caminho                                              | Serve a                        |
| --------------------------- | ---------------------------------------------------- | ------------------------------ |
| `has_profile_access(id)`    | o próprio · admin todos · member quem divide cliente | `profiles`                     |
| `has_template_access(id)`   | Boop lê tudo · cliente só via a própria submissão    | `onboarding_templates`         |
| `has_section_access(id)`    | seção → template                                     | `onboarding_questions`         |
| `has_submission_access(id)` | resposta → submissão → cliente                       | `onboarding_answers` (leitura) |
| `can_answer_submission(id)` | idem + o cliente só enquanto `draft`                 | `onboarding_answers` (escrita) |

Por que função e não subquery na policy: uma subquery sobre tabela com RLS,
dentro de uma policy, é filtrada pela policy **daquela** tabela — a avaliação de
uma passa a depender da outra, e o plano fica sensível à ordem. `security
definer` roda a subquery sem RLS e concentra a decisão em um lugar.

## A matriz por tabela

`S I U D` = as operações com policy **e** GRANT. Ausência é decisão, não
esquecimento — e o teste de varredura confere a tabela inteira contra o catálogo
(`tests/rls/policy-matrix.test.ts`).

| Tabela                   | Ops    | Quem lê                                               | Quem escreve                              |
| ------------------------ | ------ | ----------------------------------------------------- | ----------------------------------------- |
| `profiles`               | `S`    | o próprio; admin todos; member quem divide cliente    | ninguém pela API                          |
| `clients`                | `SIU`  | quem tem acesso ao cliente                            | criar: admin · editar: Boop               |
| `client_memberships`     | `SID`  | Boop no escopo; cliente só o próprio vínculo          | só admin                                  |
| `projects`               | `SIU`  | quem tem acesso ao cliente                            | criar: admin · editar: Boop               |
| `project_stages`         | `SIUD` | quem tem acesso ao projeto                            | Boop · apagar: admin                      |
| `onboarding_templates`   | `SIUD` | Boop tudo; cliente só o próprio                       | só admin                                  |
| `onboarding_sections`    | `SIUD` | idem                                                  | só admin                                  |
| `onboarding_questions`   | `SIUD` | idem                                                  | só admin                                  |
| `onboarding_submissions` | `S`    | quem tem acesso ao cliente                            | **ninguém** — três RPCs (FASE 7)          |
| `onboarding_answers`     | `SIU`  | via submissão                                         | Boop; cliente só em `draft`               |
| `strategies`             | `SIU`  | quem tem acesso ao cliente                            | Boop                                      |
| `strategy_versions`      | `SIU`  | cliente **não** vê `draft`                            | Boop                                      |
| `strategy_approvals`     | `S`    | quem tem acesso ao cliente                            | **ninguém** — RPC na FASE 11              |
| `content_items`          | `SIUD` | cliente só de `awaiting_client` em diante             | Boop · apagar: admin                      |
| `content_versions`       | `SIUD` | cliente só com `sent_for_approval_at`                 | Boop · apagar: admin                      |
| `content_comments`       | `SIUD` | cliente **não** vê `is_internal`                      | cliente comenta público, assinando por si |
| `content_approvals`      | `S`    | quem tem acesso ao cliente                            | **ninguém** — RPC na FASE 11              |
| `activity_log`           | `S`    | admin tudo; member no escopo; cliente **nada** (D-05) | `record_activity()`                       |
| `notifications`          | `S`    | só admin                                              | servidor, FASE 16                         |

`anon` não tem privilégio em nenhuma delas, em nenhuma operação.

### Duas fechaduras

Policy e GRANT nascem juntos, na mesma migration. Policy sem GRANT deixa a
tabela morta em silêncio — o sintoma é indistinguível de "a RLS negou". GRANT
sem policy deixa a porta com uma tranca só. O teste de varredura afirma a
igualdade nas dezenove tabelas.

### Aprovação não se escreve pela Data API

`strategy_approvals` e `content_approvals` não têm policy de INSERT, UPDATE ou
DELETE — **para ninguém, `boop_admin` incluído**. Aprovação é registro de
decisão do cliente; um `insert` direto diria que ele aprovou algo que nunca viu,
contornando a máquina de estados. A escrita chega na FASE 11, por função
`security definer` que valida a transição.

Escopo global (D-08) diz **quais clientes** o admin alcança. Não diz quais
invariantes de domínio ele pode quebrar.

### `client_id` nulo

`activity_log` e `notifications` aceitam `client_id` nulo — linha de sistema, que
não pertence a tenant nenhum. A decisão é explícita: **só o escopo global a
alcança.** Sem isso escrito, um `or client_id is null` bem-intencionado a
entregaria a qualquer membro.

## A camada de aplicação

### `can(actor, capability)` — puro

Tabela em `src/lib/auth/policy.ts`, uma linha por célula de
[`permissions.md`](permissions.md). Sem I/O, sem `async`. Responde **por papel**;
não responde por escopo.

Só carrega capacidades cujo recurso já existe no schema — `file.*`, `meeting.*`,
`metrics.*` e `review.*` entram quando as tabelas entrarem. Capacidade
desconhecida **nega**.

### Guards — consultam a RLS

| Guard                      | Faz                                           |
| -------------------------- | --------------------------------------------- |
| `requireBoop()`            | sessão + perfil ativo + papel da Boop         |
| `requireBoopAdmin()`       | idem, só `boop_admin`                         |
| `requireClientAccess(id)`  | tenta ler o cliente pelo JWT; sem linha → 404 |
| `requireProjectAccess(id)` | idem para projeto                             |
| `requireCapability(cap)`   | `can()` e, se negar, 404                      |

Eles não comparam vínculo em TypeScript: **perguntam ao banco tentando ler o
recurso**. A mesma policy que protege a tabela responde ao guard, então as duas
nunca discordam.

**404, nunca 403.** 403 confirma que o recurso existe, e essa confirmação já é
informação para quem troca uuid na URL. Recurso inexistente e recurso de outro
tenant produzem exatamente a mesma resposta.

### O Actor não carrega `clientIds`

Decisão, não pendência — ver [ADR-0022](adr/0022-autorizacao-no-banco-e-fim-da-service-role-de-identidade.md).
Escopo é estado do banco no instante do request; uma lista montada no início
seria uma foto, e revogar vínculo no meio do request não teria efeito.

## Fronteiras privilegiadas

Quatro funções em `public`, `security definer`, chamadas por `rpc`. Existem
porque a operação precisa de mais privilégio do que quem a executa deveria ter em
regime permanente — e a resposta foi reduzir o privilégio ao tamanho exato da
operação, não manter `service_role`.

| Função                               | Fase | Existe porque                                                      |
| ------------------------------------ | ---- | ------------------------------------------------------------------ |
| `promote_invited_profile()`          | 4    | promover escreve `profiles.status`, e `role` mora na mesma linha   |
| `record_activity(...)`               | 4    | INSERT em `activity_log` permitiria `actor_id` forjado             |
| `assign_invited_profile_role(id, r)` | 5    | o convite define o papel, e `profiles` não tem UPDATE para ninguém |
| `disable_profile(id)`                | 5    | desligar escreve `profiles.status`, mesma linha que `role`         |

**Quem chama nunca vem por parâmetro.** As quatro derivam a identidade do
chamador de `(select auth.uid())`. As duas da FASE 5 recebem o **alvo** por
parâmetro — sobre quem se opera — e conferem quem opera por dentro, com
`app.is_boop_admin()`. É uma distinção que vale escrever: parâmetro que diz
"sobre quem" é entrada; parâmetro que diz "quem sou eu" seria uma assinatura em
branco.

Cada uma faz **uma** transição, com o estado de origem no `where`, e por isso é
idempotente sem precisar de trava.

### O que as duas da FASE 5 recusam

| Recusa                           | Por quê                                                                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `boop_admin` como valor de papel | a matriz tem `user.invite_client_user` e `user.invite_boop_member`, e **não tem** a terceira linha. Criar administrador é provisionamento (`scripts/auth/provision-user.sh`), não produto — e `boop_admin` é global por D-08 |
| alvo = quem chama                | em `disable_profile`, é o auto-desligamento: sem caminho de volta na V0, com um único administrador, é a porta trancada por dentro                                                                                           |
| perfil que não está `invited`    | trocar o papel de quem já trabalha no sistema não está na matriz, então não tem caminho                                                                                                                                      |

`profiles` continua **sem policy e sem GRANT de UPDATE para ninguém**, inclusive
`boop_admin`: `update profiles set role = 'boop_admin' where id = auth.uid()`
segue impossível pela Data API. Há teste adversarial para cada recusa em
`tests/rls/phase5-people-boundaries.test.ts`.

### As quatro da FASE 6

`create_project_with_journey`, `advance_project_stage` e
`set_project_stage_state` existem por **atomicidade**, não por privilégio
([ADR-0023](adr/0023-fronteiras-transacionais-de-projeto-e-jornada.md)). Elas
são `security definer` por uma razão de infraestrutura, e vale registrar:

> Uma função `invoker` chamada por `authenticated` **não alcança o schema
> `app`** — o bootstrap o revoga. As policies chamam `app.*` e funcionam porque
> expressão de policy é avaliada com os privilégios do dono da tabela. Logo, uma
> função que precise de `app.is_boop_admin()` no corpo precisa ser `definer`.

O preço é explícito: **dentro delas a RLS não vale**. As checagens do corpo
espelham as policies, usando as mesmas funções:

| Função                        | Papel exigido         | Escopo exigido                                      |
| ----------------------------- | --------------------- | --------------------------------------------------- |
| `create_project_with_journey` | `app.is_boop_admin()` | `app.has_client_access()`                           |
| `advance_project_stage`       | `app.is_boop()`       | `app.has_project_access()`                          |
| `set_project_stage_state`     | `app.is_boop()`       | `app.has_project_access()` + o par (etapa, projeto) |

A quarta é de **leitura**: `list_client_team(client_id)` devolve apenas
`full_name` das pessoas da Boop com vínculo explícito. Ela existe porque
`client_memberships_select` restringe o `client_user` ao próprio vínculo e
`has_profile_access` nunca lhe concede perfil de terceiro — as duas restrições
estão certas, e o produto pede menos do que elas negam. Fail closed: sem acesso
ao cliente, zero linhas.

**`boop_admin` sem vínculo não entra na equipe.** Acesso global (D-08) diz quais
clientes ele alcança, não de quem ele cuida.

## Visibilidade de produto — o que a RLS não decide

A RLS responde "este ator alcança este projeto?". Ela **não** responde "este
projeto deve aparecer para ele?", e a diferença tem nome: `draft`.

`projects_select` concede a linha de um rascunho ao próprio cliente, e está
certo — a Boop precisa dele para trabalhar. Apertar a policy resolveria pelo
lado errado, porque `authenticated` é um papel só para as três personas.

Então a regra mora no servidor (`src/domains/projects/visibility.ts`), pura e
testável, e o guard do portal faz as duas perguntas de uma vez:

```ts
requireVisiblePortalProject(projectId) // tenant (RLS) + visibilidade (produto)
```

Ele vive no **layout** de `/portal/[projectId]`, não em cada página: um guard por
página é um guard que a próxima página esquece. As três recusas possíveis — não
existe, não é seu, não está visível — devolvem 404 idêntico.

## Como provar que o isolamento vale

```bash
pnpm db:start && pnpm db:reset   # Postgres real; sem Docker cai no plano B
pnpm test:rls                    # 267 casos, todos contra o banco
```

A suíte está em `tests/rls/`:

| Arquivo                           | Prova                                                                         |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `authorization-functions.test.ts` | cada função `app.*`, aos pares, e que nenhuma aceita identidade por parâmetro |
| `isolation.test.ts`               | a matriz 12 tabelas × 6 papéis, medida contra a contagem real                 |
| `internal-visibility.test.ts`     | o que o cliente **não** vê dentro do próprio tenant                           |
| `adversarial.test.ts`             | spoof, troca de tenant, escalada, self-grant, aprovação forjada               |
| `policy-matrix.test.ts`           | a varredura: RLS, policies, grants, forma das policies                        |

Todo caso é escrito aos pares — o que a pessoa vê **e** o que ela não vê. Um
teste que só verifica o caminho feliz não prova isolamento.
