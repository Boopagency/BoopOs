# Motion — Boop OS

Movimento com propósito. Os valores vivem em `src/app/globals.css`.

**A regra que organiza todas as outras:** navegação cotidiana é instantânea;
motion editorial existe só onde cria narrativa. Ninguém deveria esperar uma
animação para ler a lista de conteúdo.

---

## Tokens

| Token                 | Valor | Onde                                  |
| --------------------- | ----- | ------------------------------------- |
| `--motion-instant`    | 90ms  | Retorno de toque, hover de item denso |
| `--motion-fast`       | 160ms | Hover, foco, mudança de cor           |
| `--motion-default`    | 240ms | Abertura de painel, mudança de estado |
| `--motion-page`       | 220ms | Entrada do workspace na troca de rota |
| `--motion-emphasized` | 560ms | Entrada editorial, olhar do mascote   |

`--motion-page` fica no PISO da faixa útil de propósito. 320ms numa troca de
seção que a pessoa já pediu é atraso percebido, não refinamento — a regra de que
navegação cotidiana é instantânea continua valendo, e o que o token compra é
apenas que o conteúdo não apareça em corte seco.

| Easing              | Curva                          | Caráter                   |
| ------------------- | ------------------------------ | ------------------------- |
| `--ease-standard`   | `cubic-bezier(.2, 0, 0, 1)`    | Neutra. O padrão          |
| `--ease-out`        | `cubic-bezier(.16, 1, .3, 1)`  | Chega e assenta. Entradas |
| `--ease-emphasized` | `cubic-bezier(.22, 1, .36, 1)` | Momentos de marca         |

## Categorias

| Categoria        | O que faz                                      | Duração              |
| ---------------- | ---------------------------------------------- | -------------------- |
| **Enter**        | `fade-rise` nas aberturas editoriais           | `emphasized`         |
| **Exit**         | Não existe: navegação não anima saída          | —                    |
| **Reveal**       | Entrada em cascata do bloco de abertura        | `emphasized` + delay |
| **Navigation**   | Filete do item ativo, painel inferior          | `fast` / `default`   |
| **State change** | Cor de botão, borda de campo, estado de status | `fast`               |
| **Progress**     | Passo do onboarding, bloco da jornada          | `default`            |
| **Feedback**     | Aprovação, ajuste solicitado                   | `emphasized`         |
| **Delight**      | Piscada do mascote, deriva das nuvens          | lento e contínuo     |

## Fade-rise

O gesto de entrada do produto: `opacity 0→1` com `translateY(14px→0)`.

```
.rise  →  boop-rise, --motion-emphasized, --ease-out
.fade  →  só opacidade, para elementos que não devem se mover
```

Delays narrativos: `.rise-1` 60ms · `.rise-2` 150ms · `.rise-3` 250ms ·
`.rise-4` 360ms · `.rise-5` 480ms.

A ordem conta uma história: **manchete primeiro, texto depois, ação por
último**.

**Onde é permitido:** login, boas-vindas, abertura do dashboard, abertura da
estratégia, conclusão do onboarding, momento de aprovação, índice do protótipo.

**Onde é proibido:** qualquer lista, formulário, tabela, navegação e — sem
exceção — qualquer controle que o usuário já quer clicar. Atrasar a
interface é o oposto de refinamento.

## Nuvens

`boop-drift`: 34s (`.drift`) e 52s (`.drift-slow`), com amplitude menor que 2%
em X e Y. Não é animação, é respiração — só se percebe se você parar para
olhar. Sempre em `pointer-events-none` e `aria-hidden`.

## Mascote

**Olhar.** As pupilas se deslocam em `--motion-emphasized` com `--ease-out`.
Três direções: `default`, `down` (o gesto de atenção) e `right`.

**Piscada.** `boop-blink` a cada 7s, com `scaleY` caindo para 0.06 por um
instante. Só onde o mascote é o assunto: espera, estado vazio, boas-vindas,
aprovação. Nunca na jornada, onde ele é um marcador.

## Navegação

A CASCA não anima. Sidebar, cabeçalho e rail ficam parados entre rotas — e não
por configuração: elas não estão na subárvore animada. Só o `<Workspace>` entra,
com `key` derivado do caminho, e a casca é irmã desse nó (ADR-0027).

O gesto é `boop-workspace`: opacidade 0→1 com `translateY(8px→0)` em
`--motion-page`. **8px, e não os 14px do `boop-rise`**: numa troca de seção,
14px leem como conteúdo caindo; 8px leem como foco assentando.

O filete azul do item ativo cresce em `--motion-default` com `--ease-out`; o
resto é imediato.

O painel de "Mais" no celular entra com `boop-rise` em `--motion-default` —
rápido o bastante para não atrapalhar, presente o bastante para explicar de
onde ele veio.

## Espera

`skeleton-pulse` — opacidade 1→0.45→1 em 1.6s, contínuo — e **só em esqueleto**,
nunca em conteúdo. O `loading.tsx` do portal desenha as faixas da página nas
proporções reais, então a troca de esqueleto para conteúdo não mexe na régua.

Não existe atraso artificial em lugar nenhum: o esqueleto aparece enquanto o
dado realmente não chegou.

## Reduced motion

`prefers-reduced-motion: reduce` zera duração de animação e transição e desliga
`scroll-behavior`. O bloco usa `*` com `!important`, então **toda animação CSS
nova nasce coberta** — inclusive `boop-workspace` e `skeleton-pulse`.

O que ele NÃO alcança, e por isso importa: animação em JavaScript (WAAPI,
estilo inline) e os pseudo-elementos `::view-transition-*`. Nenhum dos dois
existe hoje; se um entrar, entra com regra própria.

**Nenhuma informação depende de movimento.** Com as animações desligadas, todo
conteúdo continua visível, legível e na mesma posição final — o `fade-rise` usa
`animation-fill-mode: both`, então o estado final é o estado de repouso.

## O que não existe

- **Nenhuma biblioteca de motion.** Framer Motion não entrou, e Motion for React
  também não entrou na FASE 8.5. Tudo é CSS: `@keyframes`, `transition` e
  `animation-delay`. Se aparecer orquestração real, entra por ADR.
- **Nenhuma View Transition.** O `<ViewTransition>` do React foi verificado e
  funciona **sem configuração** no Next 16.3.4. Ficou de fora porque anima o
  snapshot do documento INTEIRO por padrão — que é exatamente o que a casca não
  pode fazer —, porque o overlay captura eventos de ponteiro, porque o bloco de
  reduced motion não alcança os pseudo-elementos dele, e porque não existe em
  jsdom. É o caminho natural quando a FASE 10 pedir transição de elemento
  compartilhado (miniatura → detalhe).
- **Nenhum `useLinkStatus`.** Ele existe desde o Next 15.3, e a própria
  documentação diz que o estado pendente é pulado quando a rota foi
  prefetchada. Os links da sidebar ficam permanentemente em viewport, logo
  permanentemente prefetchados: o indicador nunca acenderia. O feedback de
  navegação vem do item ativo e do esqueleto.
- **Sem scroll hijacking.** O scroll é do usuário, inclusive na estratégia.
- **Sem parallax.** A deriva das nuvens não reage ao scroll.
- **Sem loading artificial.** O `Spinner` só existe enquanto o dado realmente
  não chegou.
