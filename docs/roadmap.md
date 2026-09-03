# Roadmap técnico — Boop OS

Vinte fases, na ordem da especificação. **Uma fase por vez.** Não se avança com
`typecheck`, `lint`, `test` ou `build` quebrados.

Vocabulário fixo:

- **Marco 1 (M1):** FASES 0–11 + e-mail mínimo. É o fluxo da §45 ponta a ponta.
- **V0:** FASES 0–20, terminando em produção.

Definition of Done comum a **todas** as fases:

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` verdes
- [ ] Tabela nova com RLS + quatro políticas + teste de isolamento
- [ ] Workflow novo com activity log e teste de autorização
- [ ] Estados de loading, vazio e erro implementados
- [ ] Funciona no celular quando a tela é client-facing
- [ ] Documentação afetada atualizada no mesmo PR

---

### FASE 0 — Arquitetura e documentação ✅

Revisão da especificação, decisões, ERD, matriz de permissões, ADRs, regras de
engenharia.
**Pronto quando:** os documentos deste diretório existem e as decisões em aberto
estão listadas com default assumido.

### FASE 1 — Fundação Next.js ✅

Next 16 + React 19 + TypeScript 5.9 strict + Tailwind 4; pnpm e Node fixados;
ESLint + Prettier + Vitest; `next.config.ts` com cabeçalhos de segurança; tokens
estruturais em CSS variables; seis primitivos de UI acessíveis; rotas `/`,
`/portal` e `/admin` com layouts desacoplados; error boundaries e 404; camada de
environment em duas camadas; fronteira do Supabase sem banco; CI.
**Pronto:** `pnpm check` e `pnpm build` verdes, 23 testes, nenhuma rota lê banco.

### FASE 1.5 — Boop Visual System & Product Prototype ✅

_Inserida pelo briefing da FASE 1. Numerada como 1.5 de propósito: renumerar as
fases 2–20 quebraria as dezenas de referências cruzadas nesta documentação e nas
regras de `.claude/rules`._

Identidade da Boop aplicada sobre os tokens estruturais da FASE 1: paleta
extraída dos assets oficiais, Poppins, grid editorial, sistema de nuvens e de
mascote, motion em CSS. Onze telas navegáveis: login, boas-vindas, dashboard,
projeto, onboarding, estratégia, conteúdo, detalhe, aprovação, resultados,
encontros e arquivos.
**Pronto:** `pnpm check` e `pnpm build` verdes, 69 testes, zero overflow em
cinco breakpoints, nenhum hexadecimal em componente, camada de dados isolando
os mocks. Documentado em `design-direction.md`, `design-system.md` e
`motion.md`.

### FASE 2 — Supabase e migrations ✅

`supabase init`, enums, tabelas do M1, triggers (`updated_at`, `client_id`
derivado, tenant imutável, `profiles` a partir de `auth.users`), índices,
`seed.sql` com dois clientes distintos, `db:types`, harness de teste de RLS.
**Pronto quando:** `pnpm db:reset` recria tudo do zero e os tipos gerados estão
commitados.

**Pronto:** 19 tabelas, 16 enums, 10 migrations, seed com Hartmann e Velmont e
64 testes contra Postgres real. Banco vazio → migrations → seed → tipos → testes
funciona ponta a ponta, e a impressão digital do schema local bate com a do
`boop-os-staging` (`sa-east-1`), hash a hash. Documentado em
[`database.md`](database.md).

**RLS está ligada e SEM políticas** — negação por padrão, que é o baseline
seguro, não a autorização. As políticas são a FASE 4, e nada antes disso deve
ser lido como "o banco está protegido para multi-tenant".

### FASE 3 — Autenticação ✅

Magic Link com PKCE, `@supabase/ssr`, renovação de sessão no `proxy.ts`,
`/login`, callback,
logout, `getActor`/`requireActor`, `recordFirstLogin`, signup público desligado.
**Pronto quando:** dá para entrar por link e sair; rota protegida sem sessão
redireciona para `/login`.

**Pronto:** o fluxo inteiro existe — link, callback PKCE, sessão em cookie,
Actor, guard, logout — com 66 testes de autenticação e o bundle do cliente
conferido (nem service role, nem cliente administrativo). **Validado no
ambiente hospedado** em 2026-09-02: Vercel contra o `boop-os-staging`, com
e-mail real, do pedido do link ao logout. Documentado em
[`authentication.md`](authentication.md); as duas decisões da fase viraram
[ADR-0020](adr/0020-proxy-renova-sessao-e-nao-autoriza.md) e
[ADR-0021](adr/0021-service-role-para-resolver-identidade.md).

**O Actor carrega identidade, não escopo.** Ele responde "quem é", e nada
além disso: sem `clientIds`, sem vínculo, sem projeto. Enquanto a RLS não
tiver políticas, `getActor()` lê `profiles` pela `service_role` — fronteira
temporária, com revisão **obrigatória** na FASE 4.

### FASE 4 — Multi-tenancy e RLS ✅ ⚠️ fase crítica

Funções `app.*`, políticas nas quatro operações de todas as tabelas, guards
(`requireClientAccess`, `requireProjectAccess`), `can()` e a matriz de permissões
em código, suíte `tests/rls` completa, teste que falha se existir tabela sem RLS.
**Pronto quando:** todos os casos da [`permissions.md`](permissions.md#testes-obrigatórios)
passam — inclusive os que devem falhar.
**Nenhuma fase seguinte começa antes desta estar verde.**

**Pronto:** 11 funções `app.*` (as 6 do desenho + 5 resolvedores para as tabelas
sem `client_id`), policies e GRANTS nas 19 tabelas, `can()` puro, guards que
consultam sob RLS, e 474 testes — 267 deles contra Postgres real. Documentado em
[`authorization.md`](authorization.md).

**A dívida da FASE 3 foi paga.** `service_role` não tem mais chamador em `src/`:
`getActor()` lê pelo JWT, e as duas escritas que precisavam de privilégio viraram
fronteiras nomeadas e menores
([ADR-0022](adr/0022-autorizacao-no-banco-e-fim-da-service-role-de-identidade.md),
que substitui a 0021). I-15 fechada.

**O Actor continua identidade-only.** `clientIds` não entrou, e agora por
decisão: escopo é estado do banco no instante do request.

**Fica de dívida para a FASE 5:** RLS é row-level, não column-level —
`clients.notes` e `content_versions.internal_notes` viajam na linha. Hoje nada
as expõe (o portal lê mocks); ligar o dado real exige projeção explícita.
Registrado em [`security.md`](security.md).

### FASE 5 — Admin e clientes ✅

`/admin/clientes` (listar, criar, editar, arquivar), `/admin/usuarios`, convite
(`inviteUser` com service role), vínculos, activity log visível para a Boop.
Entra aqui o **`EmailService` mínimo** (`invite`, `welcome`) e o SMTP customizado
do Supabase — antecipado da FASE 16 ([spec-review I-06](spec-review.md#i-06-a-o-primeiro-marco-exige-e-mail-que-só-aparece-na-fase-16)).
**Pronto quando:** dá para criar o cliente Hartmann, convidar duas pessoas e elas
receberem e-mail de verdade.

**Pronto:** as cinco telas de `/admin` lendo e escrevendo Supabase de verdade,
`defineWorkflow` com os oito passos do contrato, sete workflows de domínio, duas
fronteiras SQL novas e 622 testes (baseline 474 → +148). Nenhum mock na
superfície administrativa.

**A dívida column-level da FASE 4 foi paga.** `clients.notes` é protegida em três
camadas — a coluna não sai do banco, o tipo não a carrega, a capacidade é
conferida — e a convenção vale para os campos internos das fases seguintes
([`security.md`](security.md#a-dívida-foi-paga-na-fase-5--em-três-camadas)).

**`service_role` voltou a ter exatamente um chamador**, e é o que a ADR-0022
previa: criar a conta em `auth.users` no convite. Nenhuma consulta de domínio
passa por ela.

**Fica de dívida para depois:** o `welcome` (e-mail de produto) não entrou —
`invite` sai pelo Auth com SMTP customizado, e o `EmailService` sobre a API do
Resend continua na FASE 16. Reativar quem foi desligado não tem caminho pelo
painel. As duas viraram D-13 e D-14 em [`spec-review.md`](spec-review.md).

### FASE 6 — Projetos e jornada ✅

Templates de jornada tipados (`src/config/journeys.ts`), `createProject`
materializando `project_stages` **na mesma transação**, `advanceStage`,
`setStageState`, `updateProject`, `changeProjectStatus`, admin de projeto e o
portal lendo projeto e jornada do banco. Jornadas mínimas para os cinco
`project_type` — prova de que a arquitetura não depende de social.
`DEMO_PROJECT_ID` deixou de existir.
**Pronto quando:** a Boop cria um projeto social, avança a etapa e o cliente vê a
mudança. ✅ **Validado em ambiente hospedado por QA humano, sem problemas.**

Três funções SQL novas ([ADR-0023](adr/0023-fronteiras-transacionais-de-projeto-e-jornada.md))
e a imutabilidade de `journey_key`/`type` no banco, que a ADR-0006 declarava e o
schema não garantia. Ver [`docs/FASE6ESTADO.md`](FASE6ESTADO.md).

### FASE 7 — Onboarding ✅ (validada em ambiente hospedado)

Renderização a partir do schema, uma seção por vez, progresso, autosave com
`upsert`, rascunho, `submitOnboarding` (função SQL), leitura das respostas no
admin. Sem perguntas do tipo `file`.
**Pronto quando:** a cliente responde no celular, fecha o navegador, volta e não
perdeu nada; ao finalizar, a etapa avança sozinha.

**Entregue, e o que mudou em relação ao previsto:**

- O catálogo social saiu do `seed.sql` e virou migration (**D-23**): ele é
  produto da Boop, e o seed não roda em staging nem em produção — sem isso o
  onboarding seria impossível de abrir no ambiente hospedado.
- O ciclo de vida da submissão passou a ser escrito **só por RPC**
  ([ADR-0024](adr/0024-ciclo-de-vida-por-rpc-e-fim-da-escrita-direta-na-submissao.md)):
  `onboarding_submissions` perdeu os GRANTs de INSERT e UPDATE. Com eles, um
  `client_user` movia `draft → submitted` pelo PostgREST, sem jornada e sem log.
- `reopenOnboarding` entrou na fase (**D-22**). Sem ela, um envio com erro de
  digitação não teria conserto sem SQL manual em produção.
- O e-mail `onboarding_completed` **NÃO** entrou (**D-20**): o `EmailService`
  não existe, e uma linha `pending` em `notifications` sem consumidor seria uma
  fila que ninguém esvazia. O gatilho volta na FASE 16.

### FASE 8 — Dashboard

Seis blocos na ordem da [`product.md`](product.md#dashboard-início), blocos vazios
desaparecendo, "Precisa da sua atenção" derivado por query, mobile first.
**Pronto quando:** o cliente entende, em cinco segundos e no celular, o que
depende dele.

### FASE 9 — Estratégia

`StrategyContentSchema` (zod), editor no admin, apresentação editorial no portal,
`createStrategyVersion`, `sendStrategyForApproval`, e-mail `strategy_ready`.
Aprovação fica para a FASE 11.
**Pronto quando:** a Boop escreve uma estratégia e o cliente a lê como
apresentação, não como formulário.

### FASE 10 — Conteúdo

`content_items` + `content_versions`, máquina de estados, admin de produção,
lista e preview no portal, `createContentVersion` (função SQL) marcando a versão
anterior como `superseded`.
**Pronto quando:** criar a v2 de um conteúdo aprovado preserva a aprovação da v1 e
devolve o item para produção.

### FASE 11 — Feedback e aprovação 🎯 Marco 1

`approveContent`, `requestContentChanges`, `approveStrategy`,
`requestStrategyChanges`, comentários (interno vs. público), idempotência de
duplo clique, e-mails `content_needs_approval` e `changes_requested`.
**Pronto quando:** o fluxo inteiro da §45 roda ponta a ponta em staging, com dois
clientes distintos, sem toque manual no banco.

### FASE 12 — Arquivos

Bucket privado, `requestUpload`/`confirmUpload`, validação de MIME e tamanho no
servidor, `visibility`, download assinado por Route Handler, tela de Arquivos,
anexo em versão de conteúdo, pergunta de onboarding tipo `file`, limpeza de
órfãos.
**Pronto quando:** o Cliente A não baixa arquivo do Cliente B nem com o ID
correto, e não vê arquivo `internal` do próprio cliente.

### FASE 13 — Reuniões

CRUD de reuniões, timezone `America/Sao_Paulo`, próximo encontro no dashboard,
tela de Encontros, `meeting_url` manual.
**Pronto quando:** o cliente vê o próximo encontro com data, hora e link.

### FASE 14 — Resultados

`account_metrics` e `content_metrics`, entrada manual no admin, tela de
Resultados com a seção **O que aprendemos** em primeiro plano.
**Pronto quando:** existe número, existe leitura do número, e o texto pesa mais
que o gráfico.

### FASE 15 — Monthly Review

`monthly_reviews`, narrativa fixa (fizemos → aconteceu → funcionou → não
funcionou → aprendemos → muda), `publishMonthlyReview` disparando
`startNextCycle`, e-mail `review_ready`.
**Pronto quando:** publicar o review reabre as etapas recorrentes e o cliente vê
"ciclo 2".

### FASE 16 — Resend (catálogo completo)

Todos os templates, agrupamento de avisos em lote, tela de `notifications` com
reenvio manual, allowlist de destinatário fora de produção.
**Pronto quando:** nenhum envio acontece sem linha em `notifications`, e uma falha
é visível e reenviável.

### FASE 17 — Notion

`NotionAdapter`, `integration_events`, projeções unidirecionais (cliente criado,
onboarding concluído, alteração solicitada), falha isolada.
**Pronto quando:** derrubar o Notion (chave inválida) não altera nenhum
comportamento do produto.

### FASE 18 — Automações

Consolidação dos side-effects: idempotência por `dedupe_key`, reprocessamento,
`automation_runs` **apenas se** o retry automático se justificar.
**Pronto quando:** reexecutar uma automação não duplica efeito.

### FASE 19 — Endurecimento de segurança

Revisão completa das policies, CSP com nonce, revisão de erro e log, `npm audit`,
teste de penetração manual do isolamento, revisão da matriz de permissões contra
o código, decisão sobre rate limiting.
**Pronto quando:** o checklist de [`security.md`](security.md#checklist-de-revisão-de-segurança)
passa inteiro e os advisors do Supabase estão limpos.

### FASE 20 — Produção

Domínio, DNS, verificação do Resend, backup com restauração testada, monitoramento,
runbook de incidente, checklist de [`deployment.md`](deployment.md#antes-de-ir-a-produção-fase-20),
onboarding do primeiro cliente real.
**Pronto quando:** a Hartmann está usando em produção.

---

## Caminho crítico do Marco 1

```
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11
                    ↑
            EmailService mínimo entra aqui
```

A FASE 4 é o gargalo real: tudo depois dela depende de o isolamento entre
clientes estar provado. Ela merece mais tempo do que qualquer tela.

## Riscos de cronograma

| Risco                                      | Sinal                                               | Resposta                                                         |
| ------------------------------------------ | --------------------------------------------------- | ---------------------------------------------------------------- |
| RLS consumindo mais tempo que o previsto   | Testes de isolamento falhando de formas inesperadas | Trave o escopo: só as tabelas do M1 na FASE 4                    |
| Editor de estratégia virando CMS           | "Precisa de blocos arrastáveis"                     | Campos fixos por seção; rich text só onde já existir necessidade |
| Preview de conteúdo virando editor de arte | "Falta cortar a imagem"                             | Preview é leitura; a arte vem pronta do design                   |
| Admin virando ERP                          | Telas de configuração aparecendo sem demanda        | Toda tela nova de admin precisa de um workflow que a exija       |
