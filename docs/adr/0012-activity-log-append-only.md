# ADR-0012 — Activity log append-only, com visibilidade desde o início

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto
A §11 pede activity log desde a primeira versão e antecipa que parte dele será
mostrada ao cliente no futuro. Um log que pode ser editado não é auditoria; e um
log sem classificação de visibilidade obriga a reclassificar o passado inteiro no
dia em que virar funcionalidade.

## Decisão
`activity_log` é **append-only**: nenhuma policy de UPDATE ou DELETE para
ninguém, nem para `boop_admin`, mais `revoke` explícito. A coluna `visibility`
(`internal | client`) nasce na primeira migration e é definida no **catálogo de
eventos** (`src/config/activity.ts`), não no local da chamada.

## Alternativas consideradas
| Alternativa | Por que não |
| --- | --- |
| Só log estruturado (stdout) | Não é consultável pelo produto, e a Vercel retém por pouco tempo |
| Event sourcing | O log deriva do estado, não o contrário; a inversão custaria o sistema inteiro |
| Adicionar `visibility` depois | Exigiria reclassificar histórico com regra retroativa e frágil |
| Auditoria por trigger genérico | Registra diff de linha, não intenção; "content.approved" é mais útil que "UPDATE content_items" |

## Consequências
- Ligar o histórico para o cliente (D-05) vira um filtro, não uma migração.
- `metadata` guarda identificadores e transições. **Nunca conteúdo, nunca PII,
  nunca segredo** — é a regra que mantém o log seguro para exposição futura.
- Correção de log é impossível por construção: um evento errado é corrigido com
  um evento novo.
- Crescimento: `bigint identity` e índices por `(client_id, created_at desc)`.
  Particionamento só se e quando o volume exigir.

## Gatilho de revisão
Volume que degrade a consulta, ou exigência legal de expurgo — que colide com
append-only e precisará de decisão explícita.
