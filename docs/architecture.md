# Arquitetura — Boop OS

## Forma do sistema

**Monolito modular, server-first, com o Postgres como fronteira final de
segurança.** Uma aplicação Next.js, um banco, um deploy.

```
                      ┌──────────────────────────┐
   Cliente / Boop ──▶ │   Next.js (Vercel)       │
   (browser)          │   App Router · RSC       │
                      │   Server Actions · API   │
                      └────────────┬─────────────┘
                                   │  sessão em cookie (JWT do usuário)
                                   ▼
                      ┌──────────────────────────┐
                      │        Supabase          │
                      │  Auth · Postgres · Storage│
                      │  RLS em todas as tabelas │
                      └────────────┬─────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
      Resend (e-mail)                        Notion (projeção interna,
      auth via SMTP                           unidirecional, FASE 17)
      produto via API
```

O cliente **nunca** depende de Resend ou Notion para usar o sistema. Se ambos
caírem, o Boop OS continua funcionando; apenas notificações e espelhamento
operacional param.

## Camadas

Ordem de dependência. Uma camada só importa das que estão abaixo dela.

| Camada          | Onde                                                | Responsabilidade                                                | Nunca faz                        |
| --------------- | --------------------------------------------------- | --------------------------------------------------------------- | -------------------------------- |
| **UI**          | `src/app`, `src/components`, `domains/*/components` | Renderizar, coletar input, estados de loading/erro/vazio        | Regra de negócio, acesso a banco |
| **Entrypoints** | Server Actions, Route Handlers                      | Adaptar HTTP ↔ workflow                                         | Lógica; qualquer decisão         |
| **Workflows**   | `domains/*/workflows.ts`                            | Casos de uso: validar, autorizar, executar, auditar, notificar  | SQL cru espalhado, render        |
| **Policy**      | `domains/*/policy.ts`, `lib/permissions`            | `can(actor, action, resource)` — decisão pura                   | I/O                              |
| **Repository**  | `domains/*/repository.ts`                           | Acesso a dados, projeção de colunas, mapeamento linha → domínio | Autorização como única defesa    |
| **Read models** | `lib/data/`                                         | O que cada tela do portal lê, já resolvido                      | Regra de negócio                 |
| **Banco**       | `supabase/migrations`                               | Integridade, RLS, transições atômicas                           | Confiar no app                   |

**Duas camadas de autorização, sempre.** A aplicação decide e nega cedo; a RLS
nega de novo no banco. Nenhuma das duas é considerada suficiente sozinha. Ver
[`security.md`](security.md).

## Ciclo de um request

> **Rotas.** `/portal` é canônica. `/app` existe como redirect em
> `next.config.ts` — é o nome usado no briefing da FASE 1, mantido como alias
> para não haver duas páginas para a mesma coisa.

**Leitura** (`/portal/[projectId]/conteudo`)

1. `middleware.ts` renova o cookie de sessão. Sem sessão → redirect para
   `/login`. _Não decide autorização._
2. O layout do segmento chama `requireProjectAccess(projectId)`, que carrega
   `actor` (`profiles` + vínculos) e devolve 404 se não houver acesso — 404, não
   403, para não confirmar a existência do recurso.
3. O Server Component chama o repository, que consulta o Supabase com o **JWT do
   usuário** — a RLS avalia de novo.
4. O componente recebe tipos de domínio e renderiza.

**Escrita** (aprovar conteúdo)

1. O formulário chama uma Server Action.
2. A action delega para o workflow criado por `defineWorkflow`.
3. Ordem invariável: `input (zod .strict())` → `authenticate` → `authorize` →
   `execute` → `activity log` → `side-effects` → `revalidatePath`.
4. Operações atômicas (aprovação, nova versão, conclusão de onboarding) rodam
   dentro de uma função SQL — domínio + activity log na mesma transação.
5. Side-effects (e-mail) rodam **depois** do commit, isolados: falha registra em
   `notifications` e não derruba a operação.

## Estrutura de pastas

```
.
├── CLAUDE.md
├── .claude/rules/            # regras curtas e imperativas para o Claude Code
├── docs/                     # o raciocínio; ADRs em docs/adr
├── supabase/
│   ├── config.toml
│   ├── migrations/           # SQL versionado, forward-only
│   └── seed.sql              # dados de desenvolvimento
├── src/
│   ├── app/
│   │   ├── (auth)/           # login, callback, verificação
│   │   ├── (portal)/portal/[projectId]/…   # client-facing, mobile first
│   │   ├── (admin)/admin/…   # operação da Boop, desktop first
│   │   └── api/              # Route Handlers: download, webhooks, health
│   ├── components/
│   │   ├── ui/               # primitivos: Button, Field, StatusMark, Callout
│   │   ├── layout/           # cascas: PortalShell, navegação, Container
│   │   ├── brand/            # BoopMark, BoopEyes, CloudLayer
│   │   └── patterns/         # composições de produto: AttentionBlock, Journey…
│   ├── domains/              # ← o coração do sistema
│   │   ├── clients/
│   │   ├── projects/
│   │   ├── onboarding/
│   │   ├── strategy/
│   │   ├── content/
│   │   ├── files/
│   │   ├── meetings/
│   │   ├── analytics/
│   │   └── reviews/
│   ├── lib/
│   │   ├── supabase/         # server.ts · admin.ts · middleware.ts · database.types.ts
│   │   ├── auth/             # getActor, requireActor, requireClientAccess…
│   │   ├── permissions/      # can(), definição do actor, erros
│   │   ├── validation/       # helpers zod compartilhados
│   │   ├── audit/            # logActivity()
│   │   ├── workflows/        # defineWorkflow, createAction, erros tipados
│   │   ├── storage/          # signed upload/download, validação de arquivo
│   │   ├── logging/          # logger estruturado, requestId, redaction
│   │   └── integrations/
│   │       ├── email/        # EmailService + templates (Resend)
│   │       └── notion/       # FASE 17
│   └── config/               # journeys, enums, navegação, constantes de produto
└── tests/
    ├── unit/                 # policy, máquinas de estado, validação
    ├── component/            # componentes com Testing Library
    ├── rls/                  # isolamento entre tenants contra Postgres real (FASE 4)
    └── e2e/                  # Playwright, fluxo do marco 1 (FASE 20)
```

**Esta árvore é o destino, não o estado atual.** Uma pasta só existe quando tem
código dentro: `src/domains/*`, `lib/auth`, `lib/permissions`, `lib/workflows`,
`lib/audit`, `lib/storage` e `lib/integrations` nascem nas fases que as
constroem. O que existe hoje está em [`../README.md`](../README.md#estrutura).

### Anatomia de um domínio

```
src/domains/content/
├── content.types.ts        # tipos de domínio (não são as linhas do banco)
├── content.schema.ts       # zod: input de cada workflow
├── content.state.ts        # máquina de estados + transições permitidas
├── content.policy.ts       # can(actor, 'content.approve', item)
├── content.repository.ts   # leitura/escrita, projeções explícitas
├── content.workflows.ts    # casos de uso
└── components/             # UI específica de conteúdo
```

Regras:

- **Nenhuma regra de negócio dentro de componente React.**
- **Nenhum domínio importa outro domínio diretamente.** Coordenação acontece no
  workflow, que pode chamar repositories de mais de um domínio.
- **Sem pasta `utils/` genérica.** Helper mora ao lado de quem usa, ou vira um
  módulo nomeado em `lib/`.
- **Sem `select *`** — projeção de colunas explícita em toda query.

## Camada de dados do portal

`src/lib/data/` é a única fronteira entre as telas e a origem dos dados.

```
MOCK  →  DATA LAYER (lib/data/types.ts)  →  SUPABASE
```

Três decisões deixam essa troca limpa:

1. **Toda função é `async`.** Hoje resolve na hora, amanhã faz I/O. Nenhum
   componente precisa virar assíncrono depois. (É por isso que
   `@typescript-eslint/require-await` está desligado só nessa pasta.)
2. **Toda função recebe `projectId` e valida.** É onde `requireProjectAccess()`
   entra na FASE 4 — a autorização já tem lugar reservado, e recurso
   inacessível já responde 404.
3. **A visibilidade de conteúdo já é filtrada ali**, com a mesma regra que a RLS
   vai aplicar no banco: `idea`, `planned`, `in_production` e `internal_review`
   nunca chegam ao portal.

`src/mocks/` é a única fonte de dados fictícios do repositório, e **nenhum
componente a importa**.

**Realtime (futuro).** As telas são Server Components que leem da camada de
dados a cada request. Quando a fase de realtime chegar, um provider assina o
canal e revalida a rota — a árvore de componentes não muda, porque nenhuma
delas guarda estado de servidor.

## Jornadas como dado tipado

A jornada é um **template em código** (`src/config/journeys/social.ts`),
versionado com o repositório; o projeto guarda as **etapas instanciadas** em
`project_stages`.

```ts
export const SOCIAL_V1 = defineJourney({
  key: 'social.v1',
  projectType: 'social',
  stages: [
    { key: 'kickoff', label: 'Início do projeto', recurring: false },
    { key: 'onboarding', label: 'Onboarding', recurring: false },
    { key: 'immersion', label: 'Imersão', recurring: false },
    { key: 'research', label: 'Pesquisa', recurring: false },
    { key: 'strategy', label: 'Estratégia', recurring: false },
    { key: 'production', label: 'Produção', recurring: true },
    { key: 'publishing', label: 'Publicação', recurring: true },
    { key: 'review', label: 'Review', recurring: true },
  ],
})
```

Por que em código e não em tabela de template: uma consultoria pequena muda
jornada junto com o produto, em PR revisado, não em tela de administração. Ver
[ADR-0006](adr/0006-jornadas-como-template-em-codigo.md).

Alterar o template **não** altera projetos existentes: eles carregam o
`journey_key` com que nasceram e as etapas já materializadas. Uma jornada nova
recebe uma chave nova (`social.v2`).

## Máquinas de estado

Strings de status nunca aparecem soltas no código. Cada uma tem uma constante em
`src/config/enums.ts`, um tipo derivado e um mapa de transições.

### Conteúdo

```
idea → planned → in_production → internal_review → awaiting_client
                       ▲                                │
                       │                    ┌───────────┴───────────┐
                       │                    ▼                       ▼
                       └──────────  changes_requested            approved
                                                                    │
                                                                    ▼
                                                    scheduled → published → archived
```

Regras invariantes:

- A aprovação pertence à **versão**, nunca ao item.
- Criar uma nova versão marca a anterior como `superseded` e devolve o item para
  `in_production`. A aprovação anterior permanece registrada.
- `content_items.status` é derivado pelos workflows. Nenhuma UI o escreve direto.

### Estratégia

```
draft → awaiting_client → approved
             │
             └──▶ changes_requested → (nova versão) → awaiting_client
```

### Projeto

Dois eixos independentes: `projects.status`
(`draft | active | paused | completed | archived`) e as etapas em
`project_stages` (`pending | current | done | skipped`, no máximo uma `current`
por projeto, garantido por índice único parcial).

## Convenções de código

- TypeScript **strict**. `any` proibido; use `unknown` + narrowing. `as` só com
  comentário justificando.
- Server Component é o padrão. `'use client'` apenas em folhas que precisam de
  estado ou evento, com o menor escopo possível.
- Todo input externo passa por zod `.strict()` — objetos com campo desconhecido
  são rejeitados (mass assignment).
- Datas sempre `timestamptz`; o servidor nunca formata em timezone local
  implícito. Padrão de exibição: `America/Sao_Paulo`.
- Dinheiro: não existe na V0.
- **Código, identificadores, enums e mensagens de commit em inglês. Documentação,
  textos de interface e conteúdo em pt-BR.**
- Erros de domínio são tipados (`WorkflowError` com `code`), nunca `throw new
Error('deu ruim')`. A UI mapeia `code` para texto em português.
- **`process.env` só em `src/config/env.ts`** e **`console` só em
  `src/lib/logging/logger.ts`** — as duas regras são aplicadas pelo ESLint, não
  por combinado.
- Componente nunca usa hexadecimal: cor vem de token (`bg-surface`,
  `text-muted`). Os tokens estruturais estão em `src/app/globals.css`; a
  identidade da Boop os substitui na FASE 1.5 sem tocar em nenhum primitivo.

## O que esta arquitetura deliberadamente não tem

Microservices, event sourcing, CQRS, Kafka, Redis, fila distribuída, ORM,
monorepo, GraphQL, tRPC, realtime, i18n, motor genérico de permissões.
Justificativas em [`spec-review.md` §4](spec-review.md#4-overengineering-a-evitar).

Se alguma dessas entrar depois, entra por ADR, com o gatilho que a justificou
escrito.
