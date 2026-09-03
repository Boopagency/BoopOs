# ADR-0023 — Fronteiras transacionais de projeto e jornada

**Status:** aceito · **Data:** 2026-09-03 · **Fase:** 6
**Revisa:** [ADR-0011](0011-workflows-transacionais-em-sql.md) (que segue aceita)
**Aplica:** [ADR-0006](0006-jornadas-como-template-em-codigo.md)

## Contexto

A ADR-0011 fixou **cinco** funções SQL na V0 e escreveu o gatilho de revisão:
releia antes de criar a sexta. A FASE 6 chegou nesse ponto, e não por
conveniência — por três operações que cabem no critério da própria ADR
("toca mais de uma linha e não pode ficar pela metade"):

| Operação        | O que toca                                        | O que sobra se falhar no meio  |
| --------------- | ------------------------------------------------- | ------------------------------ |
| `createProject` | `projects` + N linhas de `project_stages`         | **projeto sem jornada**        |
| `advanceStage`  | a etapa corrente + a próxima                      | **projeto sem etapa corrente** |
| `setStageState` | a etapa alvo + a corrente anterior (caso current) | **duas correntes, ou nenhuma** |

`supabase-js` não abre transação: cada chamada é uma transação própria. E há um
agravante que não existia nos casos da FASE 5 — o índice parcial único
`project_stages_one_current_idx` **impõe uma ordem**: a etapa corrente precisa
sair de `current` antes de a próxima entrar. Se o segundo UPDATE falhar, o
projeto fica com zero etapa corrente: um estado que nenhuma constraint proíbe,
que a tela do cliente exibe como "nenhuma etapa em andamento", e sobre o qual
nada avisa ninguém.

Os três modos de falha são silenciosos e visíveis para o **cliente**, que é a
pior combinação possível.

## Decisão

Três funções novas em `public`, `security definer`, chamadas por `rpc`:

- `create_project_with_journey(client_id, name, type, journey_key, stages, starts_on)`
- `advance_project_stage(project_id)`
- `set_project_stage_state(project_id, stage_id, state)`

A ADR-0011 passa a valer com **oito** funções, não cinco. O critério dela não
mudou; o que mudou foi o número de operações que o atendem.

Uma quarta função entra na mesma migration por outro motivo, e é de leitura:
`list_client_team(client_id)`, que devolve **apenas `full_name`** das pessoas da
Boop com vínculo explícito no cliente. Ela existe porque a alternativa era
afrouxar duas policies — ver "Consequências".

### O que NÃO virou função SQL

`updateProject` e `changeProjectStatus` escrevem **uma linha** e seguem o
caminho normal: UPDATE pelo JWT + `logActivity()`. Criar função para elas seria
o overengineering que a ADR-0011 recusa.

### O template continua em código

A função recebe as etapas já resolvidas (`[{key, label}]`), vindas de
`src/config/journeys.ts`. O banco não conhece os templates, e isso é a ADR-0006
sendo respeitada: se o catálogo morasse no banco, mudar uma jornada seria
migration — exatamente o que aquela ADR recusou. O banco garante o que só ele
pode garantir: atomicidade, `position` contígua e uma corrente por projeto.

## Alternativas consideradas

| Alternativa                                                     | Por que não                                                                                                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duas queries em TypeScript, na ordem certa                      | Deixa o modo de falha aberto. "Ordem certa" resolve o índice parcial, não a falha do segundo passo — e o estado resultante é invisível até o cliente reclamar |
| Recuperação implícita ("a corrente é a primeira não concluída") | Cria uma **segunda fonte da verdade** para "onde estamos": uma no `state`, outra numa heurística. As duas discordam no primeiro caso estranho                 |
| `security invoker` nas três                                     | Era a escolha certa pelo princípio e **não funciona**: ver abaixo                                                                                             |
| Coluna `current_stage_id` em `projects`                         | Estado duplicado. O índice parcial já garante a invariante, e um ponteiro exigiria mantê-lo em sincronia — mais uma coisa que pode divergir                   |

### Por que não `security invoker`

A primeira versão das três era `invoker`: a RLS continuaria valendo dentro
delas, e a função só acrescentaria a transação. Foi escrita, e falhou com
`permission denied for schema app`.

O bootstrap faz `revoke all on schema app from anon, authenticated`. As funções
de autorização (`app.is_boop_admin()`, `app.has_client_access()`,
`app.has_project_access()`) vivem lá justamente para não serem expostas pelo
PostgREST. Uma função `invoker` roda com os privilégios de quem chama, e quem
chama é `authenticated` — que não alcança o schema `app`.

As policies chamam as mesmas funções e funcionam porque **expressão de policy é
avaliada com os privilégios do dono da tabela**, não os de quem consulta. É por
isso que a isolação do schema `app` nunca tinha esbarrado em nada até aqui.

Restavam três saídas, e duas são piores:

1. conceder `usage on schema app` a `authenticated` — desfaz uma decisão de
   segurança da FASE 2 para conveniência de três funções. **Recusada.**
2. reescrever os predicados de autorização em SQL solto dentro das funções —
   cria uma segunda verdade sobre escopo, competindo com a RLS. É o que a
   ADR-0022 proíbe. **Recusada.**
3. `security definer`, como as quatro fronteiras que já existem. **Escolhida.**

## Consequências

- **Dentro destas funções a RLS não é aplicada.** Toda checagem que a policy
  faria está escrita no corpo, usando as MESMAS funções `app.*` que as policies
  usam — não uma reimplementação. O cabeçalho da migration traz a tabela de
  correspondência policy ↔ checagem.
- **O activity log entra na mesma transação.** As três chamam
  `record_activity()`, então a mudança de domínio e o rastro dela ou acontecem
  juntos, ou não acontecem. Consequência direta: os workflows destas operações
  **não** chamam `ctx.activity()` — chamar produziria duas linhas para um evento.
- **A superfície de RPC cresceu de quatro para oito funções `security definer`
  chamáveis por `authenticated`.** O advisor do Supabase reporta cada uma como
  WARN, e as oito são o desenho. Cada recusa escrita no corpo tem teste
  adversarial em `tests/rls/phase6-project-boundaries.test.ts`, porque a
  proteção não aparece no catálogo do Postgres: um `if` que sumisse num refactor
  não quebraria nenhuma varredura.
- **`list_client_team` é a única leitura privilegiada do sistema.** Ela existe
  porque `client_memberships_select` restringe o `client_user` ao próprio
  vínculo e `has_profile_access` nunca lhe concede o perfil de terceiro — as
  duas restrições estão certas e não mudam. O produto pede menos do que elas
  negam: não a lista de vínculos, não os perfis, apenas os nomes de quem atende
  a conta. A função devolve exatamente `full_name`, e nada mais.
- **`advanceStage` recusa avançar sem etapa corrente** (`no_current`), em vez de
  escolher uma. O conserto é explícito, por `setStageState`.
- **Zero etapa corrente com a jornada terminada é estado legítimo.** A última
  etapa fecha e a função para; não inventa uma nona nem reabre a primeira.
- `project.status` não é tocado por nenhuma das três: status e etapa são eixos
  independentes ([I-01](../spec-review.md)).

## Gatilho de revisão

A nona função. E, antes dela, qualquer operação de jornada que precise
cascatear — reabrir etapas posteriores ao voltar atrás, por exemplo. Hoje
`setStageState` não cascateia de propósito: quem corrige decide etapa por etapa,
e o histórico não é reescrito por dedução.
