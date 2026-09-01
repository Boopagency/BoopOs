# BOOP OS

Plataforma proprietária da Boop. Centraliza a experiência do cliente, organiza a
operação interna e torna o processo da consultoria — diagnosticar, pesquisar,
definir estratégia, executar, medir, aprender, evoluir — visível e acompanhável.

O cliente enxerga **uma única interface: Boop**. Ferramentas internas não
aparecem para ele.

> **Status: FASE 1.5 concluída — sistema visual e protótipo navegável.**
> Onze telas do portal do cliente, com identidade Boop e dados fictícios.
> Nenhuma ação é registrada: não há banco nem autenticação — isso começa na
> FASE 2. Ver [`docs/roadmap.md`](docs/roadmap.md).

## Stack

| Camada           | Escolha                                               |
| ---------------- | ----------------------------------------------------- |
| Framework        | Next.js 16 (App Router, Server Components por padrão) |
| Linguagem        | TypeScript 5.9 em modo estrito                        |
| UI               | React 19 · Tailwind CSS 4 (tokens em CSS variables)   |
| Validação        | Zod 4                                                 |
| Backend          | Supabase — Postgres, Auth, Storage (FASE 2+)          |
| Testes           | Vitest 4 · Testing Library                            |
| Qualidade        | ESLint 9 · Prettier 3                                 |
| Deploy           | Vercel                                                |
| E-mail           | Resend (FASE 5)                                       |
| Operação interna | Notion (FASE 17)                                      |

## Requisitos

- **Node.js 22** — a versão exata está em [`.nvmrc`](.nvmrc). Com nvm: `nvm use`.
- **pnpm 10** — é o único package manager do projeto. `npm` e `yarn` falham por
  `engine-strict`. Se não tiver: `corepack enable && corepack prepare pnpm@10 --activate`.

## Como rodar

```bash
git clone https://github.com/Boopagency/BoopOs.git
cd BoopOs
pnpm install
cp .env.example .env.local   # pode ficar vazio nesta fase
pnpm dev
```

Abra <http://localhost:3000>.

**O `.env.local` pode ficar inteiramente vazio.** Supabase, Resend e Notion só
exigem configuração quando forem realmente usados — ver
[ADR-0017](docs/adr/0017-env-validacao-em-duas-camadas.md).

## Rotas

| Rota                                          | O que é                                     |
| --------------------------------------------- | ------------------------------------------- |
| `/`                                           | Índice do protótipo, com o fluxo completo   |
| `/login`                                      | Primeiro contato com a marca                |
| `/bem-vindo`                                  | Primeiro acesso                             |
| `/portal`                                     | Redireciona para o projeto do cliente       |
| `/portal/[projectId]`                         | Dashboard                                   |
| `/portal/[projectId]/projeto`                 | Escopo, time e jornada completa             |
| `/portal/[projectId]/onboarding`              | Onboarding em seis seções                   |
| `/portal/[projectId]/estrategia`              | Direção editorial e aprovação               |
| `/portal/[projectId]/conteudo`                | Feed editorial                              |
| `/portal/[projectId]/conteudo/[id]`           | Detalhe e aprovação da peça                 |
| `/portal/[projectId]/resultados`              | Resultados e aprendizados                   |
| `/portal/[projectId]/encontros` · `/arquivos` | Encontros e materiais                       |
| `/admin`                                      | Operação interna (placeholder até a FASE 5) |
| `/app`                                        | Alias que redireciona para `/portal`        |

## Comandos

```bash
pnpm dev            # desenvolvimento em http://localhost:3000
pnpm build          # build de produção
pnpm start          # serve o build

pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm test           # vitest
pnpm format         # prettier --write
pnpm format:check   # prettier --check

pnpm check          # typecheck + lint + format:check + test
```

`pnpm check` é o portão antes de abrir PR. O CI roda o mesmo, mais o build.

## Variáveis de ambiente

Todas em [`.env.example`](.env.example), separadas por fase. Nenhum valor real
neste repositório, nunca.

**Necessárias agora:** nenhuma. `NEXT_PUBLIC_APP_URL` tem default de
desenvolvimento.

**Fases futuras:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` (FASE 3) · `RESEND_API_KEY`, `EMAIL_FROM` (FASE 5) ·
`NOTION_API_KEY` (FASE 17).

`SUPABASE_SERVICE_ROLE_KEY` ignora toda a RLS e é lida por um único arquivo
(`src/lib/supabase/admin.ts`). Nunca vai para o browser. Ver
[`docs/security.md`](docs/security.md).

## Estrutura

```
src/
  app/            (auth) · (portal)/portal/[projectId] · (admin)
  components/     ui/ · layout/ · brand/ · patterns/
  config/         app.ts · enums.ts · env.ts
  lib/            data/ (camada de acesso) · logging/ · supabase/ · format.ts
  mocks/          dados fictícios — nenhum componente os importa
tests/
  unit/           lógica pura, contraste, formatação
  component/      componentes com Testing Library
reference/brand/  assets oficiais da marca
docs/             arquitetura, design, modelo de dados, segurança, ADRs
.claude/rules/    regras imperativas para quem (ou o que) escreve código
```

As pastas de domínio (`src/domains/*`) nascem junto com o domínio, na fase dele —
não como diretórios vazios. Ver [`docs/architecture.md`](docs/architecture.md).

## Documentação

| Documento                                              | Conteúdo                                                 |
| ------------------------------------------------------ | -------------------------------------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                               | Manual operacional: regras, comandos, Definition of Done |
| [`docs/product.md`](docs/product.md)                   | Visão, jornada do cliente, navegação, primeiro marco     |
| [`docs/design-direction.md`](docs/design-direction.md) | Conceito visual, nuvens, mascote, dos e don'ts           |
| [`docs/design-system.md`](docs/design-system.md)       | Tokens, tipografia, grid, componentes, contraste         |
| [`docs/motion.md`](docs/motion.md)                     | Durações, easings, fade-rise, reduced motion             |
| [`docs/architecture.md`](docs/architecture.md)         | Camadas, ciclo de request, estrutura, convenções         |
| [`docs/data-model.md`](docs/data-model.md)             | ERD da V0, DDL de referência, tabelas adiadas            |
| [`docs/security.md`](docs/security.md)                 | Modelo de ameaças, RLS, uploads, secrets, headers        |
| [`docs/permissions.md`](docs/permissions.md)           | Papéis e matriz de permissões                            |
| [`docs/workflows.md`](docs/workflows.md)               | Contrato de workflow e catálogo de operações             |
| [`docs/integrations.md`](docs/integrations.md)         | Resend, Notion, calendário                               |
| [`docs/deployment.md`](docs/deployment.md)             | Ambientes, variáveis, migrations, CI/CD                  |
| [`docs/roadmap.md`](docs/roadmap.md)                   | Fases 0 a 20 com Definition of Done                      |
| [`docs/spec-review.md`](docs/spec-review.md)           | Inconsistências, riscos e decisões em aberto             |
| [`docs/adr/`](docs/adr/)                               | Architecture Decision Records                            |

## Princípios

1. **Supabase é a fonte única da verdade.** Notion, Vercel e Resend não são banco.
2. **Multi-tenant desde a primeira migration.** Cliente A nunca vê Cliente B.
3. **Segurança em duas camadas.** Autorização na aplicação _e_ RLS no banco.
4. **Monolito modular.** Sem microservices, sem fila distribuída, sem CQRS.
5. **Nada aprovado é sobrescrito em silêncio.** Estratégia e conteúdo são versionados.
