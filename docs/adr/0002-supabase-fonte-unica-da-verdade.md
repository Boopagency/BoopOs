# ADR-0002 — Supabase é a fonte única da verdade

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto
A operação da Boop usa Notion. É tentador tratá-lo como banco: já tem interface,
já tem uso diário. Mas Notion não tem transação, não tem constraint, não tem RLS
e tem limite de taxa.

## Decisão
Todo dado de domínio vive no Postgres do Supabase. Notion é **projeção
unidirecional** para uso operacional interno. Vercel e Resend não guardam estado.
Nenhum estado importante existe apenas no frontend.

## Alternativas consideradas
| Alternativa | Por que não |
| --- | --- |
| Notion como banco | Sem integridade referencial, sem RLS, sem transação, limite de taxa |
| Sync bidirecional | Conflito de escrita é o problema mais caro e mais silencioso de sistemas pequenos |
| Notion como cache de leitura | O portal já lê do Postgres; não haveria ganho |

## Consequências
- Uma falha de sync não invalida nada: o dado principal continua correto.
- A projeção pode ficar desatualizada; isso é aceito e visível em
  `integration_events`.
- O que existe só no Notion (documento interno solto) não é dado de domínio, e o
  produto não pode depender disso.

## Gatilho de revisão
Demanda real de edição no Notion refletindo no Boop OS. Aí a decisão será
escolher um lado por entidade, nunca sync livre nos dois sentidos.
