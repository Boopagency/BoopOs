# Regras — Banco de dados

Raciocínio em [`docs/data-model.md`](../../docs/data-model.md) e
[ADR-0013](../../docs/adr/0013-migrations-sql-versionadas.md). Aqui só o que é obrigatório.

## Sempre

- Toda mudança de schema nasce em `supabase/migrations/*.sql`. Nunca pelo Studio.
- Migrations são **forward-only**. Não escreva `down`. Corrija com migration nova.
- **Nunca edite** uma migration já aplicada em staging ou produção.
- Tabela nova nasce, **na mesma migration**, com:
  - `enable row level security`;
  - políticas explícitas para `select`, `insert`, `update` e `delete`;
  - `created_at`/`updated_at` + trigger de `updated_at`;
  - `client_id` (quando for tabela de domínio) + trigger que o deriva do pai;
  - índices para os caminhos de leitura reais.
- Depois de mexer no schema: `npm run db:reset && npm run db:types` e commite
  `database.types.ts`.
- Enum novo entra no Postgres **e** em `src/config/enums.ts` — o teste de paridade
  falha se divergirem.

## Nunca

- `select *`. Sempre projeção explícita de colunas.
- Aceitar `client_id` vindo do input. Derive do pai por trigger.
- Policy de UPDATE só com `USING`. Sempre `USING` **e** `WITH CHECK`.
- `auth.uid()` solto no predicado. Sempre `(select auth.uid())`.
- Consultar a própria tabela dentro da policy dela. Use as funções `app.*`.
- Escrever em `activity_log` fora de `logActivity()` ou das funções SQL.
- Colocar dado real de cliente em `seed.sql`.

## Escrita multi-linha

Se a operação toca mais de uma linha e não pode ficar pela metade, é função SQL
(`security definer`) chamada por `rpc`. São cinco na V0
([`docs/workflows.md`](../../docs/workflows.md#consistência-quando-usar-função-sql)).
Antes de criar a sexta, releia
[ADR-0011](../../docs/adr/0011-workflows-transacionais-em-sql.md).

## Mudança destrutiva

Três deploys, nunca um:
1. adiciona a coluna nova, a aplicação escreve nas duas;
2. backfill e passa a ler da nova;
3. remove a antiga.

Renomear valor de enum: crie o tipo novo, `alter column ... using`, drop do
antigo. Nunca em uma linha só.

## Antes de abrir o PR

- [ ] `npm run db:reset` recria do zero sem erro
- [ ] `database.types.ts` regenerado e commitado
- [ ] Teste de RLS cobrindo a tabela nova (o que vê **e** o que não vê)
- [ ] Nenhuma tabela sem RLS (o teste de varredura passa)
