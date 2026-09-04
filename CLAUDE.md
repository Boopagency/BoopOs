# CLAUDE.md — Boop OS

Manual operacional deste repositório. Leia antes de escrever código.

## O que é

Plataforma proprietária da Boop, consultoria de marca, marketing, conteúdo e
crescimento. Centraliza a experiência do cliente e organiza a operação interna.

O cliente enxerga **uma única interface: Boop**. Ferramentas internas não aparecem
para ele.

Percepção-alvo: _"Eu sei exatamente o que está acontecendo com minha marca."_

**Status atual: FASE 8.5 concluída.**
22 migrations, 19 tabelas com RLS **e políticas**, 11 funções `app.*` de
autorização, 11 fronteiras `security definer` em `public`, e **1262 testes** em
67 arquivos (466 contra Postgres real). Contagem sempre do Vitest, nunca de
`grep`. Fingerprint idêntico nas nove partes — nem a FASE 8 nem a 8.5 **tocaram
o banco**.

**A HOME é real, e nada nela é inventado.** Quatro blocos: abertura pessoal,
estado de atenção, etapa corrente e jornada resumida. Os quatro blocos que
vinham de mock — atenção, próxima entrega, próximo encontro e aprendizado —
morreram, e com eles o CTA que apontava para um projeto inexistente e respondia 404. `src/mocks/` e `src/lib/data/portal.ts` não existem mais.

**A ATENÇÃO é derivada, nunca armazenada**
([ADR-0025](docs/adr/0025-atencao-derivada-nunca-armazenada.md)). Não há tabela,
fila, dismiss nem centro de notificações: `getClientAttention()` compõe a
resposta a cada request chamando os domínios que já autorizam a si mesmos. O
motor não consulta tabela — há guard de código-fonte.

**Calma exige verificação completa**
([ADR-0026](docs/adr/0026-calma-exige-verificacao-completa.md)). Zero itens
porque a leitura falhou **não é** zero pendências: a falha produz um estado
degradado, honesto e neutro. `items.length === 0 ? calm : attention` é a linha
que a fase existe para impedir, e há teste que quebra se alguém a escrever.

**Um `AttentionKind` só nasce com ação real do cliente.** Na V0 existe um:
`onboarding.continue`. `not_started` não gera atenção porque só a Boop abre a
submissão — sem acionabilidade, sem atenção. Nada é antecipado por estar no
roadmap.

**A NAVEGAÇÃO segue a feature, nunca a contagem de linhas** (D-25). Início e
Projeto na FASE 8; as outras cinco entram na fase que as torna reais, e
aparecem mesmo para um cliente com zero dados. Ocultar da navegação **não**
invalida a rota: todas respondem com estado honesto, porque deep link é o
principal caminho de entrada.

**O activity log não alcança o cliente** — nem por derivação (D-30).

**A CASCA é um ambiente, e o celular continua sendo a FASE 8**
([ADR-0027](docs/adr/0027-a-casca-do-portal-e-um-ambiente.md)). Em `lg` o portal
é sidebar + workspace; em `xl` entra a rail contextual, composta pela PÁGINA e
ausente quando não há conteúdo real. Abaixo de `lg` nada mudou — a resposta de
atenção continua acima da dobra em 375 × 667 por construção. A casca não conhece
ciclo, etapa nem equipe, e há varredura que cobra.

**"Quem está no projeto" migrou** da coluna principal de `/projeto` para a rail.
Migrou, não duplicou.

**O QUADRO nasceu sem domínio**
([ADR-0028](docs/adr/0028-kanban-e-drag-and-drop.md)). `BoardViewport`,
`BoardColumn` e `BoardCard` são geometria: não conhecem status, canal, aprovação
nem versão, não alcançam rota nenhuma, e são exercitados só por teste com
fixture sintética. Drag-and-drop fica para a FASE 10, no admin, com `@dnd-kit`
e por ADR — o quadro do cliente é somente-leitura, porque um arrasto não
consegue expressar "pedir ajuste".

**Motion é CSS, e só o workspace anima.** `--motion-page` (220ms) e um `key` por
caminho; a casca é irmã do nó animado, não filha. `<ViewTransition>` do React
funciona sem configuração no Next 16.3.4 e ficou de fora de propósito
(docs/motion.md).

A próxima fase é a 9 (estratégia).

## Vocabulário

- **Marco 1 (M1):** FASES 0–11 + e-mail mínimo. O fluxo ponta a ponta descrito em
  [`docs/product.md`](docs/product.md#marco-1--definição-de-pronto).
- **V0:** FASES 0–20, terminando em produção.
- **Cliente** (`client`) é o **tenant** — a marca atendida, não a pessoa. A pessoa
  é `client_user`.

## Stack

Next.js (App Router) · React · TypeScript strict · Tailwind CSS · Supabase
(Postgres + Auth + Storage) · Vercel · Resend · Notion (interno, FASE 17) ·
GitHub. **Sem n8n**: automação é código TypeScript aqui dentro.

**Toolchain fixado** ([ADR-0016](docs/adr/0016-toolchain-pnpm-node-typescript.md)):
Node 22 (`.nvmrc`) · **pnpm 10, único package manager** — `npm` e `yarn` falham
por `engine-strict` · TypeScript 5.9 e ESLint 9, uma linha atrás do `latest` por
compatibilidade verificada com `typescript-eslint` e `eslint-config-next`.

## Os cinco princípios

1. **Supabase é a fonte única da verdade.** Notion, Vercel e Resend não são banco.
2. **Multi-tenant desde a primeira migration.** Cliente A nunca vê Cliente B.
3. **Duas camadas de autorização.** Aplicação _e_ RLS. Nenhuma sozinha basta.
4. **Nada aprovado é sobrescrito em silêncio.** Estratégia e conteúdo são versionados.
5. **Arquitetura profissional não é arquitetura grande.** Monolito modular,
   Postgres, serverless, integrações simples.

## Onde está cada coisa

| Preciso de…                                           | Leia                                                   |
| ----------------------------------------------------- | ------------------------------------------------------ |
| Visão, jornada, telas, dashboard                      | [`docs/product.md`](docs/product.md)                   |
| Conceito visual, nuvens, mascote, dos e don'ts        | [`docs/design-direction.md`](docs/design-direction.md) |
| Tokens, tipografia, grid, componentes, contraste      | [`docs/design-system.md`](docs/design-system.md)       |
| Durações, easings, fade-rise, reduced motion          | [`docs/motion.md`](docs/motion.md)                     |
| Camadas, pastas, ciclo de request, máquinas de estado | [`docs/architecture.md`](docs/architecture.md)         |
| Tabelas, colunas, índices, o que ficou de fora        | [`docs/data-model.md`](docs/data-model.md)             |
| Migrations, seed, triggers, rodar e testar o banco    | [`docs/database.md`](docs/database.md)                 |
| RLS, uploads, secrets, ameaças                        | [`docs/security.md`](docs/security.md)                 |
| Quem pode o quê                                       | [`docs/permissions.md`](docs/permissions.md)           |
| Funções `app.*`, policies, guards, `can()`            | [`docs/authorization.md`](docs/authorization.md)       |
| Contrato de workflow e catálogo de eventos            | [`docs/workflows.md`](docs/workflows.md)               |
| Resend, Notion, calendário                            | [`docs/integrations.md`](docs/integrations.md)         |
| Ambientes, variáveis, migrations, CI                  | [`docs/deployment.md`](docs/deployment.md)             |
| O que construir agora                                 | [`docs/roadmap.md`](docs/roadmap.md)                   |
| Por que decidimos assim                               | [`docs/adr/`](docs/adr/)                               |
| Estado ao fim da FASE 5                               | [`docs/FASE5ESTADO.md`](docs/FASE5ESTADO.md)           |
| Estado ao fim da FASE 6                               | [`docs/FASE6ESTADO.md`](docs/FASE6ESTADO.md)           |
| Estado ao fim da FASE 7                               | [`docs/FASE7ESTADO.md`](docs/FASE7ESTADO.md)           |
| Estado ao fim da FASE 8                               | [`docs/FASE8ESTADO.md`](docs/FASE8ESTADO.md)           |
| Estado ao fim da FASE 8.5                             | [`docs/FASE85ESTADO.md`](docs/FASE85ESTADO.md)         |
| Inconsistências e decisões pendentes                  | [`docs/spec-review.md`](docs/spec-review.md)           |

Regras imperativas, curtas, para consulta durante o trabalho:
[`.claude/rules/`](.claude/rules/) — `database.md`, `security.md`, `frontend.md`,
`testing.md`, `integrations.md`.

Documentação não se duplica: o **raciocínio** vive em `docs/`, a **obrigação**
vive em `.claude/rules/`. Ao mudar uma decisão, atualize os dois no mesmo PR.

## Regras que não se negociam

**Segurança**

- `service_role` só em `src/lib/supabase/admin.ts` (que importa `server-only`).
  Nunca `NEXT_PUBLIC_`, nunca no browser.
- Server Action é endpoint público: toda action passa por `defineWorkflow`
  (valida → autentica → autoriza → executa → audita → notifica).
- Toda tabela com RLS e políticas explícitas para `select`, `insert`, `update`,
  `delete`. Policy de UPDATE sempre com `USING` **e** `WITH CHECK`.
- `client_id` nunca vem do input: é derivado do pai por trigger e é imutável.
- Recurso inacessível responde **404**, não 403.
- `proxy.ts` renova sessão. Não decide autorização ([ADR-0020](docs/adr/0020-proxy-renova-sessao-e-nao-autoriza.md)).
  Quem protege rota é `requireActor()` no servidor de render.
- Identidade vem sempre de `supabase.auth.getUser()`. `userId`, `role` ou
  `clientId` vindos do navegador não têm autoridade sobre nada.

**Domínio**

- Nenhuma regra de negócio dentro de componente React.
- Nenhum domínio importa outro domínio direto; a coordenação é do workflow.
- Sem `select *`. Sem pasta `utils/` genérica. Sem `any`.
- Status nunca é string solta: vem de `src/config/enums.ts`.
- Aprovação pertence à **versão**, nunca ao item.
- **Jornada é progresso.** Não existe percentual: a etapa responde "onde
  estamos", e "67%" não responde nada.
- `journey_key` e `type` são decididos na criação e **não mudam** (o banco
  recusa). O template é código, a instância é linha.
- **Só `client_user` aprova.** Nem `boop_admin` aprova conteúdo ou estratégia.

**Produto**

- No máximo sete itens de navegação no portal; um oitavo exige justificativa
  escrita. A navegação segue a **feature**, nunca a contagem de linhas (D-25).
- **Bloco sem origem não aparece**, e **calma nunca é dita sem verificação
  completa**.
- Sem biblioteca de UI, de ícones ou de motion ([ADR-0018](docs/adr/0018-sem-biblioteca-de-ui-e-de-motion.md)).
- Aprovar e pedir ajuste têm a mesma prominência visual. Sempre.
- Bloco vazio desaparece; não vira card de "nenhum item".
- Client-facing é mobile first. Nunca tabela com scroll horizontal no celular.
- Interface em pt-BR; código, identificadores e commits em inglês.

## Comandos

_(Disponíveis a partir da FASE 1.)_

```bash
pnpm dev             # aplicação em desenvolvimento
pnpm build           # build de produção
pnpm check           # typecheck + lint + format + test  (o portão da DoD)
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint
pnpm test            # unit + rls
pnpm test:unit       # lógica pura e componentes — não precisa de banco
pnpm test:rls        # schema, invariantes e isolamento contra Postgres real
pnpm test:e2e        # Playwright (FASE 20)

pnpm db:start        # sobe o banco local
pnpm db:stop
pnpm db:status
pnpm db:reset        # recria do zero: migrations + seed
pnpm db:types        # regenera src/lib/supabase/database.types.ts
pnpm db:psql         # console SQL
pnpm db:new <nome>   # cria uma migration
pnpm db:push         # aplica as migrations no projeto linkado
```

`pnpm db:*` usa `supabase start` quando há Docker. **Sem Docker**, cai para um
Postgres nu com shim de `auth` (`scripts/db/local-postgres.sh`) — e avisa em toda
execução. O plano B cobre migrations, constraints, triggers e RLS; não cobre
login, e-mail, Storage nem PostgREST. Ver
[`docs/database.md`](docs/database.md#rodar-localmente).

## Estrutura atual

```
src/app/          (auth) login · bem-vindo   (portal) portal/[projectId]/…   (admin)
src/components/   ui/ (primitivos) · layout/ (cascas: shell, sidebar, switcher,
                  workspace, rail) · brand/ (logo, olhos, nuvens)
                  patterns/ (composições de produto; board = geometria sem domínio)
src/config/       app.ts (produto) · enums.ts (taxonomias) · env.ts (environment)
                  journeys.ts (templates de jornada — ADR-0006)
src/domains/      clients/ · people/ · projects/ · onboarding/ · attention/ (F8)
src/lib/          auth/ (actor, actions, first-login, errors, routes, policy, authorization)
                  data/ (types + projection — a camada de mock morreu na F8)
                  activity/ · logging/ · supabase/ (fronteira) · cn.ts · format.ts
src/proxy.ts      renova a sessão. NÃO autoriza (ADR-0020)
supabase/         migrations/ (forward-only, a fonte do schema) · seed.sql · config.toml
scripts/db/       dev-db.sh (escolhe o motor) · local-postgres.sh + auth-shim.sql
                  (plano B sem Docker) · fingerprint.sql (comparar dois bancos)
scripts/auth/     provision-user.sh — cria pessoa pela Admin API (sem signup público)
tests/unit/       lógica pura       tests/component/  Testing Library
tests/rls/        o que exige Postgres de verdade: schema, enums, invariantes, seed
```

Regras de crescimento:

- **`src/domains/<nome>` nasce na fase do domínio**, nunca como pasta vazia.
- Rota canônica do portal é `/portal/[projectId]`; `/app` redireciona. `/portal`
  é RESOLVEDOR: zero projetos → estado vazio, um → redirect, vários → escolha.
- **Autorização de rota do portal vive no LAYOUT do grupo**, nunca página a
  página. Um guard por página é um guard que a próxima página esquece.
- **Não existe mock.** `src/mocks/` e `src/lib/data/portal.ts` foram deletados na
  FASE 8, e há guard de código-fonte que quebra se voltarem. Toda tela — admin e
  portal — fala com o domínio dono do dado, que carrega o próprio guard. A
  camada de dados existia para isolar ficção; mantê-la depois que a ficção morre
  é deixar a próxima com um lugar pronto para nascer.
- **O motor de atenção compõe domínios, não consulta tabelas.**
  `src/domains/attention` é o único domínio que coordena outros, e a exceção é
  declarada: ele existe para ser o coordenador. Nada ali importa
  `createSupabaseServerClient` nem `supabase/admin` — há guard.
- **Projeção client-facing nunca carrega campo interno.** O tipo passa por
  `AssertClientFacing` (`src/lib/data/projection.ts`) e o build quebra se
  carregar. Campo interno novo entra em `INTERNAL_FIELDS`, e a partir daí toda
  projeção que o carregue para de compilar.
- **Escrita de domínio só por `defineWorkflow`.** Server Action adapta `FormData`
  e delega; não decide nada.
- **Ciclo de vida é RPC, e uma porta só.** Quando uma operação multi-linha vira
  fronteira SQL, as irmãs do mesmo ciclo de vida vão junto — mesmo as de uma
  linha — e o GRANT direto é revogado. Duas portas para o mesmo estado é como
  uma delas fica sem uma checagem (ADR-0024).
- Nenhum componente usa hexadecimal: cor vem de token em `src/app/globals.css`.
- Nenhum `max-w-[Nch]` em wrapper: `ch` resolve no font-size do próprio
  elemento, então a largura vai no elemento que tem o tamanho.
- `process.env` só existe em `src/config/env.ts` (regra do ESLint).
- `console` só existe em `src/lib/logging/logger.ts` (regra do ESLint).
- `src/lib/supabase/database.types.ts` é **gerado**. Não se edita, não se
  formata, não se linta. Mudou o schema? Migration, `db:reset`, `db:types`.

## Definition of Done

Uma tarefa só está pronta quando **tudo** abaixo é verdade:

- [ ] `pnpm check` passa (typecheck + lint + format + test) e `pnpm build` passa
- [ ] Tabela nova: RLS + quatro políticas + teste de isolamento (o que vê **e** o
      que não vê)
- [ ] Workflow novo: validação zod `.strict()`, autorização, activity log e teste
- [ ] Nenhum caminho novo pelo qual um cliente alcance dado de outro
- [ ] Estados de loading, vazio, erro e sucesso implementados
- [ ] Funciona no celular, quando a tela é client-facing
- [ ] Acessível: semântica, teclado, `label`, foco visível, contraste AA
- [ ] Nenhum segredo, PII ou signed URL em log
- [ ] Documentação afetada atualizada no mesmo PR
- [ ] Decisão arquitetural relevante virou ADR

## Como trabalhar aqui

1. **Uma fase por vez.** Não avance sem terminar a anterior. O roadmap é ordem,
   não sugestão.
2. **Segurança antes de tela.** A FASE 4 (multi-tenancy + RLS) era o gargalo
   real, e está verde. Toda tabela nova daqui em diante nasce com RLS, quatro
   decisões de policy (ainda que a decisão seja "não existe") e teste de
   isolamento aos pares — o teste de varredura falha se faltar.
3. **Diante de duas soluções válidas, escolha a mais simples, mais segura e mais
   fácil de manter** — sem fechar a porta para a evolução.
4. **Antes de criar abstração, pergunte se existem três casos reais.** Ver a lista
   de overengineering a evitar em
   [`docs/spec-review.md` §4](docs/spec-review.md#4-overengineering-a-evitar).
5. **Encontrou inconsistência na especificação?** Registre em
   [`docs/spec-review.md`](docs/spec-review.md), proponha o default e siga. Não
   pare o trabalho por decisão que tem default razoável.
6. **Mudou uma decisão?** ADR novo, referenciando o anterior. ADR aceito não se
   reescreve: substitui-se.
7. **Ao fechar uma fase, entregue o patch.** `git format-patch` da fase e do
   histórico completo, mais um documento curto de estado: o que foi feito, o
   que ficou faltando, qual débito foi assumido e qual decisão depende de uma
   pessoa. O container de trabalho é efêmero; o patch é o que sobrevive a ele.

## O que este projeto deliberadamente não tem

Microservices, Kubernetes, event sourcing, CQRS, Kafka, Redis, fila distribuída,
ORM, monorepo, GraphQL, tRPC, realtime, i18n, motor genérico de permissões,
construtor visual de jornadas ou de formulários, sync bidirecional com Notion.

Se algo dessa lista entrar, entra por ADR, com o gatilho concreto que o
justificou.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
