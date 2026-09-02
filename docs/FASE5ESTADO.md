# FASE 5 — Estado de entrega

**Admin e clientes.** Branch `claude/boop-phase-5-admin-clients-clybmw`, partindo
de `3f28b65` (fim da FASE 4).

O container de trabalho é efêmero; este documento é o que sobrevive a ele.

---

## O que se tornou real

A operação interna deixou de ser uma tela com um parágrafo e passou a ser cinco
rotas que leem e escrevem o Supabase de verdade.

| Rota                         | O que faz                                                              |
| ---------------------------- | ---------------------------------------------------------------------- |
| `/admin`                     | redireciona para clientes — não é tela, é porta                        |
| `/admin/clientes`            | lista real, com contagem de pessoas e estado vazio com voz             |
| `/admin/clientes/novo`       | criação, só `boop_admin` (404 para os demais)                          |
| `/admin/clientes/[clientId]` | detalhe, edição, vínculos, convite e status — a única tela com `notes` |
| `/admin/usuarios`            | pessoas, papel, alcance, desligamento, convite                         |
| `/admin/atividade`           | o activity log visível para a Boop                                     |

**Sem SQL manual, sem seed, sem Studio, sem dado hardcoded.** É o critério do §88
do briefing, e é o que a fase entrega.

---

## Mocks

**Removidos:** nenhum arquivo de `src/mocks/` saiu, e isso é correto — não havia
mock de admin. `/admin` era um placeholder textual (`admin/page.tsx` dizia "a
gestão de clientes entra a partir da FASE 5"), e ele virou a rota real.

**Preservados de propósito:** os dezesseis blocos de `src/mocks/hartmann.ts` e as
dezessete funções de `src/lib/data/portal.ts`. Eles alimentam o PORTAL —
projetos, jornada, estratégia, conteúdo, arquivos, reuniões, resultados —, e o
portal é FASE 6 em diante. `DEMO_PROJECT_ID` continua onde estava.

---

## Camada de acesso a dados

```
src/domains/clients/       o tenant
  types.ts                 3 projeções + as listas de colunas + `toClientPublic`
  schemas.ts               zod .strict() das 4 entradas
  queries.ts               3 leituras, cada uma com o próprio guard
  mutations.ts             createClient · updateClient · setClientStatus · setClientArchived
  actions.ts               'use server' — adapta FormData, delega
  components/              client-form · client-status-controls · client-status-mark

src/domains/people/        pessoas e vínculos (profiles + client_memberships)
  types.ts · schemas.ts · queries.ts · mutations.ts · actions.ts · components/
  mutations: inviteUser · grantClientAccess · revokeClientAccess · disableUser

src/lib/workflow/          define.ts (os 8 passos) · errors.ts · action-state.ts
src/lib/data/projection.ts a convenção de campo interno
src/lib/activity/queries.ts a leitura do log
```

**Por que `client_memberships` fica em `people` e não em `clients`.** Um vínculo é
o acesso de uma pessoa a um cliente. Convidar, dar acesso, remover e desligar são
a mesma operação vista de ângulos diferentes; separá-las em dois domínios criaria
um par que só sabe existir importando o outro. `clients` fica sozinho com o
tenant, e a TELA de detalhe compõe os dois — composição é papel de tela.

---

## Proteção de campo interno

A dívida datada da FASE 4. Fechada em três camadas independentes:

| Camada | Mecanismo                                                         | Falha em         |
| ------ | ----------------------------------------------------------------- | ---------------- |
| 1      | `CLIENT_PUBLIC_COLUMNS` / `CLIENT_LIST_COLUMNS` não pedem `notes` | teste de RLS     |
| 2      | `AssertClientFacing<T>` recusa o tipo que carregue campo interno  | `pnpm typecheck` |
| 3      | `getClientDetailForBoop()` exige `client.read_internal_notes`     | teste de unidade |

A camada 2 merece uma nota: a restrição é recursiva
(`T extends NoInternalFields<T>`) e o braço de falha é um objeto **nomeado**, não
`never`. O compilador diz qual campo violou a regra:

```
Type 'ClientPublic' does not satisfy the constraint
'{ CAMPO_INTERNO_EM_PROJECAO_CLIENT_FACING: "notes" }'
```

**Outros campos internos encontrados nesta superfície:** nenhum além de `notes`.
`profiles` não tem coluna interna. `email` é PII e aparece só em projeções
Boop-side, atrás de `requireBoop()`. `activity_log.metadata` guarda
identificadores e transições, e a tela projeta campo a campo em vez de despejar
o JSON.

**`content_versions.internal_notes` já está em `INTERNAL_FIELDS`**, antes de
existir query de conteúdo. A primeira leitura client-facing de versão (FASE 10)
já nasce sob a trava.

**Serialização de RSC:** a proteção real é não buscar. A lista de clientes também
não pede `notes` — não por segurança, mas porque a tela não usa, e o que não sai
do banco não vai para o payload.

---

## Autorização

Nada novo na FASE 4 foi afrouxado. Os guards, `can()` e as policies são os
mesmos; a fase os exercita pela primeira vez com dado real.

| Ator            | `/admin` | criar cliente | editar cliente | arquivar | convidar | desligar |
| --------------- | :------: | :-----------: | :------------: | :------: | :------: | :------: |
| não autenticado |  login   |       —       |       —        |    —     |    —     |    —     |
| `client_user`   | **404**  |       —       |       —        |    —     |    —     |    —     |
| `boop_member`   |    ✓     |    **404**    | ✓ com vínculo  |  **—**   |  **—**   |  **—**   |
| `boop_admin`    |    ✓     |       ✓       |       ✓        |    ✓     |    ✓     |    ✓     |

404 e não 403: 403 confirmaria que o recurso existe, e quem troca uuid na URL
enumeraria tenants pela diferença entre as duas respostas.

---

## Banco

**Uma migration nova:** `20260902160001_people_administration_boundaries.sql`.

Duas funções `security definer`, que são o gatilho de revisão que a ADR-0022
deixou marcado — "uma operação de administração de pessoas (FASE 5) que exija
escrever `profiles` fora da promoção":

- `assign_invited_profile_role(uuid, user_role)` — o papel de quem foi convidado
- `disable_profile(uuid)` — o desligamento

`profiles` continua **sem policy e sem GRANT de UPDATE para ninguém**, inclusive
`boop_admin`. Nenhuma tabela nova, nenhuma policy alterada, nenhum GRANT novo.

**As três recusas que estão no corpo das funções**, e não em policy: `boop_admin`
como valor de papel; alvo igual a quem chama; perfil que não está `invited`. Cada
uma tem teste adversarial — a proteção não aparece no catálogo do Postgres, então
um `if` que sumisse num refactor não quebraria nenhum outro teste.

---

## Testes

**474 → 622** (+148). Todos os 474 anteriores continuam verdes, sem edição.

| Arquivo                                      | Casos | O que prende no lugar                             |
| -------------------------------------------- | ----: | ------------------------------------------------- |
| `tests/rls/phase5-people-boundaries.test.ts` |    18 | as duas fronteiras, adversarialmente              |
| `tests/rls/phase5-admin-surface.test.ts`     |    33 | projeções por papel, cross-tenant, auto-concessão |
| `tests/unit/workflow-define.test.ts`         |    21 | os oito passos e a ORDEM deles                    |
| `tests/unit/phase5-schemas.test.ts`          |    25 | o que o zod rejeita                               |
| `tests/unit/projection.test.ts`              |    15 | a convenção de campo interno                      |
| `tests/unit/phase5-messages.test.ts`         |     9 | nenhum código chega à tela sem tradução           |
| `tests/component/client-form.test.tsx`       |    10 | estados, a11y, o aviso de campo interno           |
| `tests/component/member-list.test.tsx`       |     9 | lista (nunca tabela), vazio com voz               |
| `tests/unit/auth-callback.test.ts`           |    +8 | a segunda porta do callback                       |

Dois testes merecem nota:

- **`phase5-admin-surface`** importa as constantes de coluna do CÓDIGO DE
  PRODUÇÃO. O que roda contra o Postgres é a string que `getClientPublic()` passa
  ao `.select()`, não uma imitação dela.
- **`phase5-messages`** LÊ o código-fonte dos `mutations.ts` e extrai cada
  `WorkflowError('...')`. Uma lista transcrita envelheceria no dia em que alguém
  acrescentasse um `throw` — que é o dia em que o teste precisa falhar.

### Três bugs que os testes acharam antes do QA

1. **`z.email().trim()` validava antes de limpar.** Um e-mail colado com espaço —
   o caso mais comum — seria recusado como inválido. Virou
   `z.string().trim().toLowerCase().pipe(z.email())`.
2. **`revokeClientAccess` não conferia o que o DELETE removeu.** A policy de
   DELETE **filtra** em vez de recusar, então um DELETE sem direito volta com
   `error = null` e zero linhas — e o workflow escreveria `membership.revoked` no
   log para uma revogação que não aconteceu.
3. **Anúncio duplicado nos formulários.** O `Callout` tem `role="status"` e a
   região `aria-live` repetia a mesma frase: leitor de tela falava duas vezes.

---

## Staging

`boop-os-staging` · `sa-east-1` · ref `njlkuzrppnwkgrdacmos`.

- Migration aplicada. **Fingerprint idêntico nas nove partes** — colunas,
  constraints, índices, triggers, enums, funções, RLS, policies e grants.
- Advisors de segurança: **zero achados de RLS**. Os quatro WARN de
  `authenticated_security_definer_function_executable` são o desenho, e estão
  classificados em `docs/security.md`.
- Advisors de performance: as mesmas classes INFO já classificadas na FASE 4
  (`created_by` sem índice — não está em predicado de policy; `unused_index` num
  staging ocioso). Nenhuma classe nova.
- Adversarial em transação desfeita: projeção client-facing sem `notes` ✓,
  projeção interna com `notes` ✓, `disable_profile` por não-admin recusado
  (42501) ✓, `assign_invited_profile_role` com `boop_admin` recusado (42501) ✓,
  auto-desligamento recusado (42501) ✓.
- Estado após a validação: 0 clientes, 1 pessoa (o usuário de teste da FASE 3).
  Nada foi deixado para trás.

### O que NÃO foi validado, e por quê

**O caminho HTTP do PostgREST não foi exercitado desta sessão.** Duas razões
somadas: não há daemon Docker (o banco local caiu no plano B — Postgres nu, sem
PostgREST), e a política de rede deste ambiente recusa CONNECT para
`njlkuzrppnwkgrdacmos.supabase.co` (403 no proxy).

O que ficou provado sem ele: as policies, os grants, os predicados e as
projeções, contra o Postgres do staging. O que fica para o QA manual: a
serialização do `supabase-js`, o embed de `profiles` em `client_memberships`, e o
fluxo de sessão ponta a ponta. É o item 1 do checklist.

---

## Débito assumido

| #   | Débito                                                                                                     | Onde                   |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | **Desligar não tem inverso pelo painel.** Reativar exige `provision-user.sh` ou SQL com a chave de serviço | D-13, `spec-review.md` |
| 2   | **O `welcome` não entrou.** Só o `invite`, que é e-mail de autenticação e sai pelo Auth                    | D-14, FASE 16          |
| 3   | **`slug` é imutável.** Typo se resolve criando o certo e arquivando o outro                                | D-15                   |
| 4   | **Sem paginação** em `/admin/atividade` (100 mais recentes) nem em clientes/pessoas                        | quando a lista crescer |
| 5   | **`clients.notes` continua vindo na linha.** RLS é row-level; a proteção é a projeção                      | `security.md`          |
| 6   | **PostgREST não exercitado nesta sessão.** Ver acima                                                       | QA manual, item 1      |

---

## Decisões que dependem de uma pessoa

- **D-01** continua aberta e agora bloqueia de verdade: domínio remetente
  verificado no Resend. Sem ele o convite não sai.
- **D-13** — reativar quem foi desligado é operação de produto ou de
  infraestrutura? O default é infraestrutura, até a FASE 19.

---

## Ações manuais obrigatórias

Documentadas em `docs/deployment.md#configuração-do-auth-para-o-convite-fase-5`.
As três primeiras são pré-requisito do convite funcionar:

1. **SMTP customizado** apontando para o Resend (`Auth → Emails → SMTP`).
2. **Template "Invite user" usando `{{ .TokenHash }}`**, apontando para
   `/auth/callback?token_hash={{ .TokenHash }}&type=invite`. ⚠️ É o passo que
   quebra em silêncio: com o template padrão o GoTrue devolve a sessão no
   fragmento da URL, que nunca chega ao servidor.
3. **Redirect URL** contendo `<APP_URL>/auth/callback`.
4. `SUPABASE_SERVICE_ROLE_KEY` no ambiente da Vercel — sem ela o convite responde
   `invite.not_configured` (a aplicação sobe normalmente).

---

## Próxima fase

**FASE 6 — Projetos e jornada.** Templates tipados, `createProject`
materializando `project_stages`, `advanceStage`, `changeProjectStatus`, e o
componente de jornada no portal. É ela que troca `DEMO_PROJECT_ID` pela lista
real de projetos do usuário e começa a desmontar os mocks do portal.

`defineWorkflow` e a convenção de projeção já existem — a FASE 6 os consome em
vez de construí-los.
