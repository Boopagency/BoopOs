# ADR-0004 — RLS baseada em funções `security definer`

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto

As policies precisam responder duas perguntas em quase toda avaliação: qual o
papel do usuário, e ele tem vínculo com este cliente. Ambas exigem ler
`profiles` e `client_memberships`. Escrever isso direto no predicado provoca
recursão (uma policy sobre `profiles` que consulta `profiles`; `clients` →
`client_memberships` → `clients`).

## Decisão

Funções no schema `app` (`actor_role`, `is_boop`, `is_boop_admin`,
`has_client_access`, `has_project_access`, `is_client_user`), todas `security
definer`, `stable`, com `search_path` fixado. O schema `app` não é exposto pelo
PostgREST e tem `revoke all` para `anon` e `authenticated`. Toda policy usa
`(select auth.uid())`, nunca `auth.uid()` solto.

## Alternativas consideradas

| Alternativa                                            | Por que não                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Papel e vínculos no JWT via `custom_access_token_hook` | Claims ficam obsoletos até o token expirar (~1 h): revogar acesso não teria efeito imediato |
| Subquery direta no predicado                           | Recursão de policy; predicado duplicado em dezenas de lugares                               |
| Autorização só na aplicação                            | Um bug em uma query vira vazamento entre clientes                                           |

## Consequências

- Revogação de vínculo e mudança de papel valem no **request seguinte**.
- Sem recursão: `security definer` ignora RLS por definição.
- Custo: consulta a mais por avaliação de policy. Mitigado por `stable` (o
  planejador reaproveita dentro da query) e pelo índice
  `client_memberships(user_id, client_id)`.
- Funções `security definer` são superfície sensível: `search_path` fixado,
  schema não exposto, revisão obrigatória em qualquer alteração.

## Gatilho de revisão

Consulta lenta comprovada por `explain analyze` em tabela grande. A resposta
provável não é ir para o JWT, e sim materializar o escopo por request na camada
de aplicação, mantendo a RLS como segunda camada.
