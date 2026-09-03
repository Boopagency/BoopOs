# ADR-0024 — Ciclo de vida por RPC, e o fim da escrita direta na submissão

**Status:** aceito · **Data:** 2026-09-03 · **Fase:** 7
**Revisa:** [ADR-0011](0011-workflows-transacionais-em-sql.md) e
[ADR-0023](0023-fronteiras-transacionais-de-projeto-e-jornada.md) (as duas seguem aceitas)
**Aplica:** [ADR-0022](0022-autorizacao-no-banco-e-fim-da-service-role-de-identidade.md)

## Contexto

A FASE 4 deu a `onboarding_submissions` `select`, `insert` e `update` para
`authenticated`, com policies para acompanhar. A policy de UPDATE foi escrita
com uma assimetria deliberada, e o comentário dela dizia por quê:

```sql
using (
  app.has_client_access(client_id)
  and (not app.is_client_user() or status = 'draft')   -- a linha ANTES
)
with check (app.has_client_access(client_id))          -- a linha DEPOIS
```

O `WITH CHECK` não repete a trava de `draft` **de propósito**: repeti-la
tornaria o próprio envio impossível. Ou seja: a policy foi desenhada para que
`draft → submitted` acontecesse por UPDATE direto.

A FASE 7 mostrou que essa premissa estava errada, e o erro não é da policy — é
de considerar "enviar o onboarding" uma escrita de uma linha. Ela nunca foi:

| O que o envio faz                        | Tabela                   |
| ---------------------------------------- | ------------------------ |
| `status`, `submitted_at`, `submitted_by` | `onboarding_submissions` |
| fecha `onboarding`, abre a próxima etapa | `project_stages`         |
| grava `onboarding.completed`             | `activity_log`           |

Com o GRANT de UPDATE aberto, um `client_user` podia chamar o PostgREST direto
e mover a submissão para `submitted` **sem** avançar a jornada e **sem** gravar
o log. O sistema não teria como saber que aquilo aconteceu: a submissão estaria
enviada, a jornada parada em `onboarding`, e a auditoria em branco. Nenhuma
constraint proíbe esse estado, e nenhuma tela o denuncia.

O INSERT tinha um problema irmão, e mais sutil: quem cria a submissão escolhe o
`template_id` — isto é, escolhe **qual formulário o cliente responde** — a
partir de um id vindo do navegador. `app.has_template_access()` foi escrita
justamente para nunca ir de template para submissão, e o INSERT aberto
reintroduzia o caminho invertido pela porta dos fundos.

Havia ainda uma terceira coisa que nenhuma policy poderia resolver: a
**reabertura**. Sem ela, um cliente que enviou com um erro de digitação não tem
recurso — nem ele, que perdeu o direito de escrever, nem a Boop, que não tinha
tela. O único conserto seria SQL manual em produção, que é o que a definição de
pronto do Marco 1 proíbe.

## Decisão

**O ciclo de vida de `onboarding_submissions` é escrito por três RPCs nomeadas,
e por mais nada. A tabela fica com `select` para `authenticated` — nem INSERT,
nem UPDATE, nem para a Boop.**

| Função                       | Quem            | O que faz                                      |
| ---------------------------- | --------------- | ---------------------------------------------- |
| `public.start_onboarding()`  | Boop            | abre a submissão; deriva o template do projeto |
| `public.submit_onboarding()` | quem tem escopo | envia + avança a etapa + grava o log           |
| `public.reopen_onboarding()` | `boop_admin`    | devolve para `draft`, sem tocar na jornada     |

As três recebem **`project_id` e nada mais**: template, cliente e submissão são
derivados dentro do corpo. Nenhuma aceita a identidade de quem chama por
parâmetro — o ator é sempre `(select auth.uid())`, como manda a ADR-0022.

`onboarding_answers` **não muda**: continua `SIU` com a RLS como fronteira
principal. É o autosave, acontece dezenas de vezes por sessão, escreve uma linha
e é idempotente por `unique (submission_id, question_id)`. Fazê-lo passar por
RPC seria pagar o preço da fronteira sem comprar nada.

## O que isso muda no critério da ADR-0011

A ADR-0011 fixou o critério "toca mais de uma linha e não pode ficar pela
metade", e a ADR-0023 o reafirmou. `submit_onboarding` cabe nele sem ajuste
nenhum: é a nona função, e estava prevista desde a FASE 2.

`start_onboarding` e `reopen_onboarding` **não cabem** — cada uma toca uma linha
de domínio. Elas são RPC por outra razão, e a ADR registra o critério novo:

> Quando uma operação multi-linha passa a ser RPC, as operações IRMÃS do mesmo
> ciclo de vida vão junto — mesmo as de uma linha só. Não por atomicidade, mas
> porque **duas portas para o mesmo estado é como uma delas fica sem uma
> checagem**.

Com uma porta só, autorização, transição, jornada e auditoria ficam no mesmo
lugar, e uma tela nova não pode esquecer nenhuma delas. Com duas, a segunda é a
que um dia esquece — e foi exatamente assim que o UPDATE direto virou um bypass.

Isso vale para o ciclo de vida, e não para toda escrita: a linha divisória é
"esta operação muda o ESTADO de uma máquina de estados?". `updateProject` muda
nome e período, e continua sendo UPDATE sob RLS.

## Alternativas consideradas

| Alternativa                                                   | Por que não                                                                                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apertar a policy de UPDATE em vez de revogar o GRANT          | Nenhum predicado de policy consegue exigir "e a jornada avançou junto". A policy decide sobre UMA linha, e o problema é a transação inteira.                          |
| Trigger em `onboarding_submissions` que avança a etapa        | Efeito colateral escondido: um UPDATE passaria a mexer em outra tabela sem que a chamada dissesse isso. E não resolveria o `template_id` escolhido pelo navegador.    |
| Manter INSERT aberto para a Boop e fechar só o UPDATE         | Deixaria de pé o caminho "escolher o formulário pelo id". Além disso, meia porta fechada é a pior das configurações: parece fechada em revisão de código, e não está. |
| Uma coluna `template_id` em `onboarding_answers` para validar | Segunda verdade sobre uma relação que já se deriva por `question → section → template`. A integridade virou trigger, que compara as duas pontas.                      |
| Deixar a validação de obrigatórias só no navegador            | Validação de cliente é UX, não fronteira: um POST direto no PostgREST não passa por ela. Ela existe nos dois lugares, e a autoridade é `app.answer_is_present()`.     |

## Consequências

**Mais fácil.** Existe um lugar — e um só — onde se lê o que acontece quando um
onboarding é enviado. A prova de que o bypass está fechado é um teste que roda
como `authenticated`, o mesmo papel do caminho real, e não uma inspeção de
policy.

**Mais difícil.** Toda operação nova de ciclo de vida do onboarding é uma
migration, não uma linha de TypeScript. É o custo pretendido: o atrito está no
lugar certo.

**Passa a exigir cuidado.** As três funções são `security definer`: a RLS **não**
vale dentro delas, e cada checagem que uma policy faria está escrita no corpo à
mão. Um `if` que suma num refactor não quebra varredura nenhuma — não há policy
no catálogo para conferir. Por isso `tests/rls/phase7-onboarding-boundaries.test.ts`
tem um caso para cada recusa escrita no corpo, e o caso falha se a linha sair.

A matriz de `tests/rls/policy-matrix.test.ts` passou `onboarding_submissions` de
`SIU` para `S`, e a varredura das duas fechaduras continua valendo: policy e
GRANT saíram juntos.

## Gatilho de revisão

Se uma quarta operação de ciclo de vida do onboarding aparecer, ou se outro
domínio precisar do mesmo fechamento (estratégia e conteúdo chegam nas FASES 9 a
11, e `strategy_approvals`/`content_approvals` já nasceram sem escrita pela
API), releia esta ADR **antes** de copiar o padrão: três RPCs por domínio, em
cinco domínios, é um número que precisa ser justificado de novo, e não herdado.
