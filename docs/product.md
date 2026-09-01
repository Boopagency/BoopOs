# Produto — Boop OS

## Por que existe

A Boop não opera como agência de pacote de posts. O processo é: entender o
negócio → diagnosticar → pesquisar → definir estratégia → executar → medir →
aprender → evoluir. Hoje esse processo acontece em ferramentas espalhadas e o
cliente só enxerga o que chega por WhatsApp.

O Boop OS é o sistema que sustenta o processo e o torna visível.

**Percepção-alvo do cliente:** *"Eu sei exatamente o que está acontecendo com
minha marca."*

## As dez perguntas

Toda tela do portal existe para responder pelo menos uma delas. Se uma tela não
responde nenhuma, ela não deveria existir.

| # | Pergunta | Onde é respondida |
| --- | --- | --- |
| 1 | O que está acontecendo agora? | Início — etapa atual |
| 2 | Em que etapa estamos? | Início — jornada |
| 3 | Alguma coisa depende de mim? | Início — "Precisa da sua atenção" |
| 4 | Qual é a próxima entrega? | Início — próxima entrega |
| 5 | Qual é o próximo encontro? | Início — próximo encontro / Encontros |
| 6 | O que já foi aprovado? | Conteúdo · Estratégia |
| 7 | O que está sendo produzido? | Conteúdo |
| 8 | Quais resultados estamos obtendo? | Resultados |
| 9 | O que aprendemos até agora? | Resultados — "O que aprendemos" · Review |
| 10 | O que acontece depois? | Início — jornada |

## Personas

| Persona | Papel | Contexto de uso |
| --- | --- | --- |
| Sócio/estrategista da Boop | `boop_admin` | Desktop. Cria clientes, projetos, estratégias, publica reviews |
| Time da Boop | `boop_member` | Desktop. Produz conteúdo, conduz onboarding e reuniões |
| Contato do cliente | `client_user` | **Celular**, sessões curtas, poucas vezes por semana. Aprova, comenta, acompanha |

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

| Ordem | Chave | Rótulo no portal |
| --- | --- | --- |
| 1 | `kickoff` | Início do projeto |
| 2 | `onboarding` | Onboarding |
| 3 | `immersion` | Imersão |
| 4 | `research` | Pesquisa |
| 5 | `strategy` | Estratégia |
| 6 | `production` | Produção |
| 7 | `publishing` | Publicação |
| 8 | `review` | Review |

`website`, `branding`, `automation` e `custom` recebem jornadas mínimas na FASE 6
(apenas para provar que a arquitetura não depende de social) e são detalhadas
quando houver um projeto real.

## Navegação do portal

Sete itens. Nada além disso sem justificativa escrita.

```
Início · Projeto · Conteúdo · Estratégia · Arquivos · Resultados · Encontros
```

Rotas: `/portal/[projectId]`, `/portal/[projectId]/projeto`, `/conteudo`,
`/estrategia`, `/arquivos`, `/resultados`, `/encontros`.

Com um único projeto acessível, `/portal` redireciona direto e nenhum seletor
aparece. Com mais de um, surge um seletor discreto no cabeçalho.

## Dashboard (Início)

Ordem fixa, de cima para baixo. Blocos vazios **desaparecem** — não viram card
com "nenhum item".

1. **Precisa da sua atenção** — derivado por query, não por tabela.
   *"3 conteúdos esperando sua aprovação."*
2. **Etapa atual** — *"Pesquisa estratégica em andamento."*
3. **Próxima entrega** — *"Direção Editorial · 04 de setembro."*
4. **Jornada** — linha de etapas: `✓ Imersão · ● Pesquisa · ○ Estratégia · ○ Produção`
5. **Próximo encontro** — *"Brand Immersion · 03 de setembro · 14:00."*
6. **Resultados** — só aparece quando já existir métrica registrada.

Não há gráficos no dashboard. Não há cards decorativos.

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
*O que fizemos → O que aconteceu → O que funcionou → O que não funcionou → O que
aprendemos → O que muda.*

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
