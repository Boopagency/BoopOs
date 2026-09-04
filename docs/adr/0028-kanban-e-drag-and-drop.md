# ADR-0028 — Kanban e drag-and-drop: a geometria nasce antes do domínio

**Status:** aceito · FASE 8.5

## Contexto

A decisão de produto está tomada: **a experiência de Conteúdo será um quadro
kanban, não uma lista.** A direção aproximada das colunas é _ideias → produção →
revisão → aprovado → publicado_, mas os status reais são da FASE 10 e não podem
ser congelados agora.

O domínio real — `content_items`, `content_versions`, a máquina de estados, a
produção no admin — é da FASE 10; aprovação e conversa, da FASE 11. A FASE 8.5
não cria nada disso.

A pergunta é o que, se alguma coisa, se constrói agora.

## Decisão

### 1. A geometria nasce agora; o domínio, na FASE 10

Nascem três primitivas **visuais e agnósticas de domínio**, e nada além delas:

```
BoardViewport   a faixa horizontal: rolagem, snap no celular, teclado
BoardColumn     uma coluna: título, contagem, corpo, estado vazio
BoardCard       uma laje clicável ou estática dentro de uma coluna
```

Elas **não podem conhecer**, e há teste de código-fonte que falha se conhecerem:
status de conteúdo, canal, formato, aprovação, versão, item de conteúdo,
projeto, tenant, Instagram, ou qualquer vocabulário de social media. Recebem
`title`, `count`, `children` — e nada mais.

O que a fundação estabelece, e que a FASE 10 não vai reescrever: largura de
coluna, gaps, rolagem horizontal, `scroll-snap` no celular, coluna vazia
preservada, quadro inteiro vazio, foco e teclado, alvo de toque, overflow, e a
linguagem visual da nova casca.

### 2. Nada disso alcança uma rota

Sem rota, sem entrada de navegação, sem dado. `content.available` continua
`false`. As primitivas existem em `src/components/patterns/` e são exercitadas
**apenas** por teste de componente com fixture sintética que vive dentro do
próprio teste.

Isso não é excesso de zelo: é a regra que a FASE 8 existiu para instalar —
_client-facing data must be real_ — e há guard de código-fonte que quebra se
qualquer rota importar um componente de quadro.

### 3. O quadro do cliente é somente-leitura

Esta é a decisão que reorganiza tudo o mais, e ela não é técnica.

- `strategy_approvals` e `content_approvals` **não têm INSERT para ninguém**,
  `boop_admin` incluído. Aprovação é RPC validado (FASE 11).
- _Aprovar e pedir ajuste têm a mesma prominência visual. Sempre._ Um arrasto
  consegue expressar "mover"; não consegue expressar "pedir ajuste".
- Arrastar um card para "Aprovado" seria a aprovação mais fácil de disparar por
  acidente do produto inteiro, numa ação versionada e irreversível.

Quem move conteúdo pela esteira é a **Boop**, no admin, e cada movimento é uma
máquina de estados com validação, activity log e notificação. **Movimentação
operacional pertence ao admin e ao workflow real.**

Consequência direta: drag-and-drop é uma feature de **admin, desktop-first** —
não do portal, que é mobile-first e client-facing.

### 4. Drag-and-drop: `@dnd-kit`, escolhida e adiada para a FASE 10

Nenhuma dependência é adicionada nesta fase.

| Opção | Mouse | Touch | Teclado | ARIA | Veredito |
| --- | --- | --- | --- | --- | --- |
| HTML5 nativo | ✅ | ❌ | ❌ | ❌ | sem touch e sem teclado |
| **`@dnd-kit`** | ✅ | ✅ | ✅ sensor próprio | ✅ live region | **preferida** |
| Pragmatic DnD | ✅ | ⚠️ apoia-se na DnD nativa | parcial | manual | o touch é justamente o problema |
| `react-aria` DnD | ✅ | ✅ | ✅ | ✅ | melhor a11y do lote, ecossistema grande demais para um caso |
| Pointer Events à mão | ✅ | ✅ | ✍️ nosso | ✍️ nosso | anúncio de arrasto para leitor de tela é caro de acertar |

A escolha por biblioteca em vez de código próprio segue o critério que a
[ADR-0018](0018-sem-biblioteca-de-ui-e-de-motion.md) já tinha escrito: biblioteca
entra em _"coisas em que o custo de acertar acessibilidade supera o de uma
dependência"_. Arrastar com teclado e anunciar origem e destino é exatamente
isso. A mesma ADR nomeia "gesto de arrastar" como gatilho de revisão de motion —
ele dispara na FASE 10, não aqui.

### 5. Arrastar é acelerador, nunca o único caminho

Quando a FASE 10 ligar o arrasto no admin, três condições valem:

1. **Toda transição de coluna existe também como ação explícita** — menu ou
   teclado. Toda transição é um `defineWorkflow` que pode recusar, e um card que
   "volta sozinho" sem explicação é pior que não ter arrasto.
2. **Nenhum byte de DnD alcança rota client-facing.**
3. **`prefers-reduced-motion` explícito**: a biblioteca anima fora do CSS, e o
   bloco global com `!important` não alcança WAAPI nem estilo inline.

## Consequências

- A FASE 10 encontra a geometria pronta e decide o domínio livre: colunas,
  status, forma do card e projeção client-facing nascem lá, sem que o layout já
  os tenha decidido por antecipação.
- Leitura e escrita serão **dois componentes com dois nomes**, nunca um com
  `readOnly` — a mesma regra que o repositório aplica a projeção ("duas formas
  com dois nomes, nunca uma com booleano").
- A dependência de runtime continua em oito pacotes.
- Enum nenhum foi criado. Migration nenhuma foi criada.

## Alternativas descartadas

| Alternativa | Por que não |
| --- | --- |
| Construir `KanbanBoard` já sabendo status e card | Congela na geometria o domínio que a FASE 10 precisa decidir. Seria reescrito |
| Não construir nada agora | A geometria horizontal, o snap e o teclado não dependem do domínio, e são o que custa acertar |
| Adicionar `@dnd-kit` já, sem usar | Dependência sem consumidor, e o gatilho da ADR-0018 ainda não disparou |
| Kanban editável no portal | Contradiz o modelo de aprovação: arrasto não expressa "pedir ajuste", e aprovação é RPC validado |
| Rota interna de demonstração | Dado falso alcançável por usuário é exatamente o que a FASE 8 apagou |

## Relacionadas

- [ADR-0018](0018-sem-biblioteca-de-ui-e-de-motion.md) — o gatilho de revisão que dispara na FASE 10
- [ADR-0027](0027-a-casca-do-portal-e-um-ambiente.md) — a casca que o quadro vai habitar
- [ADR-0007](0007-versionamento-e-aprovacao.md) — aprovação pertence à versão
