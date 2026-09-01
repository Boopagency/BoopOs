# Regras — Testes

Raciocínio em [ADR-0015](../../docs/adr/0015-testes-de-rls-contra-postgres-real.md)
e [`docs/permissions.md`](../../docs/permissions.md#testes-obrigatórios).

## Prioridade

Nesta ordem. O topo nunca é sacrificado pelo resto.

1. **Isolamento entre tenants e RLS**
2. **Permissões** (a matriz inteira, célula por célula)
3. **Versionamento e aprovação** (nada aprovado sobrescrito; idempotência)
4. **Uploads** (autorização, validação, visibilidade)
5. Máquinas de estado e validação
6. Fluxo do Marco 1 ponta a ponta (E2E, FASE 20)

## Onde cada coisa mora

| Pasta | O quê | Ferramenta |
| --- | --- | --- |
| `tests/unit` | policies, máquinas de estado, schemas zod, mapeadores | Vitest |
| `tests/rls` | isolamento contra Postgres real (Supabase local) | Vitest + `pg` |
| `tests/e2e` | fluxo do Marco 1 | Playwright (FASE 20) |

## Como se escreve teste de RLS

Transação com rollback, assumindo a identidade do usuário:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
-- consulta + asserção
rollback;
```

**Todo caso é escrito aos pares:** o que a pessoa deve ver *e* o que ela não pode
ver. Um teste que só verifica o caminho feliz não prova isolamento.

## Casos que precisam existir sempre

- Cliente A acessa Cliente A ✓
- Cliente A **não** acessa Cliente B (leitura, escrita e troca de ID na URL)
- Cliente A **não** aprova versão inexistente nem versão fora de `awaiting_client`
- Cliente A **não** acessa arquivo do Cliente B, nem com o ID correto
- Cliente A **não** vê arquivo `internal` nem conteúdo `in_production` do próprio cliente
- Cliente A **não** lê comentário `is_internal = true`
- Não autenticado **não** acessa nada além de `/login`
- `boop_member` sem vínculo **não** acessa o cliente
- `boop_admin` **não** aprova conteúdo
- Usuário `disabled` perde acesso no request seguinte
- Aprovação duplicada gera **um** registro
- Alterar `client_id` de uma linha existente **falha**
- Varredura: nenhuma tabela em `public` sem RLS e sem as quatro políticas
- Paridade: `pg_enum` bate com `src/config/enums.ts`

## Regras

- Policy é função pura: teste em tabela, sem banco, sem mock.
- **Nunca mocke o Supabase para testar RLS.** Testaria o mock.
- Teste de workflow usa o banco local, não dublê.
- Seed mantém **dois clientes com usuários distintos**. Sem isso a suíte de
  isolamento não existe.
- Teste que falha por ordem de execução está errado: cada caso é independente.
- Bug corrigido ganha teste que falha antes da correção.

## CI

`typecheck → lint → test:unit → supabase start → test:rls → build`.
Tudo bloqueia merge. `test:rls` não é opcional e não vira execução noturna.
