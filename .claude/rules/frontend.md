# Regras — Frontend

Raciocínio em [`docs/architecture.md`](../../docs/architecture.md) e
[`docs/product.md`](../../docs/product.md).

## Estrutura

- Server Component é o padrão. `'use client'` só em folha que precisa de estado ou
  evento, com o menor escopo possível.
- **Nenhuma regra de negócio dentro de componente React.** Componente renderiza;
  workflow decide.
- Componente não fala com o banco. Server Component chama repository; interação
  chama Server Action, que chama workflow.
- `src/components/ui` = primitivos. `src/components/layout` = cascas (Shell,
  Container). `src/components/patterns` = composições sem domínio. UI de domínio
  mora em `src/domains/<dominio>/components`.
- Sem pasta `utils/` genérica.

## Design

Premium, editorial, minimalista. Muito espaço, boa tipografia, hierarquia forte.

**Não:** dashboard SaaS genérico, cards em excesso, gradiente aleatório,
glassmorphism, menu grande, ícone decorativo, gamificação.

- Escala tipográfica, cor e espaçamento vêm de tokens (`src/app/globals.css`).
  **Nenhum hexadecimal em componente** — use `bg-surface`, `text-muted`,
  `border-border`. Trocar a identidade na FASE 1.5 não pode exigir tocar em
  primitivo.
- Bloco vazio **desaparece**. Não vira card com "nenhum item".
- O portal tem sete itens de navegação. Acrescentar um exige justificativa escrita.

## Mobile first

Tudo que é client-facing é desenhado primeiro no celular: dashboard, onboarding,
conteúdo, feedback, aprovação, resultados.

- **Nunca** tabela com scroll horizontal no celular. Use lista ou card.
- Alvo de toque mínimo de 44px. Ação primária ao alcance do polegar.
- Aprovar conteúdo tem que ser possível com uma mão.

## Estados

Toda tela que carrega dado implementa os quatro: **loading**, **vazio**, **erro**,
**sucesso**. Faltar um é PR incompleto.

## Acessibilidade

- HTML semântico: `main`, `nav`, `section`, `h1..h3` em ordem.
- Todo campo com `label` associada. Erro ligado ao campo por `aria-describedby`.
- Navegação por teclado funcional; `:focus-visible` sempre visível.
- Contraste mínimo AA (4.5:1 em texto).
- Ícone sem texto precisa de `aria-label`.

## Formulários

- Estado no servidor via Server Action; `useFormStatus`/`useActionState` para o
  pendente.
- Validação com o **mesmo schema zod** do workflow.
- Erro de domínio chega como `code` e é traduzido para pt-BR na UI.
- Onboarding salva sozinho a cada alteração, com debounce. Sair e voltar nunca
  perde resposta.

## Texto

- Interface em **pt-BR**. Código e identificadores em inglês.
- Sem jargão técnico para o cliente: "Aguardando sua aprovação", não
  "status: awaiting_client".
- Data e hora em `America/Sao_Paulo`, por extenso quando couber: "04 de setembro,
  14:00".
