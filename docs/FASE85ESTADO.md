# Estado ao fim da FASE 8.5

**Base:** `0685cba` (fim da FASE 8) · **Banco:** intocado · **Testes:** 1259 em
67 arquivos (793 unit/component + 466 RLS) · **Build:** 24 rotas.

A FASE 8 resolveu funcionalidade e segurança. Esta fase resolveu **sensação de
produto**, sem tocar domínio, workflow, policy, migration ou dependência.

---

## O que mudou

### A casca virou ambiente, em `lg` e acima

Sidebar persistente (17rem, `sticky`, quatro zonas: marca, cliente com seletor,
seções, conta) + workspace. O cabeçalho de largura total e o rodapé de colofão
morrem ali — duas molduras para a mesma informação é ruído.

**Abaixo de `lg` nada mudou.** `hidden lg:block` na sidebar, `lg:hidden` no
cabeçalho: o celular renderiza a árvore da FASE 8. A garantia mais cara da fase
anterior — a resposta de atenção acima da dobra em 375 × 667 — é preservada por
construção, e foi confirmada em Chromium.

Não há drawer mobile de propósito: a FASE 9 leva as seções a três, cruza o
`BOTTOM_NAV_THRESHOLD` e acende sozinha a barra inferior que já existe e já é
testada. Um drawer agora seria construído para descartar.

### A rail contextual, em `xl` e acima

Composta pela **página**, não pela casca. Some inteira quando não há conteúdo
real: sem grid, sem `aside`, sem buraco. Abaixo de `xl` o mesmo conteúdo desce
para o fim do fluxo — nunca é escondido.

Conteúdo hoje: **no ar desde** (`projects.starts_on`) e **quem está no projeto**
(`client_memberships` × `profiles`). Os dois reais. Ciclo e etapa ficaram de
fora porque já estão na coluna principal das duas páginas.

**"Quem está no projeto" migrou** de `/projeto`. Migrou, não duplicou.

### Motion em CSS, e só o workspace

`--motion-page` (220ms) e `boop-workspace` (opacidade + 8px) num wrapper com
`key` derivado do caminho. A casca não anima **porque não está na subárvore
animada** — é irmã do nó, não filha. Não é uma regra que alguém possa esquecer.

### A espera ganhou a forma da página

O `loading.tsx` era um spinner centralizado em `min-h-[50vh]`: o conteúdo sumia,
a altura mudava, o scroll pulava. Agora desenha as três faixas que toda rota do
portal tem, nas proporções reais. A casca fica de pé e interativa.

### O quadro nasceu sem domínio

`BoardViewport`, `BoardColumn`, `BoardCard`. Geometria: rolagem horizontal, snap
no celular, faixa focável, coluna vazia preservada com o zero, laje em vez de
card. Não conhecem status, canal, formato, aprovação, versão, item, projeto nem
tenant — e há varredura de código-fonte que falha se conhecerem. **Não alcançam
rota nenhuma** e não têm fixture fora do teste que as exercita.

---

## O que a verificação do Next mudou no plano

O pré-voo tinha três hipóteses. Ler `node_modules/next/dist/docs/` derrubou duas
e confirmou uma — e as três estão registradas na ADR-0027.

| Hipótese do pré-voo                     | O que a documentação disse                                                                                                                                      | Decisão                                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rail como parallel route `@rail`        | Soft navigation **mantém a subpágina ativa de um slot** que a rota nova não corresponde; e o Next 16 tornou `default.js` obrigatório sob pena de build quebrado | **Derrubada.** A rail da Home seguiria o leitor para uma seção vazia. Composta pela página                                                                         |
| Três containers com `overflow`          | O Next **pula elementos sticky e fixed** ao procurar o alvo de scroll                                                                                           | **Derrubada.** Documento como eixo, sidebar e rail `sticky`, `scroll-padding-top` no `html`                                                                        |
| `ViewTransition` talvez precise de flag | Funciona **sem configuração nenhuma**                                                                                                                           | **Confirmada e recusada:** anima o documento inteiro por padrão, o overlay captura ponteiro, reduced motion não alcança os pseudo-elementos, e não existe em jsdom |

`useLinkStatus` também existe, e também não foi usado: o pendente é pulado
quando a rota foi prefetchada, e os links da sidebar ficam permanentemente em
viewport. Um indicador que nunca acende é pior que nenhum.

---

## Defeitos que só um navegador achou

O jsdom não mede layout. Renderizar os componentes reais contra o CSS do build e
medir em Chromium achou três coisas:

1. **"SOCIAL M…"** — `max-w-[14ch]` truncava o nome do projeto na sidebar, onde
   sobravam 224px. `t-meta` é caixa alta com 0.16em de tracking, e 14ch ali não
   chega perto de doze letras. O teto saiu; quem limita é o contêiner.
2. **Dois landmarks para uma coluna** — a sidebar era `<aside>`, criando um
   "complementar" sem nome ao lado do nomeado da rail. Virou `div`; a `<nav>` de
   dentro já era o landmark.
3. **Sidebar sem rolagem própria** — uma coluna mais alta que a viewport
   cortaria a conta no rodapé sem caminho até ela.

E um falso positivo que quase virou bug report: **o Chromium headless força
largura mínima de 500px**, então um screenshot pedido em 375 renderiza em 500 e
recorta. O "overflow" era a medição, não a página. Medido por iframe,
`scrollWidth === clientWidth` em 320, 375, 768 e 1024.

---

## Testes

`phase8-nav-availability` tinha dois casos lendo strings literais do
`portal-shell.tsx`. Eles travavam a implementação, não o comportamento: a
reescrita os quebraria mesmo com a regra intacta. A decisão virou
`showsBottomNav()` em `src/config/app.ts`, testável como função pura, e os dois
casos foram reescritos com a justificativa no arquivo.

**O terceiro caso não mudou** — o que proíbe a palavra `cycle` no shell. É ele
que força a rail a ser um slot opaco: uma casca que recebesse `cycle` por prop
voltaria a falhar ali.

Três arquivos novos: a casca (22 casos), o quadro (15) e as fronteiras de
código-fonte (47) — incluindo um que falha se `motion`, `framer-motion` ou
`@dnd-kit/core` aparecerem em `package.json`.

---

## Débito assumido

- **QA visual hospedado.** O plano B sem Docker não sobe PostgREST nem auth,
  então o portal não foi navegado logado neste ambiente. O que foi verificado
  foram os componentes reais com o CSS real, em Chromium, nas larguras da lista.
  Falta a leitura humana de uma sessão de verdade.
- **A faixa 1024–1279 não tem rail.** O conteúdo dela desce para o fim do
  workspace, que é honesto, mas é a largura menos exercitada da fase.
- **`prefers-reduced-motion` verificado por CSS, não por navegador.** O bloco
  global cobre `boop-workspace` e `skeleton-pulse` por construção (`*` com
  `!important`), e há teste que lê o CSS; ninguém ligou a preferência no SO.
- **O esqueleto é genérico.** Uma rota com geometria muito diferente da Home
  ainda verá as três faixas padrão. Vale reavaliar quando Estratégia existir.

## O que a FASE 9 recebe pronto

- Ligar Estratégia é `available: false → true`. A sidebar ganha o item, e o
  celular ganha a barra inferior, sem tocar em layout.
- A rail existe: a página de Estratégia compõe a dela com status da versão, quem
  escreveu e quando — e some se não houver nada.
- A geometria de duas colunas é a mesma do detalhe de conteúdo da FASE 10:
  conteúdo à esquerda, linha do tempo à direita é esta primitiva com outro filho.
- O quadro está desenhado e sem domínio, esperando `content_items`.

**Zero efeito no banco.** Fingerprint idêntico nas nove partes; `supabase/` sem
uma linha de diferença.
