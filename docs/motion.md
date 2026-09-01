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
| `--motion-emphasized` | 560ms | Entrada editorial, olhar do mascote   |

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

Trocar de seção não anima. O filete azul do item ativo cresce em
`--motion-default` com `--ease-out`; o resto é imediato.

O painel de "Mais" no celular entra com `boop-rise` em `--motion-default` —
rápido o bastante para não atrapalhar, presente o bastante para explicar de
onde ele veio.

## Reduced motion

`prefers-reduced-motion: reduce` zera duração de animação e transição e desliga
`scroll-behavior`.

**Nenhuma informação depende de movimento.** Com as animações desligadas, todo
conteúdo continua visível, legível e na mesma posição final — o `fade-rise` usa
`animation-fill-mode: both`, então o estado final é o estado de repouso.

## O que não existe

- **Nenhuma biblioteca de motion.** Framer Motion não entrou. Tudo é CSS:
  `@keyframes`, `transition` e `animation-delay`. Não houve um caso que
  justificasse o custo — se aparecer orquestração real, entra por ADR.
- **Sem scroll hijacking.** O scroll é do usuário, inclusive na estratégia.
- **Sem parallax.** A deriva das nuvens não reage ao scroll.
- **Sem loading artificial.** O `Spinner` só existe enquanto o dado realmente
  não chegou.
