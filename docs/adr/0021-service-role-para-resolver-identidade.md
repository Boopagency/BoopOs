# ADR-0021 — `service_role` para resolver identidade até a FASE 4

**Status:** aceito, **temporário** · **Data:** 2026-09-02 · **Fase:** 3
**Revisão obrigatória:** FASE 4

## Contexto

A FASE 2 entregou o banco com **RLS ligada e sem políticas**, que em Postgres
significa negar tudo. A migration `20260901140008` foi além e revogou os
privilégios: `revoke all on public.<tabela> from anon, authenticated`. O schema
`app` também é inacessível a esses papéis (`20260901140001`).

A consequência aparece na primeira linha da FASE 3: **`getActor()` não consegue
ler `profiles` com o JWT do usuário.** Nem por `rpc`. A leitura que responde
"quem é esta pessoa" volta vazia para todo mundo — inclusive para a própria
pessoa lendo a própria linha.

Autenticação e autorização são fases separadas de propósito (FASE 3 responde
"quem é"; FASE 4 responde "o que pode ver"). Mas a FASE 3 não tem como existir
sem ler o perfil.

## Decisão

`getActor()` e `recordFirstLogin()` leem e escrevem `profiles` pela
`service_role`, e `logActivity()` escreve em `activity_log` pelo mesmo caminho.
Exclusivamente server-side, exclusivamente para resolver identidade.

Cinco regras, e elas estão no código, não só aqui:

1. **A identidade vem sempre de `supabase.auth.getUser()`** — o token é
   validado contra o servidor de Auth, não decodificado do cookie.
2. **O filtro é sempre o `id` dessa sessão.** Nenhum `userId`, `profileId`,
   `role`, `clientId` ou `actorId` vindo do navegador tem autoridade sobre
   nada.
3. **Projeção mínima:** `id, email, full_name, role, status`. Sem `select *`.
4. **Nada de dado de produto.** Cliente, projeto, conteúdo, estratégia e
   arquivo não passam por aqui — nem agora, nem como conveniência.
5. **Isto não é autorização.** É leitura de identidade. Autorização é a FASE 4.

O Actor desta fase carrega identidade, e **não** carrega `clientIds` — o
desenho do `docs/security.md` só se completa quando o vínculo puder vir das
funções `app.*` sob RLS, e não de uma consulta que ignora RLS.

## Alternativas consideradas

| Alternativa                                              | Por que não                                                                                                                        |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Antecipar as políticas de `profiles` para a FASE 3       | Escrever policy fora da fase que tem a suíte de isolamento é como a FASE 4 vira "algumas tabelas já estão prontas, acho"           |
| `USING (true)` temporário em `profiles`                  | Abre a tabela inteira de pessoas para qualquer usuário autenticado. "Temporário" é a palavra que sobrevive a todos os prazos       |
| `grant select` a `authenticated` sem policy              | Não resolve: com RLS ligada e sem política, o grant não devolve linha nenhuma                                                      |
| Ler papel dos claims do JWT (`custom_access_token_hook`) | Revogação passaria a demorar até uma hora, que é o R-11 — o motivo pelo qual as funções `app.*` consultam o banco a cada avaliação |

## Consequências

- Nesta janela a **segunda camada de autorização não contribui**: a leitura de
  identidade passa por cima da RLS por definição. É a razão de a FASE 3 não
  ligar nenhuma tela a dado real — o portal continua lendo mocks.
- O raio de alcance é pequeno e auditável: três funções, uma tabela de
  identidade e o log. `grep createSupabaseAdminClient src/` mostra tudo.
- `import 'server-only'` em `admin.ts` faz o build falhar se alguém importar
  isso de um Client Component; o bundle do cliente foi conferido e não contém
  a service role nem o cliente administrativo.
- A dívida é datada. A FASE 4 tem que reabrir os três pontos e trocar cada um
  pelo caminho com RLS assim que a política de `profiles` existir.

## Gatilho de revisão

**A FASE 4, obrigatoriamente.** Assim que `profiles` tiver as quatro políticas
e as funções `app.*`, `getActor()` volta a ler pelo JWT do usuário e esta ADR
é substituída — não editada.
