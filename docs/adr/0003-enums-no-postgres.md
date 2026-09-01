# ADR-0003 — Enums no Postgres, espelhados em TypeScript

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto

A especificação insiste (§14, §20) em não espalhar strings pelo código. As
taxonomias — papel, tipo de projeto, status de conteúdo — precisam de uma
definição canônica, e o banco precisa recusar valor inválido.

## Decisão

Tipos `enum` do Postgres para as taxonomias, espelhados por constantes em
`src/config/enums.ts`. Um teste compara `pg_enum` com as constantes e falha na
divergência.

## Alternativas consideradas

| Alternativa         | Por que não                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `text` + `CHECK`    | O gerador de tipos do Supabase produz `string`; perde-se a união no TypeScript, que é justamente o que evita string solta |
| Tabela de lookup    | Join a mais em toda query, e ainda assim sem tipo no TypeScript                                                           |
| Só validação em zod | O banco aceitaria lixo vindo de qualquer caminho que não passe pela aplicação                                             |

## Consequências

- `database.types.ts` traz uniões reais; um `switch` sem caso vira erro de compilação.
- Acrescentar valor é trivial (`alter type ... add value`).
- **Remover ou renomear valor é caro:** exige tipo novo, `alter column ... using`,
  drop do antigo. Receita registrada em `.claude/rules/database.md`.
- Existe duplicação (banco + TypeScript), mitigada pelo teste de paridade.

## Gatilho de revisão

Se alguma taxonomia começar a mudar toda semana, ela vira `text` + `CHECK` ou
tabela de lookup — provavelmente `content_channel` e `content_format` serão as
primeiras candidatas.
