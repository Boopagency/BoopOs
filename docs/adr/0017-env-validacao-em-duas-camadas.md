# ADR-0017 — Environment em duas camadas: exigido agora vs. exigido quando ligado

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 1

## Contexto

O padrão comum em Next.js é validar todo o environment com um schema único no
boot. Aplicado aqui, isso quebraria a fundação: Supabase entra na FASE 3, Resend
na 5 e Notion na 17, mas `pnpm dev` e `pnpm build` precisam funcionar hoje — e
precisam continuar funcionando num clone novo, com `.env.local` vazio.

Ao mesmo tempo, a FASE 0 proíbe ler `process.env` espalhado pelo código.

## Decisão

Um único módulo, `src/config/env.ts`, com duas categorias:

1. **Required now** — validado com Zod no import. Hoje são duas variáveis, ambas
   com default sensato para desenvolvimento.
2. **Required when enabled** — `requireSupabaseEnv()`, `requireResendEnv()`,
   `requireNotionEnv()` validam apenas quando alguém usa a integração, e falham
   nomeando o que falta.

Mais `integrationStatus()`, que devolve apenas booleanos para diagnóstico —
nunca o valor de nenhuma variável.

Uma regra de ESLint (`no-restricted-syntax`) proíbe `process.env` em todo o
código de aplicação; as exceções são este arquivo e os testes, que precisam
montar o ambiente para provar o comportamento.

## Alternativas consideradas

| Alternativa                                 | Por que não                                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Schema único validado no boot               | Quebraria `dev` e `build` até a FASE 17; forçaria valores falsos no `.env.local`                    |
| `t3-env` ou similar                         | Mais uma dependência para uma regra que cabe em um arquivo e precisa deste comportamento sob medida |
| Tudo opcional, checado no uso, sem camada 1 | Perderia a falha cedo onde ela é útil, e espalharia `process.env` de novo                           |
| Flags de feature por integração             | Duas fontes de verdade: a flag e a variável poderiam discordar                                      |

## Consequências

- Clone novo roda com `.env.local` vazio. É o critério de atrito zero da FASE 1.
- Falta de configuração vira erro no ponto de uso, com o nome da variável e o
  apontamento para `.env.example` — não um crash genérico no boot.
- Cada nova integração acrescenta uma função `requireXEnv()` e uma entrada em
  `integrationStatus()`. Custo linear e óbvio.
- Variável pública precisa ser lida por extenso (`process.env.NEXT_PUBLIC_X`)
  para o Next substituir no build; indexação dinâmica não funcionaria no browser.

## Gatilho de revisão

Se a categoria "required now" crescer além de meia dúzia de variáveis, vale
separar `serverEnv` de `publicEnv` com schemas distintos.
