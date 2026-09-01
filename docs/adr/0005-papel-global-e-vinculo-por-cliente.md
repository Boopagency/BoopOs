# ADR-0005 — Papel global, escopo por vínculo

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto

A especificação define três papéis, mas descreve `boop_member` atuando em
"clientes permitidos" — o que sugeriria papel por vínculo. Modelar papel por
vínculo desde já traria uma matriz N×M e telas de administração que ninguém pediu.

## Decisão

`profiles.role` guarda o papel **global** (`boop_admin | boop_member |
client_user`). `client_memberships` concede **escopo**, sem papel próprio.
`boop_admin` dispensa vínculo. `boop_member` e `client_user` só enxergam clientes
onde têm vínculo.

## Alternativas consideradas

| Alternativa                              | Por que não                                                             |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Papel por vínculo desde a V0             | Complexidade sem demanda; três papéis não justificam                    |
| Sem vínculo para `boop_member` (vê tudo) | Fere o menor privilégio; um erro de um membro alcança todos os clientes |
| Papel por projeto                        | Nenhum cliente pediu separação por projeto (D-02)                       |

## Consequências

- Policies simples: papel + `has_client_access(client_id)`.
- Uma pessoa que fosse cliente **e** funcionária da Boop não é representável.
  Caso irreal hoje; se surgir, vira segunda conta.
- Evoluir é aditivo: acrescentar `client_memberships.membership_role` (default
  preenchido a partir do papel global) não quebra nada.

## Gatilho de revisão

D-02 (cliente com aprovador e leitor separados) ou uma pessoa da Boop que só
possa ver um projeto específico dentro de um cliente.
