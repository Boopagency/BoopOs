# ADR-0022 — Autorização no banco, e o fim da `service_role` para identidade

**Status:** aceito · **Data:** 2026-09-02 · **Fase:** 4
**Substitui:** [ADR-0021](0021-service-role-para-resolver-identidade.md)

## Contexto

A [ADR-0021](0021-service-role-para-resolver-identidade.md) foi aceita como
**temporária**, com revisão obrigatória nesta fase. Ela documentava três
leituras e escritas passando por `service_role` — `getActor()`,
`recordFirstLogin()` e `logActivity()` — porque a FASE 2 entregou o banco com
RLS ligada e **sem políticas**, e `authenticated` sem privilégio nenhum em
`public`. Sem esse desvio, a FASE 3 não teria como responder "quem é esta
pessoa".

O prazo venceu. A FASE 4 escreveu as políticas, e a pergunta agora é outra:
cada um dos três pontos ainda precisa de privilégio elevado, ou existe caminho
com RLS?

## Decisão

**A `service_role` sai dos três.** `grep -rn createSupabaseAdminClient src/`
devolve apenas `src/lib/supabase/admin.ts` — o arquivo que a define, e mais
nenhum chamador.

Os três casos não tinham a mesma resposta, e vale registrar por quê.

### 1. `getActor()` — passou a ler pelo JWT, sob RLS

A leitura de `profiles` acontece pelo mesmo cliente que valida a sessão. A
policy `profiles_select` concede a própria linha, e o `.eq('id', …)` da
aplicação continua — as duas camadas dizem a mesma coisa, que é o que se espera
delas.

Uma sutileza que ficou no código e aqui: o braço "o próprio perfil" de
`app.has_profile_access()` **não** exige `status = 'active'`. Se exigisse,
`getActor()` devolveria `null` tanto para quem foi desligado quanto para quem
ainda não ativou o acesso, e as duas situações virariam o mesmo redirect
genérico. A leitura concede exatamente uma linha — a própria —, e nenhuma outra
policy deriva acesso dela: `app.has_client_access()` continua `false` para quem
não está ativo.

### 2. `recordFirstLogin()` — virou fronteira privilegiada, menor

A promoção `invited → active` escreve `profiles.status`, e `role` mora na mesma
linha. Conceder UPDATE de `profiles` a `authenticated` para permitir essa
transição seria conceder, junto,
`update profiles set role = 'boop_admin' where id = auth.uid()`.

Então `profiles` **não tem policy nem GRANT de UPDATE para ninguém**, e a
transição sai por `public.promote_invited_profile()`: `security definer`, sem
parâmetro, operando só sobre `auth.uid()`, fazendo uma transição só. A função
TypeScript também perdeu o parâmetro — não há `userId` para passar adiante, nem
para errar.

Ganho colateral: a promoção e o `user.joined` passaram a acontecer na mesma
transação. Antes eram duas chamadas, com uma janela em que a promoção valia e o
evento se perdia.

### 3. `logActivity()` — virou fronteira privilegiada, menor

Conceder INSERT em `activity_log` permitiria gravar linha com `actor_id` de
outra pessoa, ou um evento que nunca aconteceu. Um log de auditoria que aceita
ser forjado é pior do que não ter log.

`public.record_activity()` é `security definer` e resolve `actor_id` a partir de
`auth.uid()`, **sempre**. Por isso `actorId` sumiu da assinatura em TypeScript.
`clientId` e `projectId` continuam parâmetros e por isso são conferidos contra o
vínculo de quem chama.

## O que isto NÃO significa

`service_role` continua existindo, continua confinada a
`src/lib/supabase/admin.ts` com `import 'server-only'`, e volta a ter chamador
quando houver uso legítimo: criar usuário no convite (FASE 5), assinar URL de
Storage (FASE 12), seed e manutenção. O que acabou foi o uso dela **como
atalho de autorização**.

## Alternativas consideradas

| Alternativa                                             | Por que não                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Manter `service_role` no `getActor()`                   | O motivo que a justificava — não existir policy — deixou de existir. Bypass que sobrevive ao seu motivo vira bypass permanente                   |
| Policy de UPDATE em `profiles` com `using (id = uid())` | `role` e `status` moram na linha: é escalada de privilégio em uma linha de SQL                                                                   |
| GRANT de INSERT em `activity_log`                       | Permitiria `actor_id` forjado e evento inventado                                                                                                 |
| Colocar papel e vínculo no JWT                          | Revogação passaria a valer só na expiração do token (~1 h). É o R-11, e o motivo de [ADR-0004](0004-rls-com-funcoes-security-definer.md) existir |
| `clientIds` no Actor, resolvidos por request            | Cópia do escopo com prazo de validade, competindo com a RLS como segunda fonte da verdade. Ver abaixo                                            |

## O Actor continua carregando identidade, e não escopo

A [ADR-0021](0021-service-role-para-resolver-identidade.md) deixava em aberto se
o `clientIds` desenhado em `docs/security.md` entraria quando as políticas
existissem. **Não entra**, e agora por decisão, não por pendência.

Escopo é estado do banco no instante do request. Uma lista montada no início do
request seria uma foto: revogar um vínculo no meio dele não teria efeito, e a
aplicação passaria a ter uma segunda verdade sobre acesso, competindo com a RLS
— exatamente o que as duas camadas existem para evitar.

Quem responde escopo são `requireClientAccess()` e `requireProjectAccess()`, que
perguntam **tentando ler o recurso pelo JWT**: se a RLS devolve a linha, o
acesso existe. A mesma policy que protege a tabela responde ao guard, então as
duas nunca discordam. `docs/permissions.md` foi corrigida onde tratava
`actor.clientIds` como fonte.

## Consequências

- As duas camadas de autorização passam a valer de verdade. Na janela da FASE 3
  a segunda não contribuía; agora toda leitura de domínio da aplicação passa
  pela RLS.
- A superfície privilegiada é menor e nomeada: duas funções, ambas
  `security definer`, ambas sem parâmetro de identidade, ambas com teste
  adversarial provando que não se deixam apontar para outra pessoa.
- O linter do Supabase aponta as duas como
  `authenticated_security_definer_function_executable`. É esperado: elas
  existem para ser chamadas por `rpc`. O achado está classificado em
  `docs/security.md`.
- `logActivity()` perdeu a capacidade de registrar evento sem sessão. Nenhum
  chamador precisa disso hoje; quando a FASE 16 precisar (falha de e-mail
  assíncrona), o caminho será uma fronteira própria, e não um GRANT amplo.

## Gatilho de revisão

Um caso legítimo de escrita de auditoria sem sessão, ou uma operação de
administração de pessoas (FASE 5) que exija escrever `profiles` fora da
promoção. Nos dois casos: fronteira nova, nomeada e testada — nunca um GRANT
que sirva para mais do que o caso pediu.
