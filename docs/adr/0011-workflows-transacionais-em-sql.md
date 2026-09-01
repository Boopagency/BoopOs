# ADR-0011 — Operações atômicas como funções SQL

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto
A §30 exige que todo workflow garanta consistência e registre activity log. Mas
`supabase-js` fala com o PostgREST e **não abre transação**: aprovar um conteúdo
significa gravar a aprovação, atualizar o status do item e registrar o log — três
escritas que não podem ficar pela metade.

## Decisão
As operações que tocam mais de uma linha e não podem ficar parciais rodam como
função Postgres (`security definer`), chamada por `rpc()`. São **cinco** na V0:
`approve_content_version`, `request_content_changes`, `create_content_version`,
`approve_strategy_version`, `submit_onboarding`.

Todo o resto é escrita de uma linha seguida de `logActivity()`.

## Alternativas consideradas
| Alternativa | Por que não |
| --- | --- |
| Segunda conexão via `postgres.js` para transações | Dois drivers, dois modelos de auth, e a RLS deixaria de valer no caminho transacional |
| Aceitar escrita parcial e compensar | Lógica de compensação é mais difícil de acertar do que a transação que ela substitui |
| Toda a lógica em PL/pgSQL | Regra de negócio fora do TypeScript, sem tipo, sem teste unitário fácil |
| Nenhuma atomicidade | Item aprovado sem registro de aprovação: exatamente o que a §13 proíbe |

## Consequências
- A guarda de estado vive dentro da função (`where status = 'awaiting_client'`),
  o que dá **idempotência** de graça: a segunda chamada não encontra linha para
  atualizar e devolve sucesso sem duplicar.
- Cinco pedaços de lógica em SQL. Aceitável — são poucos, são estáveis, e cada um
  tem teste dedicado. Se essa lista crescer, é sinal de que a decisão precisa ser
  revista.
- A regra de negócio principal continua em TypeScript; o SQL cuida de
  atomicidade e transição, não de política.
- Falha do `logActivity()` fora de RPC perde uma linha de auditoria, nunca a
  operação. O log estruturado registra a inconsistência.

## Gatilho de revisão
A lista passar de ~8 funções, ou surgir necessidade de transação envolvendo
chamada externa (que aí não deve ser transação, e sim outbox).
