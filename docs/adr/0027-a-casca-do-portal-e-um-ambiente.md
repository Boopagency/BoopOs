# ADR-0027 — A casca do portal é um ambiente, não uma página

**Status:** aceito · FASE 8.5

## Contexto

A FASE 8 fechou funcionalidade e segurança: a Home responde com dado real, o
motor de atenção é derivado, a navegação segue a feature. O que ela não resolveu
foi a **sensação de produto**. O portal continua parecendo um site editorial
bonito, e não um ambiente da Boop.

A auditoria do pré-voo apontou sete causas objetivas, todas no código:

1. **O documento inteiro rola e nada é região.** `min-h-dvh flex flex-col`, sem
   nenhum container de scroll independente. Trocar de seção reseta o scroll e
   leva o cabeçalho junto.
2. **O único elemento persistente tem 56–64px.** O cabeçalho sticky. Fora dele,
   nada sobrevive a uma troca de rota.
3. **A navegação é literalmente um sumário de revista** — `flex-wrap` de
   palavras sob uma régua. Foi decidida assim na FASE 1.5, quando havia duas
   palavras e nenhum outro contexto para carregar.
4. **Existe um rodapé de documento** com "Boop OS" e o nome do cliente. Isso é
   colofão. Nenhuma aplicação tem rodapé.
5. **Toda página é uma coluna centralizada de 1180px.** Em 1440px sobram 130px
   de cada lado; o conteúdo flutua no meio de nada.
6. **Cinco das nove rotas renderizam um bloco centralizado** (`EmptyState`), e a
   própria direção de arte diz que centralizar é o gesto que faz qualquer tela
   parecer landing page.
7. **A troca de rota é um corte seco**, e quando o `loading.tsx` entra, o
   workspace some e vira um spinner centralizado em `min-h-[50vh]` — o conteúdo
   desaparece, a altura muda, o scroll pula.

Os itens 5 e 6 são deliberados e continuam certos na Home: a laje navy de
atenção em largura total é o melhor momento visual do produto. **O que falta não
é consertar a composição editorial — é construir a moldura de aplicação em volta
dela.**

## Decisão

**A casca do portal passa a ser um ambiente persistente em `lg` e acima, e
continua exatamente a FASE 8 abaixo disso.**

```
DESKTOP ≥ 1024px                          MOBILE / TABLET < 1024px
┌──────────┬──────────────┬──────────┐    ┌────────────────────────┐
│ SIDEBAR  │  WORKSPACE   │   RAIL   │    │ HEADER sticky (F8)     │
│ 17rem    │  1fr         │  18rem   │    ├────────────────────────┤
│          │              │          │    │ Início   Projeto  (F8) │
│ marca    │  conteúdo    │ contexto │    ├────────────────────────┤
│ cliente  │  da seção    │ real     │    │                        │
│ projeto▾ │              │          │    │  documento rola        │
│          │              │          │    │                        │
│ seções   │              │          │    └────────────────────────┘
│          │              │          │
│ conta    │              │          │      A casca de desktop
└──────────┴──────────────┴──────────┘      simplesmente não existe.
  sticky      fluxo normal    sticky
```

### A sidebar carrega quatro zonas, não uma lista

Uma sidebar que só oferecesse "Início / Projeto" seria pior que a linha de
palavras atual: pareceria um menu quebrado. Ela se paga porque absorve
**identidade da marca, cliente e projeto com seletor, seções, e conta** — e ao
absorver isso libera o cabeçalho de largura total para morrer, junto com o
rodapé. É a troca que transforma "site com coluna à esquerda" em "aplicação".

A navegação dentro dela **continua sendo feature-driven** (D-25): duas seções
hoje, uma linha em `src/config/app.ts` por fase. Nada de item `disabled`, cinza
ou com cadeado para preencher espaço.

### O mobile não muda nesta fase

`hidden lg:flex` na sidebar, `lg:hidden` no cabeçalho. O celular renderiza a
mesma árvore da FASE 8, e a garantia mais cara da fase anterior — a resposta de
atenção acima da dobra em 375 × 667 — é preservada por construção, não por
medição.

Há uma razão de produto além da prudência: **a FASE 9 muda o modelo mobile
sozinha.** Ligar Estratégia leva `sections.length` a 3, cruza o
`BOTTOM_NAV_THRESHOLD` e liga a barra inferior que já existe, testada. Construir
um drawer agora é construir para descartar uma fase depois.

### A rail é opaca ao domínio, e é composta pela PÁGINA

Duas decisões separadas, e as duas são load-bearing.

**Opaca.** A casca recebe `ReactNode`, nunca dado. Isso não é preferência: o
teste `phase8-nav-availability` lê o código-fonte de `portal-shell.tsx` e falha
se a palavra `cycle` aparecer nele. A regra que ele guarda — _o cabeçalho é
moldura_ (D-29) — continua verdadeira, e agora ela força a arquitetura certa: a
casca posiciona a rail, e não sabe o que tem dentro.

**Composta pela página, e não por parallel route.** O pré-voo propôs um slot
`@rail`. A leitura da documentação local do Next 16.3.4 desfez a proposta:

> "During client-side navigation, Next.js will perform a partial render,
> changing the subpage within the slot, **while maintaining the other slot's
> active subpages, even if they don't match the current URL**."
> — `03-file-conventions/parallel-routes.md`

Ou seja: navegar da Home para `/arquivos` **manteria a rail da Home na tela**,
com a equipe do projeto ao lado de um estado vazio. Evitar isso exigiria uma
página `null` explícita para cada rota sem rail — oito arquivos que existem só
para desligar algo, e que a próxima rota esquece de criar. É a forma exata do
antipadrão que este repositório recusa em autorização ("um guard por página é um
guard que a próxima página esquece"), aplicada a layout.

Some-se a isso que o Next 16 tornou `default.js` **obrigatório** em todo slot,
sob pena de o build falhar (`upgrading/version-16.md`), e o custo fica claro.

A rail é contextual: ela **deve** trocar com a rota, e não persistir. Uma
primitiva de layout que a página compõe entrega exatamente isso, com zero risco
de roteamento e testável em jsdom.

### O modelo de scroll: documento, com âncoras sticky

**Não** três containers com `overflow`. O documento continua sendo o eixo de
scroll, e sidebar e rail são `sticky`.

| Região | Desktop (`lg`+) | Mobile |
| --- | --- | --- |
| Sidebar | `sticky top-0 h-dvh overflow-y-auto` — só rola se exceder | não renderiza |
| Workspace | fluxo normal, scroll do documento | idem |
| Rail | `sticky top-N max-h-[calc(100dvh-N)] overflow-y-auto` — só rola se exceder | vira bloco no fim do fluxo |

A documentação do Next explica por que esta forma é a robusta:

> "it identifies the relevant DOM node for navigation and inspects each
> top-level element. **All non-scrollable elements and those without rendered
> HTML are bypassed, this includes sticky or fixed positioned elements** […]
> until it identifies a scrollable element that is visible in the viewport."
> — `02-components/link.md`

Com sidebar e rail `sticky`, o Next as ignora e continua mirando o documento —
que é o comportamento que já funciona hoje. Restauração de scroll do navegador,
âncora `#id`, e o colapso da barra de URL no celular seguem nativos. O
deslocamento sob o cabeçalho sticky do mobile é resolvido por
`scroll-padding-top`, que é a receita da própria documentação.

Trocar o documento por três `overflow: hidden` teria custado tudo isso para
comprar rolagem independente que a fase não precisa.

### Motion: CSS, e só o workspace

Só o workspace transiciona. A casca não entra na animação — não por
configuração, mas porque **ela não está na subárvore animada**: a entrada é uma
classe CSS num wrapper com `key` derivado do segmento ativo.

`ViewTransition` do React foi verificado e **está disponível sem configuração
nenhuma** no Next 16.3.4 (`02-guides/view-transitions.md`). Foi recusado nesta
fase por quatro razões concretas:

1. Por padrão ele anima o snapshot do documento inteiro — exatamente "animar a
   casca entre rotas", que esta fase proíbe. Escapar disso exige nomear e
   suprimir a sidebar, mais machinery.
2. O overlay `::view-transition` captura eventos de ponteiro; recuperar
   interatividade exige `pointer-events: none` explícito.
3. O bloco global de `prefers-reduced-motion` **não alcança** os pseudo-elementos
   `::view-transition-*` — seriam regras novas e uma nova forma de esquecer.
4. Não existe em jsdom: a transição sairia da suíte de componente.

Fica registrado como o caminho natural para a F10/F11, quando houver transição de
elemento compartilhado (miniatura → detalhe do conteúdo) — que é justamente o
gatilho de revisão que a [ADR-0018](0018-sem-biblioteca-de-ui-e-de-motion.md)
escreveu.

`useLinkStatus` também existe (`04-functions/use-link-status.md`, desde 15.3.0) e
também não é usado: a documentação diz que o estado pendente é **pulado quando a
rota foi prefetchada**, e os links da sidebar ficam permanentemente em viewport,
logo permanentemente prefetchados. Um indicador que nunca acende é pior que
nenhum. O feedback de navegação vem do marcador de item ativo e do `loading.tsx`.

## Por que os testes source-based da FASE 8 mudam

Três asserções em `tests/unit/phase8-nav-availability.test.ts` leem o texto de
`portal-shell.tsx` e travam a implementação, não o comportamento:

| Asserção | O que acontece | Como fica |
| --- | --- | --- |
| contém `sections.length >= BOTTOM_NAV_THRESHOLD` | a decisão migra para `src/config/app.ts` (`showsBottomNav`) | passa a ler a função pura, que é onde a regra deve morar |
| contém `comBarra ? 'flex-1 pb-24 md:pb-0' : 'flex-1'` | a reserva de altura muda de forma com o grid | asserção sobre a regra: sem barra, sem reserva |
| não contém `cycle` / `Ciclo {` | **mantida sem mudança** | é ela que força a rail opaca |

A regra que os três guardam continua valendo palavra por palavra: _a navegação
segue a feature; a barra inferior só existe com o que oferecer; o cabeçalho é
moldura._ O que muda é o endereço da regra. Nenhum caso é deletado, nenhum é
afrouxado, e a terceira — a mais importante — fica exatamente como estava.

## Consequências

- A casca permanece **Server Component**. Só duas folhas são cliente:
  `SidebarNav` e `Workspace`, ambas por um hook de rota. `children` continua
  renderizado no servidor e atravessa como prop.
- O rodapé do portal deixa de existir; "Boop OS" e o nome do cliente vivem na
  base da sidebar.
- Uma seção nova entra sem tocar na casca: uma linha em `PORTAL_SECTIONS`.
- A rail vira a fundação geométrica do detalhe de conteúdo da FASE 10 —
  conteúdo à esquerda, linha do tempo à direita é a mesma primitiva, com outro
  filho.
- Nenhuma dependência nova. Nenhuma mudança de banco, domínio, workflow, policy
  ou migration.

## Alternativas descartadas

| Alternativa | Por que não |
| --- | --- |
| Manter o cabeçalho e só alargar o container | Não resolve nenhuma das sete causas. O portal continua sem nada persistente |
| Sidebar a partir de `md` (768px) | 768 − 216 − gutters deixaria ~470px de workspace. Inaceitável |
| Rail por parallel route `@rail` | Rail obsoleta persiste em soft navigation; `default.js` obrigatório; oito páginas `null` que a próxima rota esquece |
| Três containers com `overflow` | Compra rolagem independente que a fase não precisa, ao custo de restauração de scroll, âncora e barra de URL do celular |
| `ViewTransition` do React agora | Anima a casca inteira por padrão; overlay captura ponteiro; reduced motion não alcança; invisível em jsdom |
| Biblioteca de motion (Motion for React) | Nenhum dos três gatilhos da ADR-0018 disparou nesta fase |
| Drawer mobile agora | A FASE 9 liga a barra inferior sozinha ao cruzar o limiar de três seções |

## Relacionadas

- [ADR-0018](0018-sem-biblioteca-de-ui-e-de-motion.md) — sem biblioteca de UI e de motion
- [ADR-0028](0028-kanban-e-drag-and-drop.md) — a fundação visual do quadro
- D-25 (navegação segue a feature) · D-29 (o cabeçalho é moldura) · D-30 (o log não alcança o cliente)
