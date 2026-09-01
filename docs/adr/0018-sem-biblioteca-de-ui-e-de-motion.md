# ADR-0018 — Sem biblioteca de UI e sem biblioteca de motion

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 1.5

## Contexto

A FASE 1.5 construiu onze telas com diálogo modal, painel deslizante no
celular, navegação com estado ativo, entradas animadas, aprovação com momento
de marca e formulários acessíveis. É exatamente o escopo em que se instala
Radix ou shadcn/ui por reflexo, e Framer Motion junto.

Mas a direção da fase é explícita: nada de componente shadcn visualmente
reconhecível, e nada de dependência por hábito. E a marca da interface precisa
ser da Boop.

## Decisão

**Nenhuma biblioteca de componentes e nenhuma biblioteca de motion.** A única
dependência acrescentada na fase foi `tailwind-merge`.

| Necessidade                                 | Solução adotada                              | Alternativa recusada |
| ------------------------------------------- | -------------------------------------------- | -------------------- |
| Modal com foco preso, `Esc`, fundo inerte   | `<dialog>` nativo + `showModal()`            | Radix Dialog         |
| Painel inferior no celular                  | O mesmo `<dialog>`, ancorado embaixo         | Vaul, Radix Drawer   |
| Entradas animadas, cascata, piscada, deriva | `@keyframes` + `animation-delay`             | Framer Motion        |
| Ícones                                      | Setas tipográficas, filetes, pontos          | lucide, heroicons    |
| Acessibilidade de formulário                | `<label for>` + `aria-describedby` + `useId` | Radix Form           |
| Conflito de classes utilitárias             | `tailwind-merge`                             | —                    |

## Alternativas consideradas

| Alternativa                          | Por que não                                                                                                                                                                               |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radix como infraestrutura sem estilo | Resolve bem um problema que o `<dialog>` já resolve. Foco preso, `Esc`, `::backdrop` e inércia do fundo são nativos há anos                                                               |
| shadcn/ui copiado seletivamente      | Traz Radix junto e uma estética reconhecível que é exatamente o que a fase proíbe                                                                                                         |
| Framer Motion                        | O sistema de motion inteiro são quatro durações, três easings e quatro `@keyframes`. Não houve orquestração que justificasse ~40KB e um modelo de animação em JS                          |
| Uma biblioteca de ícones             | Nenhuma tela precisou de ícone. A linguagem é tipográfica                                                                                                                                 |
| Escrever o `cn` sem `tailwind-merge` | Foi o que a FASE 1 fez, com o gatilho documentado. O gatilho disparou: um componente de marca com `h-auto` próprio ignorava o `h-6` do chamador e a logo estourava o cabeçalho no celular |

## Consequências

- A superfície de dependência do produto continua em sete pacotes de runtime.
  Nada do sistema visual depende da API de terceiros.
- `<dialog>` exige `showModal()` imperativo e uma `ref` — menos idiomático em
  React que um componente controlado. É a troca aceita.
- `<dialog>` não é implementado no jsdom, então o conteúdo do modal não é
  testável em teste de componente. Coberto por QA visual; se virar um problema
  recorrente, o teste sobe para Playwright na FASE 20.
- Animação em CSS não encadeia nem interrompe: uma sequência complexa exigiria
  `animation-delay` manual, que não escala. Hoje a sequência mais longa tem
  cinco passos.

## Gatilho de revisão

- **Componentes:** combobox com filtro, menu com submenu, tooltip posicionada
  ou tabela virtualizada — coisas em que o custo de acertar acessibilidade
  supera o de uma dependência.
- **Motion:** transição compartilhada entre rotas, animação interrompível ou
  gesto de arrastar. Aí entra uma biblioteca, por ADR, com o caso concreto
  escrito.
