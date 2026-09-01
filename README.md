# BOOP OS

Plataforma proprietária da Boop. Centraliza a experiência do cliente, organiza a
operação interna e torna o processo da consultoria — diagnosticar, pesquisar,
definir estratégia, executar, medir, aprender, evoluir — visível e acompanhável.

O cliente enxerga **uma única interface: Boop**. Ferramentas internas não
aparecem para ele.

> **Status: FASE 0 — Arquitetura e documentação.**
> Ainda não há aplicação. Este repositório contém, por enquanto, apenas a
> arquitetura, o modelo de dados e as regras de engenharia que a implementação
> deve seguir. Ver [`docs/roadmap.md`](docs/roadmap.md).

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [`CLAUDE.md`](CLAUDE.md) | Manual operacional do repositório: stack, regras, comandos, Definition of Done |
| [`docs/product.md`](docs/product.md) | Visão, jornada do cliente, navegação, primeiro marco |
| [`docs/architecture.md`](docs/architecture.md) | Camadas, ciclo de request, estrutura de pastas, convenções |
| [`docs/data-model.md`](docs/data-model.md) | ERD da V0, DDL de referência, tabelas adiadas |
| [`docs/security.md`](docs/security.md) | Modelo de ameaças, RLS, uploads, secrets, logs |
| [`docs/permissions.md`](docs/permissions.md) | Papéis e matriz de permissões |
| [`docs/workflows.md`](docs/workflows.md) | Contrato de workflow e catálogo de operações de domínio |
| [`docs/integrations.md`](docs/integrations.md) | Resend, Notion, calendário, métricas |
| [`docs/deployment.md`](docs/deployment.md) | Ambientes, variáveis, migrations, CI/CD |
| [`docs/roadmap.md`](docs/roadmap.md) | Fases 0 a 20 com Definition of Done |
| [`docs/spec-review.md`](docs/spec-review.md) | Inconsistências, riscos e decisões em aberto |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records |

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Supabase
(Postgres + Auth + Storage) · Vercel · Resend · Notion (interno, a partir da FASE 17).

## Princípios

1. **Supabase é a fonte única da verdade.** Notion, Vercel e Resend não são banco.
2. **Multi-tenant desde a primeira migration.** Cliente A nunca vê Cliente B.
3. **Segurança em duas camadas.** Autorização na aplicação *e* RLS no banco.
4. **Monolito modular.** Sem microservices, sem fila distribuída, sem CQRS.
5. **Nada aprovado é sobrescrito em silêncio.** Estratégia e conteúdo são versionados.

## Setup (a partir da FASE 1)

```bash
cp .env.example .env.local   # preencher
npm install
supabase start               # Postgres + Auth + Storage locais (Docker)
npm run db:reset             # aplica migrations + seed
npm run dev
```

Instruções completas em [`docs/deployment.md`](docs/deployment.md).
