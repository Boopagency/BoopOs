# ADR-0001 — Monolito modular com Next.js e Supabase

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto

A Boop é uma consultoria enxuta. O sistema precisa de arquitetura profissional,
não de arquitetura grande. Não há time de plantão, não há SRE, e cada peça de
infraestrutura é custo permanente de manutenção.

## Decisão

Uma aplicação Next.js (App Router) organizada por domínio, com Supabase
(Postgres + Auth + Storage) como backend, deploy na Vercel. Sem serviços
separados, sem fila distribuída, sem cache externo.

## Alternativas consideradas

| Alternativa                              | Por que não                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| API separada (NestJS/Express) + frontend | Dois deploys, dois modelos de auth, duas fontes de tipo, para um único consumidor |
| Microservices                            | Nenhum limite de escala ou de time justifica; multiplicaria a superfície de falha |
| Backend serverless próprio (Lambda/Hono) | Reimplementaria auth, storage e RLS que o Supabase já entrega                     |
| Rails/Laravel + Postgres                 | Perde-se tipagem ponta a ponta e o cliente Supabase para storage/auth             |

## Consequências

- Um só lugar para tipos, validação e regra de negócio.
- Acoplamento ao Supabase concentrado em `lib/supabase` e nas migrations SQL; o
  domínio depende de repositories, não do SDK.
- Modularidade vira disciplina de pastas, não fronteira de rede: exige a regra
  "domínio não importa domínio" para não virar bola de lama.
- Server Actions são endpoints públicos e precisam de disciplina de autorização.

## Gatilho de revisão

Necessidade de processamento longo (> 60 s), de consumidor externo à aplicação
(app mobile nativo, API pública) ou de mais de ~8 pessoas mexendo no código.
