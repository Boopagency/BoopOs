# CLAUDE.md — Boop OS

Manual operacional deste repositório. Leia antes de escrever código.

## O que é

Plataforma proprietária da Boop, consultoria de marca, marketing, conteúdo e
crescimento. Centraliza a experiência do cliente e organiza a operação interna.

O cliente enxerga **uma única interface: Boop**. Ferramentas internas não aparecem
para ele.

Percepção-alvo: _"Eu sei exatamente o que está acontecendo com minha marca."_

**Status atual: FASE 1.5 concluída — sistema visual e protótipo navegável. Onze
telas do portal do cliente, com dados fictícios e nenhuma persistência. Sem
banco, sem auth. A próxima fase é a 2 (Supabase e migrations).**

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
| RLS, uploads, secrets, ameaças                        | [`docs/security.md`](docs/security.md)                 |
| Quem pode o quê                                       | [`docs/permissions.md`](docs/permissions.md)           |
| Contrato de workflow e catálogo de eventos            | [`docs/workflows.md`](docs/workflows.md)               |
| Resend, Notion, calendário                            | [`docs/integrations.md`](docs/integrations.md)         |
| Ambientes, variáveis, migrations, CI                  | [`docs/deployment.md`](docs/deployment.md)             |
| O que construir agora                                 | [`docs/roadmap.md`](docs/roadmap.md)                   |
| Por que decidimos assim                               | [`docs/adr/`](docs/adr/)                               |
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
- `middleware.ts` renova sessão. Não decide autorização.

**Domínio**

- Nenhuma regra de negócio dentro de componente React.
- Nenhum domínio importa outro domínio direto; a coordenação é do workflow.
- Sem `select *`. Sem pasta `utils/` genérica. Sem `any`.
- Status nunca é string solta: vem de `src/config/enums.ts`.
- Aprovação pertence à **versão**, nunca ao item.
- **Só `client_user` aprova.** Nem `boop_admin` aprova conteúdo ou estratégia.

**Produto**

- Sete itens de navegação no portal. Um oitavo exige justificativa escrita.
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
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint
pnpm test            # unit + rls
pnpm test:unit       # policies, máquinas de estado, validação
pnpm test:rls        # isolamento contra Postgres real (exige supabase start)
pnpm test:e2e        # Playwright (FASE 20)

supabase start          # Postgres + Auth + Storage locais
supabase stop
pnpm db:reset        # recria o banco local: migrations + seed
pnpm db:types        # regenera src/lib/supabase/database.types.ts
pnpm db:new <nome>   # cria uma migration
```

## Estrutura atual

```
src/app/          (auth) login · bem-vindo   (portal) portal/[projectId]/…   (admin)
src/components/   ui/ (primitivos) · layout/ (cascas) · brand/ (logo, olhos, nuvens)
                  patterns/ (composições de produto)
src/config/       app.ts (produto) · enums.ts (taxonomias) · env.ts (environment)
src/lib/          data/ (camada de acesso) · logging/ · supabase/ (fronteira)
                  cn.ts · format.ts
src/mocks/        dados fictícios — a ÚNICA fonte, e nenhum componente a importa
tests/unit/       lógica pura       tests/component/  Testing Library
```

Regras de crescimento:

- **`src/domains/<nome>` nasce na fase do domínio**, nunca como pasta vazia.
- Rota canônica do portal é `/portal/[projectId]`; `/app` redireciona.
- **Tela nunca importa `src/mocks`.** Fala com `src/lib/data`, que hoje lê dos
  mocks e na FASE 5 passa a ler do Supabase — o contrato é `data/types.ts`.
- Nenhum componente usa hexadecimal: cor vem de token em `src/app/globals.css`.
- Nenhum `max-w-[Nch]` em wrapper: `ch` resolve no font-size do próprio
  elemento, então a largura vai no elemento que tem o tamanho.
- `process.env` só existe em `src/config/env.ts` (regra do ESLint).
- `console` só existe em `src/lib/logging/logger.ts` (regra do ESLint).

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
2. **Segurança antes de tela.** A FASE 4 (multi-tenancy + RLS) é o gargalo real:
   nada depois dela começa antes de a suíte de isolamento estar verde.
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
