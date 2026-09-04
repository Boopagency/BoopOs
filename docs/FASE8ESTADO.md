# FASE 8 — Estado ao fim

**Client Dashboard / Attention First.** A Home deixou de mostrar ficção, a
atenção passou a ser derivada do banco, e o onboarding — que existia, funcionava
e não era alcançável por ninguém — encontrou o cliente.

Base: `ad721f1` (fim da FASE 7, validada em ambiente hospedado).

**Status: CONCLUÍDA. Aguardando QA humano em ambiente hospedado.**

---

## O que a fase respondeu

A FASE 7 respondeu _"o que precisamos aprender com o cliente?"_. Esta responde a
pergunta que o cliente faz ao abrir o portal, e que o produto ainda não sabia
responder: **"preciso fazer alguma coisa agora?"**

```
ROTA  /portal/<uuid>
  ↓   requireActor()                    layout do grupo
  ↓   requireVisiblePortalProject()     layout do projeto — tenant + visibilidade
  ↓
getClientAttention(projectId)
  ↓   status === 'active'?              projeto parado não cobra ação (D-27)
  ↓   sources relevantes                appliesTo, derivado do template da jornada
  ↓   runSafely(source)                 isola a falha, RELANÇA sinal do Next
  ↓
resolveAttention(outcomes, evaluated)
  ↓   itens?     → attention
  ↓   falhou?    → degraded             ← a linha que a fase existe para escrever
  ↓   nenhum     → calm
  ↓
<AttentionState />                      três formas, uma decisão, zero recálculo
```

## O defeito que estava no ar

O CTA mais importante do produto apontava para `/portal/hartmann-social/conteudo`
— uma rota literal, com um id que deixou de existir na FASE 6. O guard do layout
respondia `notFound()`, então a laje "Precisa da sua atenção" levava o cliente a
uma página de erro. Passou por revisão humana, por QA hospedado e por uma fase
inteira sem ser vista.

Junto com ele, três outros blocos da Home vinham de `src/mocks/hartmann.ts`:
próxima entrega, próximo encontro e aprendizado. Nenhum tem origem no schema —
`meetings` e as tabelas de métrica não existem, e "próxima entrega" nunca teve
coluna em lugar nenhum.

O primeiro commit da fase remove os quatro. Ele vale sozinho, e é correção de
defeito, não composição.

## Decisões da fase

| #            | Decisão                                                   | Onde                                                      |
| ------------ | --------------------------------------------------------- | --------------------------------------------------------- |
| **D-25**     | navegação segue a feature, nunca a contagem de linhas     | [spec-review](spec-review.md#d-25)                        |
| **D-26**     | o estado de calma é resposta, não estado vazio            | [spec-review](spec-review.md#d-26)                        |
| **D-27**     | atenção só é avaliada em projeto `active`                 | [spec-review](spec-review.md#d-27)                        |
| **D-28**     | a saudação usa o nome da pessoa, nunca a razão social     | [spec-review](spec-review.md#d-28)                        |
| **D-29**     | a Home mostra a jornada resumida; a completa é `/projeto` | [spec-review](spec-review.md#d-29)                        |
| **D-30**     | o activity log não produz superfície client-facing        | [spec-review](spec-review.md#d-30)                        |
| **ADR-0025** | atenção é derivada, nunca armazenada                      | [ADR-0025](adr/0025-atencao-derivada-nunca-armazenada.md) |
| **ADR-0026** | calma exige verificação completa                          | [ADR-0026](adr/0026-calma-exige-verificacao-completa.md)  |

## Os dois buracos que a fase encontrou

Nenhum dos dois estava no plano. Os dois só apareceram ao escrever o código.

### 1. `notFound()` e `redirect()` são exceções

Toda a cadeia de autorização do portal sinaliza por `throw`. Um `try/catch`
ingênuo em volta de uma source **engoliria um 404 e o transformaria em estado
degradado** — o cliente veria "não conseguimos verificar suas pendências" no
lugar de um 404, e a página continuaria montando por cima de uma recusa de
acesso. Resiliência com aparência de resiliência, e falha de segurança de fato.

`unstable_rethrow` é a primeira linha do `catch` em `safety.ts`. Ela existe e é
função no Next 16.3.4 — conferido no `node_modules`, não presumido. Há teste que
lança `notFound()` e `redirect()` de dentro de uma source e exige que os dois
atravessem.

### 2. Um glob dentro de bloco de comentário fecha o comentário

`` `src/domains/*/types.ts` `` num docblock termina o comentário no `*/` e
quebra o parser. Custou um `pnpm check` vermelho e trinta erros de lint em
cascata. Trocado por `<dominio>`.

## O banco

**Zero.** Nenhuma migration, nenhuma coluna, nenhum índice, nenhum enum, nenhuma
policy, nenhum grant, nenhuma RPC.

```
$ git diff --stat ad721f1..HEAD -- supabase/
(vazio)

$ diff fingerprint-antes.txt fingerprint-depois.txt
(idêntico nas nove partes: colunas, constraints, índices, triggers,
 enums, funções, rls, policies, grants)
```

A única leitura nova é `getOnboardingStateForClient()`, que lê **menos** colunas
que a leitura existente: só `status`. Projeção client-facing encolhe; não cresce.

`service_role`: continua com **um** chamador no sistema inteiro
(`inviteAuthUser()`), e o guard que cobra isso agora varre também o domínio novo.

## O contrato

```ts
export type AttentionKind = 'onboarding.continue' // um, porque existe um

export interface AttentionResult {
  state: 'attention' | 'calm' | 'degraded'
  items: readonly AttentionItem[]
  complete: boolean // todas as sources relevantes responderam?
  evaluated: number // números, nunca erros
  failed: number
}
```

Invariantes testadas:

| Estado      | items | complete | failed |
| ----------- | ----- | -------- | ------ |
| `calm`      | 0     | `true`   | 0      |
| `degraded`  | 0     | `false`  | > 0    |
| `attention` | > 0   | qualquer | —      |

`evaluated === 0` é calma legítima: projeto pausado, concluído, ou sem source
aplicável não tem o que verificar.

## Telas

| Rota                         | O que mudou                                                    |
| ---------------------------- | -------------------------------------------------------------- |
| `/portal/[id]`               | Reescrita: quatro blocos, todos reais                          |
| `/portal/[id]/projeto`       | Aprofundamento — jornada completa, equipe, sem duplicar a Home |
| `/portal/[id]/onboarding`    | **Inalterada**, e agora alcançável                             |
| `/portal/[id]/conteudo`      | Estado honesto, sem loader                                     |
| `/portal/[id]/conteudo/[id]` | `notFound()` — não existe conteúdo real                        |
| `/portal/[id]/estrategia`    | Estado honesto **novo**                                        |
| `/portal/[id]/resultados`    | Estado honesto (o texto já era o certo)                        |
| `/portal/[id]/encontros`     | Estado honesto                                                 |
| `/portal/[id]/arquivos`      | Estado honesto                                                 |
| `/portal` · `/app`           | **Intocadas** — o resolvedor da FASE 6 não mudou               |
| `/admin/*`                   | **Intocado** (Decisão 19)                                      |

## O que morreu

```
src/mocks/hartmann.ts                          450 linhas de ficção
src/lib/data/portal.ts                         a camada que a segurava
src/components/patterns/content-row.tsx        formas do protótipo,
src/components/patterns/content-preview.tsx    não do banco
src/components/patterns/approval-panel.tsx
src/components/patterns/strategy-approval.tsx
src/components/patterns/dashboard-hero.tsx     virou portal-greeting
tests/component/approval-panel.test.tsx        5 casos, removidos com o componente
```

Os quatro componentes carregavam `previewTone`, `sizeLabel`, `versionCount` —
campos que não são coluna de lugar nenhum. Guardá-los como referência garantiria
que a FASE 9 ou 10 tentasse encaixar o schema real numa forma inventada, que é
exatamente o que a FASE 7 evitou ao descartar o `OnboardingSection` do protótipo.
Git e `patches/` mantêm o histórico.

**Hartmann e Velmont continuam no `seed.sql` e nos fixtures.** Sem dois tenants
distintos não existe suíte de isolamento; o que é proibido é hardcode
client-facing em `src/`.

## Medição da dobra

Renderizado com o CSS compilado, dentro de um frame real, em Chromium headless.
O elemento medido é o que RESPONDE "preciso fazer alguma coisa?".

| Estado      | 320px | 375px   | 414px | 768px |
| ----------- | ----- | ------- | ----- | ----- |
| `attention` | 599   | **576** | 579   | 617   |
| `calm`      | 393   | **394** | 369   | 468   |
| `degraded`  | 430   | **405** | 406   | 442   |

Meta: 667. **Zero overflow horizontal** nas quatro larguras.

O orçamento veio de _chrome_, na ordem que o plano fixou: barra inferior não
renderizada com duas seções, cabeçalho mais baixo (`h-14`), menos respiro na
abertura e na laje — só no celular. Nada foi tirado de fonte, alvo de toque,
contraste ou semântica.

## Testes

| Suíte                 | Antes   | Depois   |
| --------------------- | ------- | -------- |
| `tests/unit`          | 407     | **582**  |
| `tests/component`     | 81      | **126**  |
| projeto `unit`        | 488     | **708**  |
| `rls` (Postgres real) | 446     | **466**  |
| **total**             | **934** | **1174** |

64 arquivos (eram 49). Contagem do Vitest — nunca de `grep`: a diferença entre
ocorrência de `it(` no fonte e caso executado chega a 85 num único arquivo desta
suíte, porque ela é orientada a tabela.

Os números acima já incluem o QA de borda que fechou a fase: 46 casos
acrescentados depois da primeira contagem, cobrindo multi-projeto contra
Postgres real, o portão de status do motor, a existência em disco da rota por
trás de cada slug, e a altura de toque dos controles do cabeçalho. `pnpm build`
compila 24 rotas.

Arquivos novos:

- `tests/unit/attention-contract.test.ts` — as cinco invariantes, e as
  combinações que precisam respeitá-las
- `tests/unit/attention-degraded.test.ts` — falha isolada, **os dois sinais de
  navegação relançados**, e o atalho proibido
- `tests/unit/attention-order.test.ts` — ordem determinística, id estável,
  tabela de prioridade sem kind antecipado
- `tests/unit/phase8-attention-source.test.ts` — os quatro estados do onboarding,
  o CTA com id real, `appliesTo` derivado do template
- `tests/unit/phase8-journey-glance.test.ts` — os oito recortes da jornada
- `tests/unit/phase8-nav-availability.test.ts` — a navegação não olha para dados
- `tests/unit/phase8-home-composition.test.ts` — os quatro blocos, na ordem
- `tests/unit/phase8-no-mock.test.ts` · `phase8-no-hardcoded-project.test.ts` ·
  `phase8-attention-isolation.test.ts` — os guards
- `tests/component/attention-state.test.tsx` — as três formas, e o caso que
  proíbe as frases de calma na árvore do degradado
- `tests/component/portal-greeting.test.tsx` — nome da pessoa, nunca a razão social
- `tests/component/phase8-accessibility.test.tsx` — hierarquia, toque, cor, foco
- `tests/rls/phase8-attention-boundaries.test.ts` — as leituras do motor, aos pares

Dois guards de fases anteriores ficaram **mais fortes**, não removidos: "só a
camada de dados importa mocks" virou "ninguém importa", e "o mock de onboarding
saiu" virou "a pasta de mocks não existe".

## Débito técnico assumido

1. **Uma source só.** O motor é uma abstração exercitada por um caso. O custo é
   um tipo mais um array; a alternativa — a lógica dentro da página — obrigaria
   a reescrever a Home na FASE 11.
2. **Sem retry, sem observabilidade nova.** Falha de source vira uma linha de log
   e um estado neutro. Sem métrica de taxa de falha, sem alerta. Reavaliar com
   mais de duas sources.
3. **Sem Suspense.** A Home é uma leitura só, e um frame intermediário em que a
   atenção ainda não foi avaliada não pode existir — nada pode parecer calma
   antes da hora.
4. **Barra inferior dormindo.** `PortalBottomNav` está completo e testado, e não
   é renderizado. É código com gatilho, não código morto: a FASE 9 ou 10 liga.
5. **`InsightBlock` sem consumidor.** Mantido para a FASE 14 — é composição
   visual pura, sem forma de domínio inventada.
6. **Cinco rotas com estado honesto e sem domínio.** Cada uma sai da lista na
   fase que a preenche.
7. **`stageSummary` no `CalmState` é decisão da composição.** A Home passa `null`
   ao bloco "Agora" quando o estado é calmo, para não imprimir a mesma frase
   duas vezes. Se um terceiro consumidor aparecer, isso vira regra explícita.

## O CI passou a executar a suíte que já existia

Fechando a fase, o GitHub Actions provisiona banco. Até aqui não provisionava, e
o efeito era pior do que parecia: `pnpm test` roda as duas _projects_ do Vitest,
e a `rls` abre conexão num Postgres de verdade. Sem banco no runner, ela morria
em `ECONNREFUSED 127.0.0.1:54322` — **falhando fechada, como foi projetada**,
porque um teste de isolamento que "passa" sem banco não prova nada. O vermelho
no CI era a ausência da cobertura, não uma regressão: os 466 casos de RLS nunca
haviam rodado fora da máquina de quem os escreveu.

Os passos de banco estavam escritos para a FASE 4 — o próprio comentário no fim
do `ci.yml` dizia isso — e chegaram só agora. O pipeline passou a ser o que
`.claude/rules/testing.md` e `docs/deployment.md` sempre descreveram:

```
typecheck → lint → format:check → test:unit
  → db:start → db:reset → test:rls → build
```

A correção **provisiona, nunca afrouxa**: sem `continue-on-error`, sem
`|| true`, sem trocar `test` por `test:unit`, sem staging. O runner tem daemon
de Docker, então `pnpm db:start` toma o caminho oficial do repositório
(`supabase start`) em vez do plano B sem Docker, e `pnpm db:reset` reaplica as
22 migrations do zero — que é a própria pergunta da suíte — mais o seed com os
dois tenants sem os quais o isolamento não teria o que comparar. `test:unit`
ficou antes do contêiner: erro de lógica pura falha em 22 segundos em vez de
esperar o pull das imagens.

**Zero efeito no banco.** A mudança toca `ci.yml` e dois documentos; a árvore
`supabase/` continua com o mesmo hash da base da FASE 7.

## Débito de segurança

**Nenhum novo.** A fase não adiciona escrita, RPC, capacidade, policy nem
`service_role`. Os dois itens herdados continuam valendo, sem agravamento:

- **RLS é row-level, não column-level.** A resposta continua sendo projeção
  explícita mais `AssertClientFacing`. A FASE 8 só encolheu projeções.
- **`security definer` ignora RLS.** As RPCs existentes checam papel e escopo no
  corpo. A FASE 8 **não criou nenhuma**.

## O que a FASE 9 recebe pronto

- Um motor com contrato: uma source nova são ~30 linhas e uma linha de prioridade.
- Uma Home que não precisa mudar quando a estratégia chegar.
- Navegação com interruptor: ligar `strategy` é `available: false → true`.
- Chão limpo: sem mock, sem CTA quebrado, sem camada de dados fantasma.
- A regra escrita e com guard: _client-facing data must be real_.

**E o que a FASE 9 NÃO ganha:** attention source. Nela o cliente **lê** a
estratégia; não há ação que ele execute, então não há `AttentionKind`.
`strategy.approve` e `content.approve` nascem juntos na **FASE 11**, com
`approveStrategy` e `approveContent`. A pergunta que precede toda source é
sempre a mesma: _o cliente precisa executar alguma ação?_

## Próxima fase

**FASE 9 — Estratégia.**
