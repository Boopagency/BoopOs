# ADR-0015 — Isolamento entre tenants testado contra Postgres real

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto
A §38 coloca permissões, multi-tenancy e RLS como prioridade máxima de teste. RLS
é a única camada que não dá para testar com mock: mockar o banco testaria o mock.

## Decisão
Suíte `tests/rls` em Vitest, conectando ao Supabase local por Postgres direto.
Cada caso roda numa transação com rollback, assumindo a identidade do usuário:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
-- consultas e asserções
rollback;
```

Casos escritos aos pares: o que **deve** ser visto e o que **não pode** ser visto.
Roda no CI, em todo PR, bloqueando merge.

## Alternativas consideradas
| Alternativa | Por que não |
| --- | --- |
| Testar só pela aplicação (E2E) | Lento, frágil, e não distingue negativa da aplicação de negativa da RLS — que é justamente o que precisa ser provado |
| pgTAP | Assertivas em SQL, longe do resto da suíte; mais uma linguagem de teste para manter |
| Mock do cliente Supabase | Testaria o mock. Não prova nada sobre policy |
| Revisão manual das policies | Não regride: uma policy quebrada em três meses passa despercebida |

## Consequências
- Um caso "Cliente A não vê Cliente B" que passa é prova real.
- O CI precisa subir o Supabase local (Docker), o que custa ~1 minuto por
  execução. Vale.
- O seed precisa manter **dois clientes com usuários distintos** — sem isso a
  suíte não existe.
- Cobre também: negativa de UPDATE cruzado, imutabilidade de `client_id`,
  ausência de UPDATE/DELETE em `activity_log`, e um teste que varre `pg_tables`
  procurando tabela sem RLS.

## Gatilho de revisão
Nenhum previsto. Esta suíte é a fundação da confiança do sistema; se um dia ficar
lenta, otimiza-se o seed, não a cobertura.
