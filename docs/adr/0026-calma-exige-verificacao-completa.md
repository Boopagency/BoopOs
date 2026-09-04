# ADR-0026 — Calma exige verificação completa

**Status:** aceito · FASE 8

## Contexto

O bloco de atenção da Home tem duas formas óbvias: há algo esperando, ou não há.
A implementação natural é uma linha:

```ts
const state = items.length === 0 ? 'calm' : 'attention'
```

Ela é mais curta, é o que qualquer pessoa escreveria, e é uma mentira.

Uma source que **falhou** devolve zero itens — exatamente como uma source que
respondeu e não encontrou nada. Com aquela linha, uma falha de leitura vira:

> Tudo certo por aqui.
> Você não precisa fazer nada agora.

O cliente sai do portal achando que nada depende dele, com uma pendência aberta
que ninguém conseguiu ler. **Zero itens porque a leitura falhou não é zero
pendências**, e o produto não tem como distinguir os dois casos depois que a
informação foi jogada fora.

Isso viola a regra que organiza a fase inteira: _client-facing data must be real_.

## Decisão

**Calma é uma afirmação sobre o mundo, e só pode ser feita quando o mundo
inteiro foi consultado com sucesso.**

O contrato carrega três estados, e a decisão é tomada em um lugar só,
`resolveAttention()`, nesta ordem:

```ts
const state =
  items.length > 0
    ? 'attention' // mostra o que se sabe
    : failed > 0
      ? 'degraded' // não conseguimos verificar
      : 'calm' // verificado, e não há nada
```

Invariantes, testadas:

| Estado      | items | complete | failed |
| ----------- | ----- | -------- | ------ |
| `calm`      | 0     | `true`   | 0      |
| `degraded`  | 0     | `false`  | > 0    |
| `attention` | > 0   | qualquer | —      |

`evaluated === 0` — projeto pausado, concluído, ou sem source aplicável — é
**calma legítima**: não há pergunta em aberto, então não há incerteza a
comunicar.

### Três estados, e não quatro

A combinação difícil é _há itens **e** uma source falhou_. Um quarto estado
obrigaria todo consumidor futuro — Home, e-mail, IA — a tratar uma variação que
na prática é "atenção mais um aviso". Em vez disso `complete` carrega o aviso, e
a view acrescenta uma linha discreta. **Mostrar o que se sabe é sempre melhor do
que esconder por causa do que não se sabe — desde que não se afirme completude.**

### A regra mora no domínio

Ela é de produto, não de apresentação. Se morasse na UI, o e-mail da FASE 16
reimplementaria a mesma decisão — e a segunda implementação é onde a divergência
nasce. Um digest que diz "tudo certo" por causa de uma falha de leitura é a
mesma mentira da Home, com a agravante de não poder ser corrigida por um
recarregamento.

## Consequências

- O componente recebe `state` pronto e não recalcula nada.
- A falha vira **número**, nunca erro: nada técnico atravessa a fronteira do RSC.
- Isolar uma source exige relançar os sinais de navegação do Next
  (`unstable_rethrow`), senão um 404 cross-tenant viraria estado degradado com a
  página montando por cima da recusa — falha de segurança com aparência de
  resiliência. Há teste dedicado.
- Um teste de componente afirma que as frases de calma **não aparecem** na
  árvore do estado degradado.

## Alternativas descartadas

| Alternativa                                    | Por que não                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Deixar a falha derrubar a Home inteira         | O resto da página é verdadeiro e útil; perder tudo por uma source é pior |
| Tratar falha como calma e logar                | É exatamente a mentira que este ADR existe para impedir                  |
| Retry automático com backoff                   | Complexidade sem gatilho. O retry é o cliente recarregando               |
| Mostrar mensagem técnica ("erro ao consultar") | O cliente não causou nada e não tem o que consertar                      |

## Relacionadas

- [ADR-0025](0025-atencao-derivada-nunca-armazenada.md) — o outro lado do contrato
