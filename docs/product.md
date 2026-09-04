# Produto — Boop OS

## Por que existe

A Boop não opera como agência de pacote de posts. O processo é: entender o
negócio → diagnosticar → pesquisar → definir estratégia → executar → medir →
aprender → evoluir. Hoje esse processo acontece em ferramentas espalhadas e o
cliente só enxerga o que chega por WhatsApp.

O Boop OS é o sistema que sustenta o processo e o torna visível.

**Percepção-alvo do cliente:** _"Eu sei exatamente o que está acontecendo com
minha marca."_

## As dez perguntas

Toda tela do portal existe para responder pelo menos uma delas. Se uma tela não
responde nenhuma, ela não deveria existir.

| #   | Pergunta                          | Onde é respondida                        |
| --- | --------------------------------- | ---------------------------------------- |
| 1   | O que está acontecendo agora?     | Início — etapa atual                     |
| 2   | Em que etapa estamos?             | Início — jornada                         |
| 3   | Alguma coisa depende de mim?      | Início — "Precisa da sua atenção"        |
| 4   | Qual é a próxima entrega?         | Início — próxima entrega                 |
| 5   | Qual é o próximo encontro?        | Início — próximo encontro / Encontros    |
| 6   | O que já foi aprovado?            | Conteúdo · Estratégia                    |
| 7   | O que está sendo produzido?       | Conteúdo                                 |
| 8   | Quais resultados estamos obtendo? | Resultados                               |
| 9   | O que aprendemos até agora?       | Resultados — "O que aprendemos" · Review |
| 10  | O que acontece depois?            | Início — jornada                         |

## Personas

| Persona                    | Papel         | Contexto de uso                                                                  |
| -------------------------- | ------------- | -------------------------------------------------------------------------------- |
| Sócio/estrategista da Boop | `boop_admin`  | Desktop. Cria clientes, projetos, estratégias, publica reviews                   |
| Time da Boop               | `boop_member` | Desktop. Produz conteúdo, conduz onboarding e reuniões                           |
| Contato do cliente         | `client_user` | **Celular**, sessões curtas, poucas vezes por semana. Aprova, comenta, acompanha |

O `client_user` é o usuário mais importante e o que menos tempo tem. Ele decide
em 30 segundos, no celular, entre uma reunião e outra.

## Jornada do cliente

```
cliente fechado → criação do cliente → convite → login → onboarding
→ reunião de imersão → pesquisa → estratégia → aprovação estratégica
→ planejamento editorial → produção → aprovação de conteúdos → publicação
→ resultados → review mensal → aprendizados → próximo ciclo ⟲
```

A jornada é **cíclica**: o review mensal reabre `production → publishing →
review` para o ciclo seguinte. As etapas de fundação permanecem concluídas e
visíveis no histórico.

Cada `project_type` tem sua própria jornada. Nenhuma etapa é hard-coded em
componente: a jornada vem de um template tipado (`src/config/journeys`), e o
projeto guarda as etapas instanciadas.

### Jornada `social.v1` (a única completa na V0)

| Ordem | Chave        | Rótulo no portal  |
| ----- | ------------ | ----------------- |
| 1     | `kickoff`    | Início do projeto |
| 2     | `onboarding` | Onboarding        |
| 3     | `immersion`  | Imersão           |
| 4     | `research`   | Pesquisa          |
| 5     | `strategy`   | Estratégia        |
| 6     | `production` | Produção          |
| 7     | `publishing` | Publicação        |
| 8     | `review`     | Review            |

`website`, `branding`, `automation` e `custom` receberam jornadas mínimas na
FASE 6 (apenas para provar que a arquitetura não depende de social) e são
detalhadas quando houver um projeto real. As cinco vivem em
`src/config/journeys.ts`.

### A página do projeto, depois da FASE 6

Ela responde **"onde estamos e o que vem"**. O bloco "O que combinamos" —
`project.scope` no protótipo — **saiu**: não tinha origem no schema, e mantê-lo
significaria inventar o conteúdo de um acordo comercial na tela do cliente
(D-16). "Quem está no projeto" ficou e passou a ser real: as pessoas da Boop com
vínculo explícito no cliente, só o nome, sem cargo.

## Navegação do portal

**A navegação segue o PRODUTO, nunca a contagem de linhas** (D-25). Uma seção
aparece quando a funcionalidade existe — `available` é constante em código,
alterada por commit de fase.

A diferença é o cliente: um menu que aparece quando a primeira linha é criada e
some quando a última é apagada faz a arquitetura do sistema piscar na cara de
quem só queria acompanhar o próprio projeto. Quando a FASE 10 ligar Conteúdo,
ele aparece para todo mundo — inclusive para quem tem zero peças, que vê um
estado vazio honesto e continua sabendo onde a seção fica.

| Seção      | Slug         | Disponível desde |
| ---------- | ------------ | ---------------- |
| Início     | —            | FASE 8           |
| Projeto    | `projeto`    | FASE 8           |
| Estratégia | `estrategia` | FASE 9           |
| Conteúdo   | `conteudo`   | FASE 10          |
| Arquivos   | `arquivos`   | FASE 12          |
| Encontros  | `encontros`  | FASE 13          |
| Resultados | `resultados` | FASE 14          |

Sete chaves, e uma oitava exige justificativa escrita. O teto continua valendo;
o que mudou é que ele deixou de ser piso.

**Ocultar da navegação não invalida a rota.** Todas as URLs existem e respondem
com um estado honesto — deep link é o principal caminho de entrada do produto, e
uma URL que já existiu e passa a dar 404 quebra qualquer link já compartilhado.

**Onboarding não é uma seção**: é uma tarefa, alcançada pelo bloco de atenção e
pela etapa da jornada. Uma pendência que vira item de menu deixa de ser
pendência e vira lugar.

No celular, a barra inferior só é renderizada com **três ou mais** seções: com
duas, ela custaria 56px permanentes para oferecer um link que a Home já dá, e o
painel "Mais" não teria o que abrir. Abaixo do limiar, a linha de palavras do
cabeçalho vale nos dois breakpoints.

`/portal` é a rota canônica. `/app` existe como redirect em `next.config.ts`.

`/portal` é um **resolvedor**, não uma tela. Ele consulta os projetos que a
pessoa alcança (RLS) e quais devem aparecer para ela (D-18), e decide:

| Projetos visíveis | O que acontece                                      |
| ----------------- | --------------------------------------------------- |
| nenhum            | estado vazio com voz — nunca 404, nunca mock (D-19) |
| um                | redireciona direto, sem seletor                     |
| dois ou mais      | tela de escolha + seletor discreto no cabeçalho     |

O seletor **não é um oitavo item de navegação**: é troca de contexto no
cabeçalho. O cabeçalho é moldura — "Ciclo N" saiu dele na FASE 8 e desceu para o
bloco "Agora", onde ciclo significa alguma coisa.

## Dashboard (Início)

A Home é a interface principal do produto. Ela responde UMA frase, nesta ordem:

> quem é você aqui → algo depende de você? → onde estamos → qual é a jornada

Quatro blocos, todos com origem no banco. Bloco sem origem **desaparece** — não
vira card com "nenhum item".

1. **Abertura pessoal** — "Boa tarde, Ana." a partir de `profiles.full_name`.
   Sem nome preenchido, cumprimenta sem nome; **nunca** a razão social no lugar
   de um nome próprio (D-28). Cliente e projeto vêm separados, como metadado.
2. **Estado de atenção** — o eixo da tela, em uma de três formas (abaixo).
3. **Agora** — ciclo, rótulo da etapa corrente e o `summary` oficial do template.
4. **A jornada** — três etapas: anterior · atual · próxima (D-29), com um
   ponteiro para a jornada completa em `/projeto`.

Não há gráficos. Não há cards decorativos. Não há próxima entrega, próximo
encontro, aprendizado nem atividade recente: **nenhum deles tem origem hoje** —
três nem tabela têm — e o activity log nunca alcança o cliente (D-30).

### Os três estados da atenção

A pergunta "preciso fazer alguma coisa?" **sempre** tem resposta na tela.

| Estado      | Quando                                          | O que o cliente vê                                                               |
| ----------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `attention` | há item                                         | Laje navy, olhos, numeral, CTA. O primeiro item domina; os demais viram lista    |
| `calm`      | **todas** as sources responderam, e não há item | "Tudo certo por aqui." · "Você não precisa fazer nada agora." · a frase da etapa |
| `degraded`  | alguma source falhou                            | "Não conseguimos verificar todas as suas pendências agora." Neutro, sem CTA      |

**Calma não é estado vazio** (D-26): é a resposta à pergunta nº 3 das dez, e por
isso não desaparece. É, com folga, o bloco mais visto do produto.

**Degradado não é calma.** Zero itens porque a leitura falhou não é zero
pendências — dizer "tudo certo" ali seria mentir para o cliente
([ADR-0026](adr/0026-calma-exige-verificacao-completa.md)).

### Atenção é derivada

Não existe tabela de pendências. `getClientAttention()` compõe a resposta a cada
request, a partir dos domínios que já autorizam a si mesmos
([ADR-0025](adr/0025-atencao-derivada-nunca-armazenada.md)).

Um tipo de atenção só nasce quando existem, ao mesmo tempo: estado
client-facing real, ação real, e ação que **o cliente** pode executar. Sem
acionabilidade, sem atenção — uma reunião marcada não vira pendência só por
existir.

Na V0, a única source é o **onboarding em `draft`**. `not_started` não gera
atenção porque só a Boop abre a submissão.

### Atenção por status de projeto

Só projeto `active` cobra ação de alguém (D-27). Pausado, concluído e arquivado
falam do próprio status, sem CTA — cobrar ação em projeto parado é o produto
contradizendo a operação.

## Superfícies principais

**Onboarding.** Uma seção por vez, barra de progresso, autosave a cada alteração,
sair e voltar sem perder nada. Ao finalizar: `submitted`, activity log
`onboarding.completed`, e-mail para a equipe.

**Estratégia.** Lida como apresentação editorial, não como tela de admin.
Blocos: Contexto · O que entendemos · Oportunidade · Público · Posicionamento ·
Territórios editoriais · Direção criativa · Séries · Experimentos · KPIs.
Duas ações: **Aprovar** ou **Solicitar ajuste**. Registra quem e quando.

**Conteúdo.** Lista agrupada por status, com preview. Ao abrir um item o cliente
vê: preview da arte/vídeo, título, legenda, objetivo, território, CTA, data
prevista e **versão**. Ações: Aprovar · Solicitar alteração · Comentar. Precisa
funcionar perfeitamente com uma mão, no celular.

**Resultados.** Números importam, mas o componente central é **O QUE APRENDEMOS**.

**Monthly Review.** Narrativa fixa:
_O que fizemos → O que aconteceu → O que funcionou → O que não funcionou → O que
aprendemos → O que muda._

## Design

Premium, editorial, minimalista, humano, claro, preciso. Muito espaço. Boa
tipografia. Hierarquia forte.

Não: dashboard SaaS genérico, 30 cards, gradientes aleatórios, glassmorphism,
menu gigante, ícone decorativo, gamificação.

**O cliente deve sentir controle, não tecnologia.**

Mobile first em tudo que é client-facing. No celular, nunca tabela com scroll
horizontal — lista ou card.

## Marco 1 — definição de pronto

O produto é utilizável de verdade quando este fluxo roda inteiro, em produção,
sem intervenção manual no banco:

```
Criar Hartmann no Admin → criar projeto Social → convidar as duas clientes
→ elas recebem e-mail → entram via Magic Link → veem o dashboard
→ completam o onboarding → a Boop lê as respostas → a Boop atualiza a etapa
→ a cliente vê a jornada atualizada → a Boop envia a estratégia
→ a cliente aprova → a Boop envia conteúdo → a cliente comenta ou aprova
```

Corresponde às FASES 0–11 mais o `EmailService` mínimo (ver
[`roadmap.md`](roadmap.md)).

## Fora do produto na V0

Ver [`spec-review.md` §5](spec-review.md#5-fora-da-v0). Em resumo: nenhuma
integração com plataformas de mídia, nenhum agendamento de publicação, nenhum
financeiro, nenhum chat próprio. O Boop OS **mostra** o trabalho; ele não publica
no Instagram nem substitui o WhatsApp.
