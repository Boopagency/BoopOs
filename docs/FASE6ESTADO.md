# FASE 6 — Estado de entrega

**Projetos e jornada.** Branch `claude/boop-phase-6-context-osy1o9`, partindo de
`a2f855d` (fim da FASE 5).

O container de trabalho é efêmero; este documento é o que sobrevive a ele.

---

## Fundação

A branch estava em `d3f116e` — fim da FASE 2 — quando a sessão abriu. O clone
veio single-branch, então `a2f855d` nem existia como objeto local. Depois de
`git fetch`, a comparação deu 11 commits à frente e **zero divergentes**:
fast-forward puro, executado. A FASE 6 nasceu sobre a FASE 5 inteira.

---

## O que se tornou real

A pergunta da FASE 5 era "quais clientes a Boop gerencia?". A desta é **"qual
trabalho está sendo executado, e em que ponto ele está?"**.

| Rota                                       | O que faz                                                          |
| ------------------------------------------ | ------------------------------------------------------------------ |
| `/admin/clientes/[clientId]`               | ganhou a seção **Projetos**, antes dos dados cadastrais            |
| `/admin/clientes/[clientId]/projetos/novo` | criação, só `boop_admin` (404 para os demais)                      |
| `/admin/projetos/[projectId]`              | jornada, dados e status — a tela onde a jornada se move            |
| `/portal`                                  | **resolvedor**: zero → vazio, um → redirect, vários → escolha      |
| `/portal/[projectId]`                      | guard no **layout** do grupo; projeto e jornada do banco           |
| `/bem-vindo`                               | resolve o projeto real do ator, não mais "Hartmann · Social Media" |

**Sem SQL manual, sem seed, sem Studio, sem dado hardcoded.**

---

## A identidade falsa acabou

`DEMO_PROJECT_ID` era `hartmann.PROJECT.id`, e decidia **quem via o quê**:
`/portal` redirecionava para ele, `assertProject()` comparava com ele, e
`/bem-vindo` mostrava o mesmo cliente para qualquer pessoa autenticada. Não era
mock de dado — era mock de identidade, e o portal não tinha autorização nenhuma:
`assertProject()` comparava uma string, sem consultar o banco.

**Removidos:** `DEMO_PROJECT_ID`, `hartmann.PROJECT`, `hartmann.JOURNEY`.

**Preservados de propósito:** os outros nove blocos de `src/mocks/hartmann.ts` e
as catorze funções de `portal.ts` que os servem — conteúdo, estratégia,
arquivos, reuniões, resultados, onboarding, atenção e insight são das FASES 7+.
**Todas passaram a chamar o guard real** antes de responder: quando a FASE 7
trocar `getOnboarding()` por uma consulta, a autorização já está no lugar certo.

`tests/unit/phase6-no-demo-project.test.ts` lê o código-fonte e falha se a
constante voltar, se uma tela importar `@/mocks` direto, ou se alguém introduzir
percentual na jornada.

---

## As três funções transacionais

O gatilho de revisão da ADR-0011 foi acionado, e a resposta virou a
[ADR-0023](adr/0023-fronteiras-transacionais-de-projeto-e-jornada.md). Cinco
funções SQL viraram **oito**.

| Função                        | O que quebra sem transação     |
| ----------------------------- | ------------------------------ |
| `create_project_with_journey` | projeto **sem jornada**        |
| `advance_project_stage`       | projeto **sem etapa corrente** |
| `set_project_stage_state`     | duas correntes, ou nenhuma     |

O agravante que os casos da FASE 5 não tinham: o índice parcial
`project_stages_one_current_idx` **impõe uma ordem** entre os dois UPDATEs. Se o
segundo falhar, o projeto fica sem etapa corrente — estado que nenhuma
constraint proíbe, que a tela do **cliente** exibe, e sobre o qual nada avisa.

### O caminho que não funcionou, e por quê

A primeira versão das três era `security invoker` — a RLS continuaria valendo
dentro delas, e a função só acrescentaria a transação. Era a escolha certa pelo
princípio, e falhou com `permission denied for schema app`.

O bootstrap revoga `usage on schema app` de `authenticated`. As policies chamam
`app.*` e funcionam porque **expressão de policy é avaliada com os privilégios
do dono da tabela**, não os de quem consulta — por isso a isolação do schema
`app` nunca tinha esbarrado em nada. Uma função `invoker` roda como quem chama,
e não alcança `app.is_boop_admin()`.

Das três saídas, duas foram recusadas (conceder `usage on schema app`;
reescrever os predicados de autorização em SQL solto) e a terceira é a das
quatro fronteiras que já existiam: `security definer`, com **todas** as
checagens escritas no corpo, usando as mesmas funções `app.*` que as policies
usam.

### `list_client_team` — a quarta, e é de leitura

A D-16 fechou que "Quem está no projeto" vem de dado real. Só que um
`client_user` não alcança nenhum dos dois lados: `client_memberships_select` o
restringe ao próprio vínculo, e `has_profile_access` nunca lhe concede o perfil
de terceiro. As duas restrições estão certas.

O produto pede **menos** do que elas negam: não a lista de vínculos, não os
perfis — apenas os nomes. A função devolve exatamente `full_name`, e nada mais.
Fail closed: sem acesso ao cliente, zero linhas — não distingue "conta sem
equipe" de "conta que não é sua".

**`boop_admin` sem vínculo não aparece na equipe.** Acesso global (D-08) diz
quais clientes ele alcança, não de quem ele cuida. Acesso ≠ alocação.

---

## Banco

**Duas migrations novas.**

`20260903010349_immutable_journey_binding.sql` — a ADR-0006 declarava
`journey_key` imutável e o banco não garantia. `projects_update` concede UPDATE
da linha inteira, e policy decide LINHA, nunca COLUNA — o mesmo achado que a
FASE 5 corrigiu em `created_at`/`created_by`.

`type` entrou junto, e a razão é que congelar só uma das duas deixaria a porta
aberta pelo outro lado: `type = 'website'` com `journey_key = 'social.v1'` é a
contradição que a imutabilidade existia para impedir, alcançada por outro
caminho. As duas descrevem a mesma decisão, tomada uma vez, na criação.

`20260903010440_project_journey_boundaries.sql` — as quatro funções acima.

Nenhuma tabela nova, nenhuma policy alterada, nenhum GRANT de tabela novo.

### O achado do plano B sem Docker

`scripts/db/auth-shim.sql` concedia `execute` em `auth.uid()` a `authenticated` e
**não** concedia `usage` no schema `auth` — o grant era inalcançável. Invisível
por três fases, porque toda função que chamava `auth.uid()` até a FASE 5 era
`security definer` e rodava como dona.

A primeira `invoker` quebrou só localmente enquanto passava no staging.
Conferido contra o `boop-os-staging`: lá `anon` e `authenticated` têm `usage` no
schema `auth`. O shim passou a fazer o mesmo. **Um plano B que não reproduz o
ambiente real deixa de ser plano B.**

---

## Autorização

| Ator                      | `/portal` | ver projeto | criar | editar | avançar etapa | status |
| ------------------------- | :-------: | :---------: | :---: | :----: | :-----------: | :----: |
| não autenticado           |   login   |      —      |   —   |   —    |       —       |   —    |
| `client_user`             |  próprio  |    ✓ (¹)    |   —   |   —    |       —       |   —    |
| `boop_member` sem vínculo |   vazio   |   **404**   |   —   |   —    |       —       |   —    |
| `boop_member` com vínculo |     ✓     |      ✓      | **—** |   ✓    |       ✓       |   ✓    |
| `boop_admin`              |     ✓     |  ✓ global   |   ✓   |   ✓    |       ✓       |   ✓    |

(¹) exceto `draft`, que não existe para ele — nem por URL direta.

**`boop_member` não cria projeto nem no cliente em que tem vínculo.** A linha da
matriz é vazia, e vazio é decisão. **`boop_admin` cria em qualquer cliente sem
precisar de vínculo** — D-08 é global, e há teste que falha se alguém passar a
exigir vínculo dele.

### A capacidade que faltava

`project.change_status` estava em `docs/permissions.md` desde a FASE 0 e **não
estava em `CAPABILITIES`**. Não houve brecha — `projects_update` já exigia
`is_boop()` e vínculo —, mas a linha do documento não tinha representação em
`can()`. Sobreviveu cinco fases porque o teste de paridade transcreve a matriz à
mão. Acrescentada, e o teste de paridade cobrou na hora.

`setStageState` **não** ganhou capacidade própria: usa `project.advance_stage`.
É a mesma autoridade sobre a mesma coisa.

---

## Visibilidade — a camada que a RLS não decide

A RLS responde **tenant**; ela não responde **"este projeto deve aparecer para
este ator?"**. A diferença tem nome: `draft`.

`projects_select` concede a linha de um rascunho ao próprio cliente, e está
certo — a Boop precisa dele para trabalhar. Apertar a policy resolveria pelo lado
errado: `authenticated` é um papel só para as três personas, e um predicado por
status tiraria o rascunho da Boop junto.

A regra mora em `src/domains/projects/visibility.ts` — **pura, sem
`server-only`**, porque lógica sem I/O atrás dele fica cara de testar.

| Status      | abre por URL? | resolve automático? |
| ----------- | :-----------: | :-----------------: |
| `draft`     |    **não**    |         não         |
| `active`    |      sim      |         sim         |
| `paused`    |      sim      |         sim         |
| `completed` |      sim      |   não (histórico)   |
| `archived`  |      sim      |   não (histórico)   |

O guard faz as duas perguntas de uma vez (`requireVisiblePortalProject`) e vive
no **layout** de `/portal/[projectId]` — o risco número 1 do pre-flight. Um
guard por página é um guard que a próxima página esquece.

---

## Jornada

Uma fonte da verdade por pergunta, e nenhuma nova:

| Pergunta     | Fonte                                         |
| ------------ | --------------------------------------------- |
| ordem        | `position` (único, contíguo desde 1)          |
| onde estamos | `state = 'current'` (único, índice parcial)   |
| o que acabou | `state = 'done'` + `completed_at`             |
| o que vem    | menor `position` acima da corrente, `pending` |
| resumo       | `src/config/journeys.ts`, por `stage_key`     |

**Sem percentual.** A jornada É o progresso; o admin lê "3 de 8 etapas
encerradas", que é uma frase, nunca "37%", que é um número sem significado.

Decisões que a fase fechou:

- a etapa de `position = 1` nasce `current`, com `started_at`;
- a última etapa conclui a jornada e **não inventa próxima** — zero corrente é
  estado legítimo;
- sem corrente e com pendente, `advanceStage` **recusa** (`no_current`) em vez de
  escolher; o conserto é explícito, por `setStageState`;
- `setStageState` **não cascateia**: voltar não reabre o que estava `done`;
- a etapa desfeita vira `pending`, nunca `done` — concluir é outro gesto;
- `project.status` nunca é tocado pela jornada (I-01).

**`summary` tem fallback:** chave histórica sem template devolve `null`, a linha
some, e a etapa continua com rótulo, posição e estado. A tela não quebra e não
inventa texto.

---

## Jornadas

`social.v1` tem as **oito** etapas de `docs/product.md` — `kickoff`,
`onboarding`, `immersion`, `research`, `strategy`, `production`, `publishing`,
`review`. O mock tinha seis, sem `kickoff` e sem `onboarding`: era ilustração de
tela, e a especificação é o documento. Há teste que prende isso.

`website.v1` (5), `branding.v1` (5), `automation.v1` (4) e `custom.v1` (3) são
mínimas de propósito — existem para provar que a arquitetura não depende de
social, e nenhuma delas tem `publishing`. Detalhá-las agora seria escrever ficção
que alguém teria de manter.

---

## Projeções

Nenhuma coluna de `projects` está em `INTERNAL_FIELDS`, e mesmo assim há campo
que não chega ao cliente. A proteção é a primeira camada — **a coluna não sai do
banco**:

| Fora da projeção client-facing | Por quê                              |
| ------------------------------ | ------------------------------------ |
| `journey_key`                  | jargão técnico (`social.v1`) na tela |
| `created_by`                   | bastidor de operação                 |
| `created_at` / `updated_at`    | carimbo de infraestrutura            |
| `started_at` (etapa)           | nenhuma tela desta fase usa          |

`AssertClientFacing` continua ao lado de cada projeção, exportado: ele cobra no
dia em que `projects` ganhar uma coluna interna de verdade.

---

## Testes

**631 → 788** (+157). Todos os 631 anteriores continuam verdes; um deles — a
paridade da matriz de permissões — foi quem apontou a capacidade que faltava.

| Arquivo                                       | Casos | O que prende no lugar                                 |
| --------------------------------------------- | ----: | ----------------------------------------------------- |
| `tests/rls/phase6-project-boundaries.test.ts` |    32 | cada recusa do corpo das funções, adversarialmente    |
| `tests/rls/phase6-project-isolation.test.ts`  |    28 | isolamento aos pares, imutabilidade, invariantes      |
| `tests/rls/phase6-portal-surface.test.ts`     |     9 | projeções por papel, com as constantes de produção    |
| `tests/unit/phase6-journeys.test.ts`          |    30 | contrato dos templates + derivação pura da jornada    |
| `tests/unit/phase6-portal-resolution.test.ts` |    20 | zero/um/vários, draft, completed, determinismo        |
| `tests/unit/phase6-no-demo-project.test.ts`   |    12 | a identidade falsa não volta                          |
| `tests/component/project-form.test.tsx`       |    13 | estados, a11y, tipo imutável, `journey_key` invisível |
| `tests/unit/projection.test.ts`               |   +12 | as projeções de projeto e etapa                       |
| `tests/unit/permissions.matrix.test.ts`       |    +1 | `project.change_status`                               |

Dois merecem nota:

- **`phase6-project-boundaries`** existe porque `security definer` esconde a
  autorização do catálogo do Postgres: não há policy para uma varredura conferir,
  então um `if` que sumisse num refactor não quebraria nada. Cada recusa tem caso.
- **A prova de rollback** cria um projeto cuja segunda escrita falha (`label`
  nulo) e confere que **nenhum projeto sobrou**. É a razão de a função existir,
  testada diretamente. Há também uma varredura: nenhum projeto com zero etapas
  em lugar nenhum.

---

## Staging

`boop-os-staging` · `sa-east-1` · ref `njlkuzrppnwkgrdacmos`.

- Migrations aplicadas. **Fingerprint idêntico nas nove partes** — colunas,
  constraints, índices, triggers, enums, funções, RLS, policies e grants.
- **Ledger reconciliado.** O conector carimbou versões próprias
  (`20260903010349`, `20260903010440`) em vez das do repositório. Os arquivos
  foram **renomeados** para casar com o ledger — nunca reaplicados só para
  alinhar nome. É a lição da FASE 5, aplicada no mesmo minuto da aplicação.
- **Divergência de `funcoes` encontrada e fechada.** A primeira aplicação foi de
  uma versão sem comentários, e o fingerprint hasheia `prosrc`: oito partes
  batiam e `funcoes` não. As quatro funções foram reaplicadas com o corpo exato
  do repositório (via `create or replace`, sem nova entrada no ledger), e os
  grants foram conferidos depois — `authenticated` sim, `anon` não.
- Advisors de segurança: **zero achados de RLS**. Os oito WARN de
  `authenticated_security_definer_function_executable` são o desenho (eram
  quatro; as quatro novas entraram). `auth_leaked_password_protection` é
  pré-existente e não se aplica: não há senha no produto (Magic Link, ADR-0009).
- Advisors de performance: só INFO, e só as duas classes já classificadas na
  FASE 4 — `created_by` sem índice (não está em predicado de policy) e
  `unused_index` num staging ocioso. **Nenhuma classe nova.**
- **Dados preservados.** 2 clientes, 6 pessoas, 5 vínculos, 0 projetos. Nada foi
  apagado, nada foi semeado. O primeiro projeto real nasce pela UI.

### QA hospedado — CONCLUÍDO, sem problemas

O QA humano no ambiente hospedado foi executado e **passou em todos os passos**.
O que foi de fato exercitado, e nada além disso:

| #   | Passo                                    | Resultado |
| --- | ---------------------------------------- | --------- |
| 1   | Projeto criado no cliente Velmont        | PASS      |
| 2   | Jornada com **8 etapas**                 | PASS      |
| 3   | Primeira etapa nasce `current`           | PASS      |
| 4   | Ativação do projeto (`draft → active`)   | PASS      |
| 5   | Portal do `client_user` com projeto real | PASS      |
| 6   | Avançar etapa, e o cliente ver a mudança | PASS      |
| 7   | Cross-tenant: URL da Revenda Mais negada | PASS      |
| 8   | Múltiplos projetos e seletor             | PASS      |
| 9   | `draft` invisível para o `client_user`   | PASS      |

**Problemas encontrados: nenhum.**

Isso fecha o que faltava. O caminho HTTP do PostgREST — `rpc` com `p_stages`
como `jsonb`, serialização, e a UI ponta a ponta — estava descoberto pela suíte
automatizada e passou a estar coberto por este QA. É o critério de pronto da
fase, cumprido: _a Boop cria um projeto social, avança a etapa e o cliente vê a
mudança._

**O que este QA NÃO cobriu**, e continua registrado como tal: o caso
`boop_member` sem vínculo no ambiente hospedado — o staging não tem um
`boop_member`. A célula está provada contra Postgres real (`MEM_0` na suíte de
isolamento e nas fronteiras), não pelo caminho HTTP.

### Limitação desta SESSÃO (não do produto)

Nada de PostgREST foi exercitado **a partir do container de trabalho**: não há
daemon Docker (o banco local cai no plano B — Postgres nu, sem PostgREST) e a
política de rede recusa CONNECT para `njlkuzrppnwkgrdacmos.supabase.co`. A
validação hospedada acima foi feita por uma pessoa, e é ela que cobre a camada
que a sessão não alcança.

---

## Débito assumido

| #   | Débito                                                                                                     | Onde              |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | **Projeto arquivado não tem volta pelo painel.** `changeProjectStatus` recusa sair de `archived`           | D-20 (abaixo)     |
| 2   | **`type` imutável** cobra o preço de D-15: tipo errado se resolve criando o certo e arquivando o outro     | ADR-0023          |
| 3   | **Sem paginação** na lista de projetos de um cliente                                                       | quando crescer    |
| 4   | **`setStageState` não cascateia.** Voltar não reabre etapas posteriores; quem corrige decide uma a uma     | ADR-0023, gatilho |
| 5   | **PostgREST não exercitado nesta sessão.** Ver acima                                                       | QA manual         |
| 6   | **`getCurrentStage` no dashboard carrega a jornada inteira** para achar uma etapa. Correto e não otimizado | quando pesar      |

---

## Decisões que dependem de uma pessoa

- ~~**D-16, D-17, D-18, D-19**~~ — **fechadas nesta fase.** Registradas em
  `docs/spec-review.md`.
- **D-20 (nova)** — desarquivar projeto é operação de produto ou de
  infraestrutura? O default assumido é **infraestrutura**, como D-13 para
  pessoas. A recusa é explícita e tem mensagem própria, não silenciosa.

---

## Ações manuais obrigatórias

Nenhuma nova. As quatro da FASE 5 (SMTP, template de convite, redirect URL,
`SUPABASE_SERVICE_ROLE_KEY`) continuam valendo e não precisam ser refeitas. A
FASE 6 não toca em e-mail, Auth ou variável de ambiente.

---

## QA hospedado — executado

O checklist foi percorrido por uma pessoa e passou inteiro. O registro está em
"QA hospedado — CONCLUÍDO, sem problemas", acima. Resta um único passo não
exercitado por HTTP, e por falta de ator: `boop_member` sem vínculo, que o
staging não tem. A célula está provada contra Postgres real.

---

## Próxima fase

**FASE 7 — Onboarding.** Renderização a partir do schema, autosave com `upsert`,
`submitOnboarding` (a nona função SQL, já prevista na ADR-0011), leitura das
respostas no admin.

Ela encaixa direto no que esta fase deixou pronto: `onboarding` já é a etapa 2 de
`social.v1`, e `submit_onboarding` avança a jornada — o mecanismo de avanço já
existe, testado e atômico.
