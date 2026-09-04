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
- **Bloco sem ORIGEM não aparece.** Se o dado não tem tabela, coluna ou template
  que o afirme, o bloco não existe — não vira placeholder, exemplo nem estado
  vazio bonito. Precedentes: `project.scope` (D-16) e os quatro blocos mockados
  da Home (FASE 8).
- **Calma nunca é dita sem verificação completa.** Um bloco só pode afirmar que
  não há nada pendente quando TUDO que responderia foi consultado com sucesso.
  Leitura que falhou produz estado próprio, neutro e honesto — nunca "tudo
  certo" ([ADR-0026](../../docs/adr/0026-calma-exige-verificacao-completa.md)).
- O portal tem no máximo sete itens de navegação, e acrescentar um oitavo exige
  justificativa escrita. **A navegação segue a FEATURE, nunca a contagem de
  linhas** (D-25): a seção aparece quando a funcionalidade existe, e continua
  aparecendo para um cliente com zero dados.

## A casca (ADR-0027)

- **A casca é MOLDURA.** `PortalShell` e `PortalSidebar` não recebem ciclo,
  etapa, equipe, atenção nem jornada — há varredura de código-fonte que quebra.
- **A rail contextual é composta pela PÁGINA**, nunca pela casca, e nunca por
  parallel route: em soft navigation o Next mantém a subpágina ativa de um slot
  que a rota nova não corresponde, e a rail de uma seção seguiria para a outra.
- **Rail sem conteúdo real não renderiza.** Quem decide é a página
  (`team.length > 0 ? <...> : null`); `WorkspaceColumns` devolve os filhos sem
  grid e sem `aside`. Um componente que decide por dentro deixa a coluna vazia.
- **A casca fica no servidor.** As únicas folhas cliente são `Workspace`,
  `PortalNav` e `PortalBottomNav`, todas por hook de rota.
- **Só o workspace anima entre rotas.** A casca não está na subárvore animada.
- **Scroll é do documento.** Sidebar e rail são `sticky`; `overflow` só quando
  excedem. Nada de `overflow: hidden` na casca.
- **Abaixo de `lg` o portal é a FASE 8.** Nenhum chrome novo no celular, e
  nenhum drawer: a FASE 9 acende a barra inferior ao cruzar três seções.

## Quadro (ADR-0028)

- As primitivas (`BoardViewport`, `BoardColumn`, `BoardCard`) **não conhecem
  domínio**: sem status, canal, formato, aprovação, versão, item, projeto ou
  tenant. Há varredura.
- Elas **não alcançam rota nenhuma** até a FASE 10, e não têm fixture fora do
  teste que as exercita.
- **Coluna vazia fica**, com o zero. Coluna é eixo, não bloco.
- **O quadro client-facing é somente-leitura.** Nada de drag-and-drop no portal.

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
