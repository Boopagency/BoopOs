# ADR-0016 — Toolchain: pnpm, Node 22 e TypeScript 5.9

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 1

## Contexto

A FASE 0 escreveu os comandos como `pnpm …`, mas nunca decidiu package
manager de fato: não havia `package.json` nem lockfile. A FASE 1 precisava
escolher, e escolher uma vez.

Ao instalar, dois conflitos de versão apareceram:

- `typescript@7.0.2` é o `latest`, mas `typescript-eslint@8` declara peer
  `typescript >=4.8.4 <6.1.0`. Adotar TS 7 significaria lint sem suporte.
- `eslint@10` é o `latest`, mas `eslint-plugin-jsx-a11y` e
  `eslint-plugin-react-hooks` (dentro de `eslint-config-next@16`) declaram peer
  `eslint ^9`.

## Decisão

- **pnpm 10** como package manager único, fixado em `packageManager` e
  reforçado por `engine-strict` no `.npmrc`. Os usos de `npm run` na
  documentação da FASE 0 foram atualizados.
- **Node 22.22.2** (LTS), fixado em `.nvmrc` e em `engines`.
- **TypeScript 5.9.3** — a última estável suportada pelo ecossistema de lint.
- **ESLint 9.39.5** — a última linha suportada pelos plugins do Next.

## Alternativas consideradas

| Alternativa                              | Por que não                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| npm, seguindo a letra dos docs da FASE 0 | Nenhum lockfile existia; a instrução da FASE 1 pedia pnpm e não havia decisão real a preservar |
| TypeScript 7 com peers ignorados         | Lint sem suporte declarado; quebra silenciosa é pior que versão anterior                       |
| ESLint 10 ignorando os peers             | Os plugins fora de suporte seriam justamente os de acessibilidade e de hooks                   |
| Bun ou Yarn                              | Nenhum ganho sobre pnpm, que já estava disponível no ambiente                                  |

## Consequências

- Instalação determinística; `--frozen-lockfile` no CI.
- Duas versões deliberadamente atrás do `latest`, registradas como dívida com
  gatilho explícito. Não é inércia: é compatibilidade verificada.
- Misturar npm ou yarn falha na hora, em vez de gerar um segundo lockfile.

## Gatilho de revisão

`typescript-eslint` publicar suporte a TypeScript 7 e `eslint-config-next`
publicar suporte a ESLint 10 — momento em que as duas subidas viram um PR só,
com `pnpm check` verde como critério.
