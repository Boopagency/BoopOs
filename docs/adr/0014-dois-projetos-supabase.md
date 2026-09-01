# ADR-0014 — Dois projetos Supabase e desenvolvimento local

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto
A §39 pede development, preview/staging e production separados, com variáveis
distintas. O Supabase oferece branching por PR, que é elegante e custa por
branch.

## Decisão
Dois projetos hospedados — `boop-os-staging` e `boop-os-prod` — mais Supabase
local (Docker, via CLI) para desenvolvimento. Todos os previews da Vercel apontam
para staging.

## Alternativas consideradas
| Alternativa | Por que não |
| --- | --- |
| Branching do Supabase por PR | Custo por branch e tempo de provisionamento, para uma equipe que revisa poucos PRs simultâneos |
| Um único projeto para tudo | Teste tocaria dado real; migration arriscada iria direto para produção |
| Três projetos hospedados | O ambiente local já cumpre o papel do de desenvolvimento, com mais velocidade e sem custo |

## Consequências
- Teste de RLS roda contra Postgres real, local, rápido e reproduzível — é o que
  torna a suíte de isolamento viável no CI.
- Previews compartilham banco: um PR pode ver o dado de outro. Aceitável para
  revisão; staging não guarda nada que importe.
- Migration é exercitada duas vezes (local e staging) antes de produção.
- Nenhum segredo de produção fora da produção.

## Gatilho de revisão
Mais de duas pessoas abrindo PR com migration ao mesmo tempo, ou necessidade de
dado de staging estável para demonstração.
