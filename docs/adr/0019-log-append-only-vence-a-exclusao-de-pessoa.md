# ADR-0019 — O log append-only vence a exclusão de pessoa

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 2

## Contexto

[ADR-0012](0012-activity-log-append-only.md) decidiu que `activity_log` não
aceita `UPDATE` nem `DELETE` de ninguém — nem de `boop_admin`, nem de
`service_role`. Um log que pode ser editado não é auditoria. A garantia é um
trigger, e não RLS, justamente porque `service_role` ignora RLS.

A primeira versão da tabela declarou `actor_id` como
`references profiles (id) on delete set null`, pelo mesmo motivo de
`strategy_approvals.decided_by`: se a pessoa sair da empresa, o registro do que
ela fez continua existindo.

**As duas coisas não cabem juntas.** `ON DELETE SET NULL` é implementado como um
`UPDATE` na tabela filha. O trigger rejeita todo `UPDATE`. Resultado: apagar um
perfil que tem qualquer linha no log falha com
`activity_log e append-only: UPDATE nao e permitido` — uma mensagem que não
explica nada para quem só tentou remover um usuário.

Isso não foi descoberto por leitura. Foi um teste de invariante que quebrou:
`tests/rls/invariants.test.ts`, o caso "o perfil morre junto com o usuário de
auth".

## Decisão

**`activity_log.actor_id` é `ON DELETE RESTRICT`.** Quem deixou rastro no log
não é apagado.

A operação equivalente no produto já existe e é outra: `profile_status` vai para
`disabled`, e o acesso cai no request seguinte. É o ciclo de vida que
[ADR-0009](0009-autenticacao-magic-link-e-convites.md) já descreve — `invited →
active → disabled`. Nunca houve um fluxo de "excluir pessoa".

O par de testes que fixa o comportamento:

- pessoa **sem** rastro no log: apagar `auth.users` cascateia e o perfil some;
- pessoa **com** rastro: a exclusão é recusada com `23503`.

## Alternativas consideradas

| Alternativa                                                  | Por que não                                                                                                                                                                               |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manter `SET NULL` e permitir o `UPDATE` que anula `actor_id` | Exigiria o trigger distinguir "o Postgres anulando a FK" de "alguém reescrevendo o log", comparando a linha inteira coluna a coluna. Uma lista que apodrece e um furo na garantia central |
| Tirar a FK e guardar `actor_id` como uuid solto              | É o que muitos logs de auditoria fazem. Mas perde integridade referencial: um id inventado entraria sem reclamação, e o log é exatamente onde não se quer dado inventado                  |
| Abrir mão do append-only e confiar em RLS                    | `service_role` ignora RLS. Seria trocar uma garantia real por uma aparência de garantia                                                                                                   |
| Apagar as linhas do log junto com a pessoa (`CASCADE`)       | Reescreve história. É o oposto do propósito da tabela                                                                                                                                     |

## Consequências

- **Ninguém que agiu no sistema pode ser apagado.** Desabilita-se. Para uma
  plataforma de operação com trilha de auditoria, é a escolha correta — e agora
  é explícita, não acidental.
- Apagar um usuário pelo painel do Supabase Auth **falha** para quem tem
  histórico, com erro de chave estrangeira. É ruidoso, e ruidoso é melhor que
  silencioso: o painel não deveria ser o caminho para remover acesso.
- Se um dia houver exigência de exclusão de dado pessoal (LGPD, D-11), o caminho
  é **anonimizar a linha de `profiles`** — nome, e-mail e avatar — mantendo o id
  e o log intactos. O log guarda identificadores e transições, nunca conteúdo
  nem PII, então anonimizar o perfil já remove o dado pessoal do sistema.
  Nenhuma linha do log precisa ser tocada.
- `activity_log.actor_id` fica sem índice de cobertura, e o linter do Supabase
  aponta isso. Aceito: o único caminho que usaria o índice é o `DELETE` que a
  decisão acabou de tornar inválido.

## Gatilho de revisão

Uma exigência formal de exclusão de dado pessoal (D-11, FASE 20). Aí se escreve
o procedimento de anonimização — que não muda esta decisão, apenas a completa.
