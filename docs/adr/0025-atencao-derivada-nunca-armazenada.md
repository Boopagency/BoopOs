# ADR-0025 — Atenção é derivada, nunca armazenada

**Status:** aceito · FASE 8

## Contexto

O produto precisa responder, na abertura da Home, "alguma coisa depende de
mim?". Até a FASE 7 essa resposta vinha de uma constante em `src/mocks`, com um
CTA apontando para um projeto que deixou de existir — ou seja, não vinha de
lugar nenhum.

A forma óbvia de resolver seria uma tabela `attention_items`, escrita por
triggers ou por workflows, com estado de leitura e dispensa. É o desenho que
quase todo produto adota, e é o que a maioria das ferramentas de mercado usa.

## Decisão

**A atenção é derivada a cada request, e não existe em lugar nenhum do banco.**

`getClientAttention(projectId)` compõe a resposta chamando os loaders dos
domínios que já sabem autorizar a si mesmos. Não há tabela, fila, `dismiss`,
`snooze`, contador de leitura nem centro de notificações.

O motor **não consulta tabela**: cada source usa a query do próprio domínio, que
carrega o próprio guard. Um guard de código-fonte proíbe `createSupabaseServerClient`
e `@/lib/supabase/admin` dentro de `src/domains/attention`.

## Consequências

**A favor**

- Não existe estado para sair de sincronia. Uma pendência resolvida deixa de
  aparecer no request seguinte, sem job, sem invalidação, sem cron.
- Não existe segunda porta de autorização: o que a RLS não devolve, a atenção
  não vê. Persistir exigiria escrever a linha em algum lugar, e escrever exige
  decidir quem pode ler aquela linha — a decisão que a RLS já toma.
- Custo real hoje: uma consulta a mais por abertura da Home, em cache de request.

**Contra, e assumido**

- Sem histórico: não dá para responder "quando isto apareceu para o cliente?".
  Quando essa pergunta existir, a resposta é o `activity_log`, que já grava
  transições — não uma tabela nova.
- Sem dispensa: o cliente não "arquiva" um item. Ele resolve, ou o item fica.
  Para o volume da Boop, isso é o comportamento certo.
- A derivação escala com o número de sources. Com uma, é irrelevante.

## O gatilho que reabriria esta decisão

Uma fase em que a avaliação de todas as sources fique lenta o suficiente para
ser percebida na abertura da Home — o que significaria muitas sources, cada uma
com leitura cara. Aí a discussão é de **cache**, não de persistência: uma linha
materializada continua sendo estado que sai de sincronia.

Persistir atenção é event sourcing com outro nome, e event sourcing está na
lista de overengineering a evitar (`docs/spec-review.md` §4).

## Alternativas descartadas

| Alternativa                                  | Por que não                                                                 |
| -------------------------------------------- | --------------------------------------------------------------------------- |
| Tabela `attention_items` escrita por trigger | Estado duplicado, RLS nova, invalidação, e um caminho de escrita a proteger |
| Centro de notificações in-app                | Já estava na lista de overengineering. O e-mail e a Home resolvem           |
| Cache materializado por projeto              | Sem problema de performance a resolver, é complexidade sem gatilho          |

## Relacionadas

- [ADR-0026](0026-calma-exige-verificacao-completa.md) — o outro lado do contrato
- [ADR-0011](0011-workflows-transacionais-em-sql.md) — quando algo VIRA fronteira SQL
