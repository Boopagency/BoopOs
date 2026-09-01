# ADR-0013 — Migrations SQL versionadas, sem ORM

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto

A §40 exige que toda alteração de banco seja versionada e reprodutível, e que
produção não dependa de "eu cliquei nisso no painel". A RLS é escrita em SQL de
qualquer forma.

## Decisão

Supabase CLI com migrations SQL em `supabase/migrations`, forward-only. Tipos
gerados por `supabase gen types` e commitados. **Sem ORM.**

## Alternativas consideradas

| Alternativa                     | Por que não                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Prisma / Drizzle                | Duas fontes de verdade de schema; policies de RLS ficariam de fora do modelo, no melhor caso como SQL cru |
| Alterar pelo painel do Supabase | Produção passaria a depender de memória; sem revisão, sem histórico                                       |
| Migrations com `down`           | Rollback de banco em produção quase nunca é seguro; a resposta correta é migration corretiva              |

## Consequências

- Schema, RLS, triggers e funções vivem no mesmo lugar, revisados em PR.
- Não há query builder tipado; as queries são escritas com o cliente Supabase,
  com projeção explícita de colunas, dentro dos repositories.
- Mudança destrutiva exige **expandir → migrar → contrair** em três deploys.
- Migration nunca é editada depois de aplicada em staging ou produção.
- O CI falha se `database.types.ts` estiver desatualizado, ou se existir tabela
  sem RLS.

## Gatilho de revisão

Query complexa o suficiente para justificar um construtor tipado — que aí seria
adotado só para leitura, sem assumir o schema.
