# Regras — Frontend

Raciocínio em [`docs/design-direction.md`](../../docs/design-direction.md),
[`docs/design-system.md`](../../docs/design-system.md),
[`docs/motion.md`](../../docs/motion.md) e
[`docs/architecture.md`](../../docs/architecture.md).

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
  **Nenhum hexadecimal em componente** — use `bg-background`, `text-muted`,
  `border-rule`, `.t-section`.
- **Ação primária é azul com texto navy.** Off-white sobre `#00C2FF` dá 2.03:1 e
  reprova; o azul também não serve como texto em fundo claro. Há teste.
- Laje, não card: sem sombra, sem borda em volta de tudo, raio de 0 a 4px.
- Status é ponto + rótulo em pt-BR, nunca pill, e a cor nunca é o único
  portador do significado.
- Sem biblioteca de ícones: seta é `→`. Sem Radix, sem shadcn, sem Framer
  Motion ([ADR-0018](../../docs/adr/0018-sem-biblioteca-de-ui-e-de-motion.md)).
- `max-w-[Nch]` vai no elemento que tem o font-size, nunca no wrapper.
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

Estado vazio nunca diz "nenhum dado": diz o que está acontecendo e o que vem a
seguir, na voz da Boop.

## Motion

- Navegação cotidiana é instantânea. `fade-rise` só em abertura editorial.
- **Nunca** atrasar um controle que o usuário já quer clicar.
- Toda animação respeita `prefers-reduced-motion`, e nenhuma informação depende
  de movimento. Ver [`docs/motion.md`](../../docs/motion.md).

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
