# ADR-0006 — Jornadas como template em código

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto

A §14 pede etapas configuráveis e a §15 exige que a arquitetura não dependa de
social media. "Configurável" convida a construir um editor visual de jornadas —
uma funcionalidade grande, para um problema que hoje tem cinco tipos de projeto e
uma jornada real.

## Decisão

O **template** da jornada é um objeto tipado em `src/config/journeys`, versionado
com o código. A **instância** são linhas em `project_stages`, materializadas na
criação do projeto. O projeto guarda `journey_key` (ex.: `social.v1`), imutável.

## Alternativas consideradas

| Alternativa                     | Por que não                                                              |
| ------------------------------- | ------------------------------------------------------------------------ |
| Editor visual de jornadas       | Semanas de trabalho para um ganho que hoje é um PR de cinco linhas       |
| Templates em tabela, sem editor | Mesma rigidez do código, mas sem tipo, sem revisão em PR e sem histórico |
| Etapas fixas no componente      | Impede jornada por tipo de projeto, contrariando a §15                   |

## Consequências

- Mudar a jornada é PR revisado, com histórico — não clique em produção.
- Projeto existente não é afetado por mudança de template: já tem as etapas
  materializadas e o `journey_key` com que nasceu.
- Jornada nova = chave nova (`social.v2`). Chaves antigas permanecem no código
  enquanto existir projeto que as use.
- Correção pontual (pular uma etapa, voltar) existe via `setStageState`, sem
  precisar de editor.

## Gatilho de revisão

Alguém de fora da engenharia precisando criar jornada sem deploy.
