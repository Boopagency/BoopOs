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
  - trigger de autoria quando houver `created_at`/`created_by`: `created_at` é
    estrito, autoria é **não-reatribuível** (pode virar nula pelo
    `on delete set null` da FK, nunca apontar para outra pessoa). Policy decide
    LINHA, nunca COLUNA — há varredura que cobra;
  - índices para os caminhos de leitura reais.
- Depois de mexer no schema: `pnpm db:reset && pnpm db:types` e commite
  `database.types.ts`. Ele é **gerado**: não edite, não formate, não linte.
- Coluna case-insensitive nova se escreve `extensions.citext`. A extensão saiu
  de `public` na migration `20260901160001`.
- Enum novo entra no Postgres **e** em `src/config/enums.ts` — o teste de paridade
  falha se divergirem.

## Nunca

- `select *`. Sempre projeção explícita de colunas.
- Aceitar `client_id` vindo do input. Derive do pai por trigger.
- Policy de UPDATE só com `USING`. Sempre `USING` **e** `WITH CHECK`.
- `auth.uid()` solto no predicado. Sempre `(select auth.uid())`.
- Consultar a própria tabela dentro da policy dela. Use as funções `app.*`.
- Escrever em `activity_log` fora de `logActivity()` ou das funções SQL.
- Colocar dado real de cliente em `seed.sql`. E-mail fictício mora em
  `example.com`, domínio reservado que não alcança ninguém.
- Apontar uma FK para `activity_log` com `on delete set null`. A tabela é
  append-only: `SET NULL` é um `UPDATE` e o trigger o rejeita
  ([ADR-0019](../../docs/adr/0019-log-append-only-vence-a-exclusao-de-pessoa.md)).

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

- [ ] `pnpm db:reset` recria do zero sem erro
- [ ] `database.types.ts` regenerado e commitado
- [ ] Teste de RLS cobrindo a tabela nova (o que vê **e** o que não vê)
- [ ] Nenhuma tabela sem RLS (o teste de varredura passa)
- [ ] Enum novo em `PG_ENUMS` (`src/config/enums.ts`) — as duas paridades passam
- [ ] Linter do Supabase (`security` e `performance`) rodado depois de aplicar
      em staging; achado vira migration nova, nunca edição da antiga
- [ ] `scripts/db/fingerprint.sql` bate entre local e staging
