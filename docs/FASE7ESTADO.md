# FASE 7 — Estado ao fim

**Onboarding.** O formulário vem do banco, o cliente responde sem perder nada, e
o envio é uma transação que fecha a etapa e abre a próxima.

Base: `4c88baf` (fim da FASE 6, validada em ambiente hospedado).

---

## O que a fase respondeu

A FASE 6 respondeu _"qual trabalho estamos executando para este cliente, e onde
estamos?"_. Esta responde _"o que precisamos aprender com o cliente para
executar esse trabalho?"_ — e a resposta agora existe no banco, não num mock.

```
PROJETO social, etapa `onboarding` corrente
   ↓  a Boop abre                          start_onboarding()
SUBMISSÃO em `draft`
   ↓  o cliente responde                   upsert por pergunta, sem activity
RESPOSTAS que sobrevivem a fechar o navegador
   ↓  o cliente envia                      submit_onboarding()  ← transação
SUBMISSÃO `submitted` + etapa fechada + `immersion` corrente + UMA linha de log
   ↓  a Boop lê no admin
   ↓  a Boop reabre, se precisar           reopen_onboarding()  ← a jornada NÃO volta
```

## Escopo: social, e só social

`social.v1` é a única jornada com etapa `onboarding`, e o único `project_type`
com template ativo. `website`, `branding`, `automation` e `custom` **não
receberam onboarding mínimo fictício** — eles respondem `unsupported`, que é
uma frase honesta e diferente de "ainda não foi aberto".

Os dois estados não se confundem em lugar nenhum: são valores distintos no
`state` da projeção, telas distintas no portal e blocos distintos no admin.

## Decisões da fase

| #            | Decisão                                                   | Onde                                                                                  |
| ------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **D-20**     | e-mail `onboarding_completed` adiado para a FASE 16       | [spec-review](spec-review.md#d-20--o-e-mail-onboarding_completed-fica-para-a-fase-16) |
| **D-21**     | o envio avança a jornada **condicionalmente**             | [spec-review](spec-review.md#d-21--o-envio-avança-a-jornada-condicionalmente)         |
| **D-22**     | `reopenOnboarding` entra na fase, com capacidade própria  | [spec-review](spec-review.md#d-22--reopenonboarding-entra-na-fase-7)                  |
| **D-23**     | o catálogo social sai do seed e vira migration            | [spec-review](spec-review.md#d-23--o-catálogo-social-sai-do-seed-e-vira-migration)    |
| **D-24**     | a submissão nasce por ação explícita da Boop              | [spec-review](spec-review.md#d-24--a-submissão-nasce-por-ação-explícita-da-boop)      |
| **ADR-0024** | ciclo de vida por RPC; fim da escrita direta na submissão | [ADR-0024](adr/0024-ciclo-de-vida-por-rpc-e-fim-da-escrita-direta-na-submissao.md)    |

## Os dois buracos que a fase encontrou e fechou

Nenhum dos dois estava no roadmap. Os dois eram reais, e os dois só apareceram
ao escrever o caminho de escrita de verdade.

### 1. O ciclo de vida tinha uma porta dos fundos

`onboarding_submissions` tinha GRANT de INSERT e UPDATE para `authenticated`, e
a policy de UPDATE foi **desenhada** para permitir `draft → submitted` — o
`WITH CHECK` não repete a trava de `draft` de propósito, senão o envio seria
impossível.

Consequência: um `client_user` podia mover a própria submissão para `submitted`
pelo PostgREST, **sem** avançar a jornada e **sem** gravar activity. Submissão
enviada, jornada parada, auditoria em branco — e nenhuma constraint proíbe esse
estado.

**Fechado:** os dois GRANTs foram revogados e as duas policies removidas. A
tabela ficou com `select`. Abrir, enviar e reabrir são três RPCs, e nada mais —
nem para a Boop, porque duas portas para o mesmo estado é como uma delas fica
sem uma checagem.

Provado em `tests/rls/phase7-onboarding-boundaries.test.ts`, como
`authenticated` — o papel do caminho real —, coluna por coluna: `status`,
`submitted_at`, `submitted_by`, `template_id`, `project_id`, `client_id`.

### 2. A resposta podia citar a pergunta de outro formulário

A autorização de `onboarding_answers` deriva da SUBMISSÃO ("é sua, e ainda está
em rascunho?"). É a pergunta certa sobre tenant, e não diz **nada** sobre a
pergunta: com a própria submissão em mãos, dava para gravar uma resposta
apontando para um `question_id` de outro template. A linha ficava autorizada e
semanticamente corrompida.

**Fechado:** trigger `onboarding_answers_enforce_integrity`, que compara
`submission → template` com `question → section → template` e recusa a
divergência. Trigger e não policy porque é invariante de dado — vale para
`service_role` também, e há teste que prova isso.

O mesmo trigger valida a FORMA do valor contra o tipo da pergunta: texto onde se
espera texto, e `single_select` só com opção que existe no template. `jsonb`
nunca quis dizer "qualquer json serve".

## O banco

Três migrations, zero tabelas novas, zero colunas novas. O schema da FASE 2
tinha antecipado a fase inteira.

| Migration                                            | O que traz                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `20260903125056_onboarding_social_catalog.sql`       | template, 6 seções, 12 perguntas — idempotente, ids do seed |
| `20260903125132_onboarding_answer_integrity.sql`     | `answer_value_is_valid`, `answer_is_present`, o trigger     |
| `20260903125242_onboarding_lifecycle_boundaries.sql` | as três RPCs; `drop policy` + `revoke` na submissão         |

### `submit_onboarding()` — a nona função SQL

```
BEGIN
  sessão + has_project_access                    ← escopo antes de qualquer resposta
  SELECT submissão FOR UPDATE                    ← é o lock que impede o duplo clique
  já `submitted`?          → already_submitted   ← sucesso, não erro
  obrigatória vazia?       → required_missing    ← por TIPO, não por truthiness
  submissão → submitted, submitted_at, submitted_by = auth.uid()
  SELECT etapa corrente FOR UPDATE
    corrente = `onboarding` → done + próxima current → advanced
    outra                   → jornada intocada        → submitted_no_advance
  record_activity('onboarding.completed', …)     ← UMA linha, sempre
COMMIT
```

A ordem dos dois UPDATEs de etapa é obrigatória: `project_stages_one_current_idx`
não aceita duas correntes nem por um instante dentro da transação — a mesma
restrição que a FASE 6 documentou.

### O que continua fora da RPC

`onboarding_answers` não mudou: `SIU`, RLS como fronteira principal. É o
autosave, escreve uma linha, é idempotente por `unique (submission_id,
question_id)`, e acontece dezenas de vezes por sessão. Passá-lo por RPC seria
pagar o preço da fronteira sem comprar nada.

## O autosave, e o bug que ele quase teve

Três gatilhos: **debounce** (700 ms) enquanto digita, **blur** ao sair do campo,
e **flush** obrigatório antes de trocar de seção ou enviar. Sem `beforeunload`,
que é o gatilho menos confiável de todos.

Um bug real apareceu no teste de componente, e vale registrar porque não é
óbvio: clicar em "Enviar" **tira o foco do campo**, então o flush do blur dispara
antes do flush do envio. O segundo encontrava a fila já esvaziada pelo primeiro —
que ainda estava no ar — e concluía "não há nada pendente, pode enviar", com o
estado de erro ainda não aplicado pelo React. A submissão sairia com uma resposta
que nunca gravou.

**Corrigido no mecanismo, não no teste:** os flushes são encadeados por um
`ref` (o segundo espera o primeiro), e "a última gravação falhou?" é um `ref`
também — não um `useState` que talvez ainda não tenha sido aplicado.

Falha de gravação nunca vira sucesso: a resposta volta para a fila, o rótulo diz
"Erro ao salvar", e o envio **não acontece**.

## A semântica de "vazio", e por que ela existe duas vezes

`false` é resposta legítima de um `boolean`. `0` é resposta legítima de um
`number`. Os dois são falsy em JavaScript — e um `if (!value)` barraria alguém
que respondeu.

A regra mora em dois lugares, de propósito:

- `app.answer_is_present()` / `app.answer_value_is_valid()` — a **autoridade**,
  vale para todo papel e para um POST direto no PostgREST;
- `src/domains/onboarding/answers.ts` — a **UX**, que deixa o formulário marcar
  a obrigatória faltante sem uma viagem ao servidor.

Duas implementações da mesma regra divergem. O que impede isso de virar bug é
`tests/rls/phase7-answer-integrity.test.ts`: 22 casos em
`tests/support/answer-cases.ts`, rodados contra o Postgres **e** contra o
TypeScript, comparados um a um. Divergir é teste vermelho.

## Telas

**Portal** — `/portal/[projectId]/onboarding`, protegida pelo layout do grupo
(nenhuma autorização nova). Quatro estados, e nenhum deles é 404:

| Estado        | O que o cliente vê                                       |
| ------------- | -------------------------------------------------------- |
| `unsupported` | "Este projeto não tem formulário de onboarding."         |
| `not_started` | "Seu onboarding ainda não foi aberto."                   |
| `draft`       | o formulário, uma seção por vez, retomando de onde parou |
| `submitted`   | "Recebemos tudo." — **do banco**, não de um `useState`   |

Recarregar depois de enviar continua mostrando a confirmação: era exatamente o
que o protótipo não fazia.

A retomada é derivada das respostas, sem coluna nova: primeira seção com
obrigatória faltando → primeira seção intocada → última.

**Admin** — seção Onboarding dentro de `/admin/projetos/[projectId]`, ao lado da
jornada. Não é rota nova e não é dashboard novo. Abre o formulário quando a
etapa permite, explica o que falta quando não permite, lê as respostas em
Seção → Pergunta → Resposta (sem uuid, sem json cru), e reabre.

**Sete itens de navegação, ainda.** Onboarding não entrou no `PORTAL_NAV`.

## O que morreu

- `src/mocks/hartmann.ts` → `ONBOARDING` (6 seções, 12 perguntas fictícias)
- `src/components/patterns/onboarding-flow.tsx` (o protótipo inteiro)
- `getOnboarding()` em `src/lib/data/portal.ts`
- `OnboardingQuestion` / `OnboardingSection` em `src/lib/data/types.ts`
- o aviso _"Protótipo: as respostas não são salvas"_
- o `useState(done)` que fingia ter enviado

`tests/unit/phase7-no-onboarding-mock.test.ts` lê o código-fonte e quebra se
qualquer um deles voltar — inclusive por um revert distraído.

Mocks de fases futuras (`ATTENTION`, `STRATEGY`, `CONTENT`, `RESULTS`, `FILES`,
`MEETINGS`, `INSIGHTS`) **não** foram tocados.

## Testes

| Suíte               | Antes | Depois  |
| ------------------- | ----- | ------- |
| unit + component    | 395   | **488** |
| rls (Postgres real) | 393   | **446** |
| **total**           | 788   | **934** |

Arquivos novos:

- `tests/rls/phase7-onboarding-boundaries.test.ts` — 43 casos: o bypass fechado
  coluna por coluna, as três RPCs adversarialmente, duplo submit, reabertura,
  reenvio, isolamento.
- `tests/rls/phase7-answer-integrity.test.ts` — o spoof de pergunta (como
  cliente **e** como `service_role`), a forma do valor, e a paridade SQL ↔ TS.
- `tests/unit/phase7-answers.test.ts` — 54 casos da semântica pura.
- `tests/component/onboarding-form.test.tsx` — 24 casos: retomada, autosave,
  obrigatórias, `false`/`0`, acessibilidade, alvo de toque.
- `tests/unit/phase7-no-onboarding-mock.test.ts` — 14 guardas de código-fonte.
- `tests/support/answer-cases.ts` — a tabela compartilhada pelas duas suítes.

Varreduras atualizadas: `policy-matrix` (`onboarding_submissions` de `SIU` para
`S`), `schema` (o trigger novo na lista de `security definer`),
`permissions.matrix` (`onboarding.reopen`), `phase5-messages` (o quarto
`mutations.ts`).

## Staging

`boop-os-staging` · `sa-east-1` · ref `njlkuzrppnwkgrdacmos`.

- **Migrations aplicadas.** O conector carimbou versões próprias
  (`20260903125056`, `20260903125132`, `20260903125242`); os arquivos foram
  **renomeados** para casar com o ledger, nunca reaplicados. Lição da FASE 5,
  aplicada no mesmo minuto — de novo.
- **Fingerprint idêntico nas nove partes**, `funcoes` incluído (ele hasheia
  `prosrc`, então os corpos batem comentário por comentário). Sem a divergência
  que a FASE 6 teve.
- **Advisors de segurança: zero achados de RLS.** Os WARN de
  `authenticated_security_definer_function_executable` foram de 8 para 11 — as
  três RPCs novas. É o desenho, e a classe já estava classificada.
  `auth_leaked_password_protection` continua não se aplicando (Magic Link).
- **Advisors de performance: só INFO**, e só as duas classes da FASE 4 —
  `created_by` sem índice (fora de predicado de policy) e `unused_index` num
  staging ocioso. **Nenhuma classe nova.**
- **Dados preservados.** 3 clientes, 5 projetos, 0 submissões. Nada apagado,
  nada semeado. O catálogo social foi instalado pela migration: 1 template, 6
  seções, 12 perguntas, 4 obrigatórias.
- `onboarding_submissions` em staging: `SELECT` e nada mais para `authenticated`.

### QA hospedado — PENDENTE

Não foi executado: exige uma pessoa com sessão real no navegador. O checklist
está no fim deste documento e no relatório da fase.

O projeto para o QA já está no estado certo, e isso foi **lido**, não presumido:
**Velmont Patentes · Social Media**, `type = social`, `status = active`, etapa
corrente **`onboarding`**, 8 etapas, 0 submissões. Nenhum avanço manual é
necessário.

## Débito técnico assumido

1. **O e-mail `onboarding_completed` não existe** (D-20). O `EmailService`
   inteiro é da FASE 16. O ponto de inserção está comentado no handler.
2. **`file` continua sem renderizador** (I-05, FASE 12). O enum tem o valor, o
   banco recusa gravar resposta desse tipo, e a tela mostra a pergunta como
   indisponível — fail closed, sem input falso.
3. **Sem tela de gestão de template.** `onboarding.template.manage` existe na
   matriz e não tem UI: o catálogo é produto, instalado por migration.
   Construtor de formulários continua na lista de overengineering.
4. **Retomada não é persistida.** A seção inicial é derivada das respostas a
   cada carga. Duas abas abertas na mesma conta não sincronizam a navegação —
   as RESPOSTAS sincronizam, porque o upsert é por pergunta.
5. **`onboarding.reopen` não estava na matriz de `permissions.md`** antes desta
   fase; foi acrescentada com a operação. É crescimento da matriz, não desvio.

## Débito de segurança

Nenhum novo. Dois itens herdados continuam valendo:

- **RLS é row-level, não column-level.** Vale para o onboarding também: a
  projeção client-facing é explícita e `template_id` não atravessa a fronteira
  do RSC.
- **`security definer` ignora RLS.** As três RPCs novas checam papel e escopo no
  corpo, e cada recusa tem um teste. É o preço documentado da ADR-0011, agora
  pago mais três vezes.

`service_role`: **zero** no domínio de onboarding. Continua com um único chamador
no sistema inteiro (`inviteAuthUser()`), e há teste de código-fonte que cobra.

## O que a FASE 8 recebe pronto

- `onboarding_submissions.status` real, para o bloco "Precisa da sua atenção".
- A jornada avançando sozinha no envio, para "Etapa atual".
- `activity_log` com `onboarding.started`, `.completed` e `.reopened`.

**Nada disso foi conectado ao dashboard nesta fase.** O card de atenção continua
em `src/mocks/hartmann.ts`, como o roadmap manda.

## Próxima fase

**FASE 8 — Dashboard.** Seis blocos na ordem da `product.md`, blocos vazios
desaparecendo, "Precisa da sua atenção" derivado por query, mobile first.
