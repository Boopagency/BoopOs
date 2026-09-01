# ADR-0007 — Versionamento e aprovação por versão

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto
A §13 é categórica: nada aprovado é sobrescrito em silêncio. Mas a §20 coloca
`caption`, `hook` e `CTA` no item de conteúdo — se a legenda vive no item,
editá-la depois da aprovação destrói o que foi aprovado.

## Decisão
- `content_items` guarda identidade e planejamento; `content_versions` guarda o
  entregável. O mesmo vale para `strategies` / `strategy_versions`.
- Aprovação aponta para a **versão**, nunca para o item.
- Criar v(n+1) marca a anterior como `superseded` e devolve o item para
  `in_production`. A aprovação da v(n) continua registrada e visível.
- `content_items.status` é derivado pelos workflows; nenhuma UI o escreve.
- Índice único parcial garante uma única aprovação válida por versão.

## Alternativas consideradas
| Alternativa | Por que não |
| --- | --- |
| Campos no item + histórico em `jsonb` | Sem constraint, sem FK; a aprovação não teria a que se referir |
| Auditoria por trigger de histórico | Registra mudança, mas não expressa "esta versão foi aprovada por esta pessoa" |
| Cópia integral do item por versão | Duplicação de metadados de planejamento sem ganho |

## Consequências
- O cliente vê "v2" e entende que aprovou a v1 — transparência é o produto.
- Toda leitura de conteúdo precisa resolver a versão corrente; `current_version_id`
  no item evita o join extra no caminho quente.
- Uma versão em rascunho nunca é visível ao cliente
  (`sent_for_approval_at is null`).

## Gatilho de revisão
Demanda de comparar versões lado a lado ou de aprovação parcial (aprovar a arte,
recusar a legenda). Nesse caso a aprovação passaria a apontar para partes.
