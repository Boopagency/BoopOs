# Design system — Boop OS

Os valores. O raciocínio está em [`design-direction.md`](design-direction.md).

Fonte única: `src/app/globals.css`. **Nenhum componente escreve hexadecimal** —
a regra vale sem exceção (`.claude/rules/frontend.md`).

---

## Cor

### Paleta física

Extraída dos assets oficiais, não inventada. As quatro primeiras vêm
literalmente dos SVGs da marca; `slate` e `bone` vêm de amostragem de pixels da
apresentação institucional.

| Token              | Valor     | Origem                | Papel                                                      |
| ------------------ | --------- | --------------------- | ---------------------------------------------------------- |
| `--boop-blue`      | `#00C2FF` | logo, mascote         | Cor gráfica e sinal. **Não é cor de texto em fundo claro** |
| `--boop-blue-deep` | `#0A7C9E` | derivada              | Azul acessível: texto, link e anel de foco no claro        |
| `--boop-blue-ink`  | `#11ACC4` | gradiente da logo     | Hover da ação primária                                     |
| `--sky`            | `#7AD7F4` | olho claro do mascote | Rótulos sobre navy                                         |
| `--slate`          | `#7488A3` | apresentação          | Laje atmosférica                                           |
| `--slate-deep`     | `#4E6076` | derivada              | Texto secundário no claro                                  |
| `--navy`           | `#0B1B2C` | logo, mascote         | Tinta e superfície inversa                                 |
| `--ink`            | `#1A1A1A` | pupila do mascote     | Reserva                                                    |
| `--cloud`          | `#FFFDF5` | logo, mascote         | Fundo. Off-white **quente**                                |
| `--bone`           | `#E3DCCC` | apresentação          | Superfície secundária                                      |

### Tokens semânticos

O caminho padrão. Componente usa estes, não os físicos.

| Token                                         | Resolve para                      |
| --------------------------------------------- | --------------------------------- |
| `--background` / `--background-inverse`       | `cloud` / `navy`                  |
| `--foreground`                                | `navy`                            |
| `--foreground-muted`                          | `slate-deep`                      |
| `--foreground-on-inverse`                     | `cloud`                           |
| `--foreground-muted-on-inverse`               | `#9BADC4`                         |
| `--surface`                                   | `#FFFEFA`                         |
| `--surface-soft`                              | `bone`                            |
| `--surface-emphasis`                          | `slate`                           |
| `--surface-inverse`                           | `navy`                            |
| `--accent` / `--accent-hover`                 | `boop-blue` / `boop-blue-ink`     |
| `--accent-foreground`                         | `navy`                            |
| `--accent-text`                               | `boop-blue-deep`                  |
| `--rule` / `--rule-strong` / `--rule-inverse` | `#DAD3C2` / `#BFB6A1` / `#22384F` |
| `--success` / `--warning` / `--danger`        | `#1F7A5C` / `#9A6210` / `#B3261E` |
| `--ring` / `--ring-inverse`                   | `boop-blue-deep` / `boop-blue`    |

Estados são terrosos de propósito: verde e vermelho de semáforo brigariam com a
paleta analógica.

### Contraste

Verificado por teste (`tests/unit/contrast.test.ts`), que lê `globals.css` — se
alguém mudar um token e quebrar acessibilidade, o CI falha.

| Combinação                 | Razão      |                          |
| -------------------------- | ---------- | ------------------------ |
| navy sobre cloud           | 17.08:1    | AA                       |
| slate-deep sobre cloud     | 6.33:1     | AA                       |
| cloud sobre navy           | 17.08:1    | AA                       |
| **navy sobre boop-blue**   | **8.42:1** | **AA — a ação primária** |
| navy sobre slate           | 4.80:1     | AA                       |
| boop-blue-deep sobre cloud | 4.70:1     | AA                       |
| cloud sobre slate          | 3.56:1     | AA-large apenas          |
| ~~cloud sobre boop-blue~~  | 2.03:1     | **reprova — nunca usar** |
| ~~boop-blue sobre cloud~~  | 2.03:1     | **reprova — nunca usar** |

**Duas regras que decorrem disso:**

1. A ação primária é azul com texto navy. Off-white sobre azul não existe.
2. Sobre a laje slate, texto pequeno é **navy**; off-white só em display.

## Tipografia

Poppins (`next/font/google`), pesos 400, 500, 600 e 700 — só os quatro que o
sistema usa.

| Classe       | Tamanho                                                     | Peso | Uso                             |
| ------------ | ----------------------------------------------------------- | ---- | ------------------------------- |
| `.t-meta`    | 11→12px, `0.16em`, caixa alta                               | 600  | Metadados, rótulos, botões      |
| `.t-label`   | 14px                                                        | 500  | Labels de campo, texto auxiliar |
| `.t-body`    | 16→17px, altura 1.65                                        | 400  | Corpo                           |
| `.t-lead`    | `clamp(18px, …, 24px)`                                      | 400  | Abertura de seção               |
| `.t-title`   | `clamp(20px, …, 30px)`                                      | 600  | Título funcional                |
| `.t-section` | `clamp(28px, …, 52px)`, `-0.025em`                          | 700  | Seção                           |
| `.t-display` | `clamp(40px, …, 88px)`, `-0.035em`, altura 0.94, caixa alta | 700  | Display editorial               |
| `.t-numeral` | `clamp(56px, …, 112px)`, tabular                            | 700  | Número de destaque              |

Todas responsivas por `clamp()`; nenhum breakpoint manual de tipografia.

**Armadilha do `ch`.** `max-w-[22ch]` resolve contra o font-size do **próprio
elemento**. Num wrapper em 16px isso dá ~176px, não a largura de um título de
52px. A largura máxima vai sempre no elemento que tem o tamanho — foi um defeito
real encontrado no QA visual.

## Espaçamento e grid

| Token           | Valor                         |
| --------------- | ----------------------------- |
| `--content-max` | 1180px                        |
| `--wide-max`    | 1440px                        |
| `--gutter`      | 20px → 40px a partir de 768px |
| `--measure`     | 62ch                          |

Utilitários: `.content`, `.content-wide`, `.measure`.

Ritmo vertical: seção 64→96px, bloco 40→56px, entre elementos 12/20/32px.

**Breakpoints** (Tailwind): 640 `sm` · 768 `md` · 1024 `lg` · 1280 `xl`.
Revisados no QA: 375, 430, 768, 1024, 1440.

## Raio

| Token           | Valor | Onde                                         |
| --------------- | ----- | -------------------------------------------- |
| `--radius-none` | 0     | Lajes de largura total                       |
| `--radius-sm`   | 2px   | Botões, campos, blocos da jornada, previews  |
| `--radius-md`   | 4px   | Superfícies internas                         |
| `--radius-lg`   | 8px   | Só o que flutua: `<dialog>`, painel inferior |
| `--radius-full` | 999px | Só o que é circular por natureza             |

Quase reto por decisão. Ver
[`design-direction.md`](design-direction.md#o-teste).

## Borda e profundidade

**Sem sombra em nenhum lugar.** Profundidade vem de camada de cor, escala e
espaço.

Borda só quando separa de verdade: filete de 1px em `--rule` (decorativa) ou
`--rule-strong` (funcional, em controle). Nunca um contorno em volta de cada
bloco. Barra de 2px à esquerda em `Callout` e `InsightBlock` — separa sem
encaixotar.

## Componentes

### Primitivos (`src/components/ui`)

| Componente                     | Notas                                                                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `Button` / `ButtonLink`        | `primary` (azul + navy), `solid` (navy), `outline`, `quiet`, `on-inverse`. Altura 48px (`md`) e 56px (`lg`). Rótulo em `.t-meta` |
| `Field` + `Input` + `Textarea` | Label sempre associada; erro por `aria-describedby`. Altura 48px                                                                 |
| `StatusMark`                   | Ponto + rótulo em pt-BR. **Não é pill**, e a cor nunca é o único portador do significado                                         |
| `Callout`                      | Barra à esquerda; `danger` vira `role="alert"`                                                                                   |
| `Spinner`                      | Os olhos da marca piscando                                                                                                       |

### Marca (`src/components/brand`)

`BoopMark` (SVG oficial intacto), `BoopEyes` (geometria oficial, olhar
animável), `CloudLayer` (atmosfera).

### Padrões (`src/components/patterns`)

`DashboardHero` · `AttentionBlock` · `ProjectJourney` · `SectionHeading` ·
`InsightBlock` · `ContentPreview` · `ContentRow` · `ApprovalPanel` ·
`StrategyApproval` · `OnboardingFlow` · `EmptyState`.

Cada um nasceu de uma tela concreta. Nenhum foi criado porque o nome soava bem.

### Diálogo

`<dialog>` nativo, com `showModal()`. Foco preso, `Esc` para fechar, fundo
inerte e `::backdrop` vêm do browser. Foi o que dispensou uma biblioteca de
modal — e por isso o projeto não tem Radix nem shadcn.

## Ícones

**Não há biblioteca de ícones.** As setas são tipográficas (`→`, `←`, `↓`), os
marcadores são filetes e pontos, e o resto é texto. Ícone nunca substitui
rótulo importante.

Se um dia entrar uma biblioteca, entra uma só, e por necessidade demonstrada.

## Acessibilidade

- HTML semântico; `h1..h3` em ordem; `<ol>` onde há ordem.
- Foco visível sempre — `--ring` no claro, `--ring-inverse` sobre navy e slate.
- Alvo de toque de 48px em todo controle client-facing.
- Contraste AA garantido por teste.
- `prefers-reduced-motion` desliga toda animação, sem perda de informação.
- Nenhum significado depende só de cor.
- Decorativo é `aria-hidden`; nuvens e blocos da jornada não são anunciados.
