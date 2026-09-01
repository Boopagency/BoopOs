# Revisão da especificação — Boop OS V0

Leitura crítica do Master Prompt V0. Registra o que está inconsistente, o que é
arriscado e o que ainda precisa ser decidido por uma pessoa. É o documento de
saída da FASE 0 e deve ser revisado ao final de cada fase.

Legenda de severidade: **[A]** bloqueia implementação · **[B]** decide arquitetura
mas não bloqueia · **[C]** ajuste de escopo ou nomenclatura.

---

## 1. Inconsistências encontradas

### I-01 [A] `project_stages` mistura dois eixos ortogonais

A §14 lista como etapas: `closed, onboarding, immersion, research, strategy,
production, publishing, review, ongoing, paused, completed`.

`paused` e `completed` não são etapas da jornada — são **status do projeto**. Um
projeto pausado está pausado _em alguma etapa_; se `paused` for uma etapa, a
informação de onde ele parou se perde. `ongoing` também não é etapa: descreve um
contrato em regime contínuo. E `closed` significa "negócio fechado" (início), o
que colide com a leitura natural de "encerrado" (fim).

**Resolução adotada:** dois eixos separados.

- `projects.status`: `draft | active | paused | completed | archived`.
- Etapas da jornada: linhas em `project_stages`, cada uma com
  `state: pending | current | done | skipped`.
- A etapa `closed` foi renomeada para `kickoff`; `ongoing` deixa de ser etapa e
  passa a ser representado por um projeto `active` cuja última etapa é `review`
  em ciclo (ver I-02).

### I-02 [B] A jornada é cíclica, mas foi descrita como linear

A §3 termina em "review mensal → aprendizados → **próximo ciclo**". Uma lista
linear de etapas não representa isso: ao entrar no segundo mês, o projeto volta
para `production`.

**Resolução adotada:** `project_stages` guarda o **ciclo atual**. Ao publicar um
Monthly Review, o workflow `startNextCycle()` incrementa `projects.cycle` e
reabre as etapas recorrentes (`production → publishing → review`). As etapas de
fundação (`kickoff, onboarding, immersion, research, strategy`) permanecem `done`
e continuam visíveis no histórico. O cliente vê a jornada do ciclo corrente com
um marcador de "ciclo 3".

### I-03 [A] Conteúdo: campos de versão foram colocados no item

A §20 coloca `hook`, `caption` e `CTA` em `content_item`. A §13 exige que nada
aprovado seja sobrescrito. Se a legenda vive no item, alterá-la depois da
aprovação **destrói a versão aprovada** — exatamente o que a §13 proíbe.

**Resolução adotada:**

- `content_items` = identidade e planejamento: `title`, `channel`, `format`,
  `editorial_territory`, `objective`, `scheduled_for`, `status`.
- `content_versions` = entregável: `hook`, `caption`, `cta`, arquivos, `version`.
  A aprovação aponta para a versão, nunca para o item.

### I-04 [A] `content_items.status` e `content_versions.status` podem divergir

A §20 define dez estados no item; a §13 exige aprovação por versão. Sem regra,
um item fica `approved` enquanto a equipe já produziu uma v2 em rascunho.

**Resolução adotada:** os dois existem, com papéis distintos e um único escritor.

- `content_versions.status` é o **fato**: `draft | awaiting_client |
changes_requested | approved | superseded`.
- `content_items.status` é a **posição no pipeline** e é _derivado_ da versão
  corrente pelos workflows — nunca escrito por UI, nunca por RLS direta.
- Criar uma v2 força o item a voltar para `in_production` e marca a v1 como
  `superseded`. A aprovação da v1 permanece registrada e visível no histórico.
  Diagrama de transições em [`docs/architecture.md`](architecture.md#máquinas-de-estado).

### I-05 [A] Onboarding com pergunta do tipo `file` chega antes de Arquivos

A §18 inclui `file` entre os tipos de pergunta (FASE 7); a §44 coloca Arquivos na
FASE 12. O onboarding não teria como aceitar arquivo quando for construído.

**Resolução adotada:** `file` permanece no enum desde a primeira migration, mas o
renderizador e a validação do tipo `file` só entram na FASE 12. Templates de
onboarding da V0 não usam perguntas do tipo `file`. O marco da §45 não depende
disso.

### I-06 [A] O primeiro marco exige e-mail, que só aparece na FASE 16

A §45 começa em "convidar as duas clientes → **elas recebem e-mail** → entram via
Magic Link". Isso acontece na FASE 5. Mas Resend está na FASE 16.

**Resolução adotada:** o `EmailService` nasce na FASE 5 com dois templates
(`invite`, `welcome`) e o SMTP customizado do Supabase apontando para o Resend. A
FASE 16 deixa de ser "integrar Resend" e passa a ser "completar o catálogo de
templates e a fila de reenvio". Ver [ADR-0010](adr/0010-email-auth-vs-produto.md).

### I-07 [B] Navegação singular vs. cliente com múltiplos projetos

A §16 define o item "Projeto" no singular, mas a §8 exige "mais de um projeto por
cliente".

**Resolução adotada:** as rotas do portal são escopadas por projeto
(`/portal/[projectId]/...`). Quando o usuário tem acesso a exatamente um projeto,
`/portal` redireciona direto para ele e nenhum seletor aparece — a complexidade
fica invisível. Com dois ou mais, surge um seletor discreto no cabeçalho. A
navegação de sete itens não muda.

### I-08 [C] "Papel" ora é global, ora parece por cliente

A §9 descreve `boop_admin | boop_member | client_user` como papéis do sistema,
mas diz que `boop_member` atua em "clientes permitidos" — o que sugere papel por
vínculo.

**Resolução adotada:** o papel é **global** (`profiles.role`); o vínculo
(`client_memberships`) concede **escopo**, não papel. `boop_admin` enxerga tudo
sem precisar de vínculo. `boop_member` e `client_user` só enxergam clientes onde
têm vínculo. Um campo `membership_role` pode ser acrescentado depois sem migração
destrutiva. Ver [ADR-0005](adr/0005-papel-global-e-vinculo-por-cliente.md).

### I-09 [C] A §12 pede tabelas que nenhuma fase do roadmap constrói

`research_items` e `research_collections` aparecem no modelo, mas a §44 não tem
fase de Pesquisa. `meeting_notes` idem.

**Resolução adotada:** ficam fora da V0. Na V0 a pesquisa é **etapa da jornada** e
seu resultado é entregue dentro do documento de Estratégia (seções "Contexto", "O
que entendemos", "Público"). Ver §3 deste documento.

### I-10 [C] "V0" designa duas coisas diferentes no texto

Às vezes significa "as 20 fases do roadmap" (§44), às vezes "o primeiro produto
utilizável" (§45).

**Resolução adotada — vocabulário fixo do projeto:**

- **Marco 1 (M1):** FASES 0–11 + e-mail mínimo. É o fluxo da §45 ponta a ponta.
- **V0:** FASES 0–20, terminando em produção com hardening.
  Todo documento deste repositório usa esses dois termos, nunca "V1" para se referir
  ao marco 1.

### I-11 [C] "Aprovar estratégia" vs. "solicitar ajuste" sem tabela de comentário

A §19 dá ao cliente só duas ações; a §12 lista `strategy_comments`. Uma tabela
inteira para armazenar o texto de "solicitar ajuste" é desproporcional.

**Resolução adotada:** o texto vive em `strategy_approvals.note`. `strategy_comments`
fica fora da V0. Comentário livre existe só em conteúdo (§21), onde é a
funcionalidade central.

---

## 2. Riscos

### R-01 [A] Server Actions são endpoints públicos

Toda Server Action do Next.js vira uma rota HTTP invocável por qualquer pessoa
com o ID da action. Ser um Client Component "só renderizado para admin" não
protege nada. Uma action sem checagem é uma porta aberta.

**Mitigação:** nenhuma Server Action contém lógica. Toda action delega para um
workflow criado por `defineWorkflow()`, que sempre executa, nesta ordem: validar
input (zod `.strict()`) → autenticar → autorizar → executar → registrar activity
log → side-effects. Um teste percorre o diretório e falha se existir uma Server
Action que não passe por `defineWorkflow`.

### R-02 [A] Política de UPDATE sem `WITH CHECK` permite trocar de tenant

Erro clássico de RLS: uma policy de UPDATE com apenas `USING` autoriza a leitura
da linha, mas não restringe o valor final. O usuário atualiza a própria linha
mudando `client_id` para o de outro cliente — e o registro migra de tenant.

**Mitigação:** toda policy de UPDATE declara `USING` **e** `WITH CHECK`; além
disso, um trigger `enforce_immutable_tenant()` rejeita qualquer alteração de
`client_id`/`project_id` em todas as tabelas de domínio. Há teste dedicado.

### R-03 [A] Recursão infinita nas policies de RLS

`clients` consulta `client_memberships`, que consulta `clients` → o Postgres
aborta com recursão. `profiles` que consulta `profiles` para descobrir o papel,
idem.

**Mitigação:** todo predicado de policy passa por funções `SECURITY DEFINER`
(`app.is_boop_admin()`, `app.has_client_access(uuid)`, …) que ignoram RLS por
definição e por isso não reentram. Ficam no schema `app`, que **não** é exposto
via PostgREST. Ver [ADR-0004](adr/0004-rls-com-funcoes-security-definer.md).

### R-04 [A] Vazamento da `service_role`

A chave ignora toda a RLS. Um `NEXT_PUBLIC_` por engano, ou um import de
`lib/supabase/admin` dentro de um Client Component, expõe o banco inteiro.

**Mitigação:** `admin.ts` começa com `import 'server-only'` (o build quebra se for
importado no cliente); a variável nunca tem prefixo público; teste de lint que
falha se `SUPABASE_SERVICE_ROLE_KEY` aparecer fora de `lib/supabase/admin.ts`;
secret scanning ligado no GitHub.

### R-05 [A] Conteúdo interno vazando para o cliente

`idea`, `planned`, `in_production`, `internal_review` e comentários internos não
podem chegar ao cliente. Um `select *` descuidado no portal expõe o backlog.

**Mitigação:** a RLS de `client_user` filtra por status (só vê a partir de
`awaiting_client`) e por `content_comments.is_internal = false`; o repositório do
portal usa projeções explícitas de colunas, nunca `select *`; teste que tenta ler
um item `in_production` como cliente e espera zero linhas.

### R-06 [B] Signed URL vazada dá acesso ao arquivo sem sessão

Uma URL assinada é um bearer token na barra de endereço: quem a receber (por
print, log de proxy, histórico de compartilhamento) baixa o arquivo.

**Mitigação:** TTL curto (60 s para preview, 300 s para download); a URL é gerada
sob demanda por Route Handler, nunca embutida em HTML cacheável; nunca é logada;
o `files` guarda a metadata e a autorização acontece _antes_ da assinatura,
consultando o banco — nunca inferida do path.

### R-07 [B] Upload de SVG/HTML em bucket servido inline = XSS

Um SVG contendo `<script>` executado na origem da aplicação rouba sessão.

**Mitigação:** whitelist de MIME (`image/png`, `image/jpeg`, `image/webp`,
`video/mp4`, `application/pdf`); SVG **bloqueado** na V0; validação de MIME real
no servidor _depois_ do upload (o cliente mente antes); `Content-Disposition:
attachment` para tudo que não seja imagem/vídeo de preview; nomes de arquivo
sanitizados e nunca reutilizados como path (o path é derivado de UUID).

### R-08 [B] Autorização em `middleware.ts` não é confiável sozinha

Já houve classe de bypass de middleware no Next.js (CVE-2025-29927). Middleware é
roteamento e refresh de sessão, não é fronteira de segurança.

**Mitigação:** o middleware só renova o cookie de sessão e redireciona não
autenticados. **Toda** decisão de autorização é refeita no Server Component /
workflow que efetivamente lê ou escreve o dado, e a RLS confere de novo no banco.

### R-09 [B] Dupla submissão de aprovação

O cliente clica duas vezes em "Aprovar" no celular; dois registros de aprovação,
dois e-mails, activity log duplicado.

**Mitigação:** índice único parcial `(content_version_id) WHERE decision =
'approved'`; a escrita acontece dentro de uma função SQL que checa o estado atual
antes de gravar; a segunda chamada devolve sucesso idempotente, não erro. Ver
[ADR-0011](adr/0011-workflows-transacionais-em-sql.md).

### R-10 [B] Efeito colateral falha depois do commit

A aprovação grava, o e-mail para a equipe falha. Sem registro, ninguém descobre.

**Mitigação:** side-effects nunca participam da transação de domínio e nunca
derrubam o workflow. Cada envio grava uma linha em `notifications` com `status`
(`pending | sent | failed`) e `error`; o admin lista falhas e reenvia. Fila com
retry automático só na FASE 18, se o volume justificar.

### R-11 [B] Revogação de acesso não é instantânea no caminho RLS

O JWT do Supabase vive ~1 h. Se um vínculo for removido, uma policy que dependesse
de claims do token continuaria autorizando até a expiração.

**Mitigação:** nenhuma policy lê papel/vínculo do JWT. As funções `SECURITY
DEFINER` consultam `profiles` e `client_memberships` **a cada avaliação**, então a
revogação vale no próximo request. É o motivo principal de não usar
`custom_access_token_hook` na V0.

### R-12 [C] Magic Link: reencaminhamento e pré-visualização de link

O link é credencial. Encaminhar o e-mail entrega a conta. Além disso, scanners de
segurança corporativos "clicam" links e queimam o token antes do usuário.

**Mitigação:** expiração curta (15 min), uso único, fluxo PKCE com troca do code
no servidor; texto do e-mail avisando que o link é pessoal; OTP de 6 dígitos como
alternativa se algum cliente corporativo tiver esse problema (decisão D-06).

### R-13 [C] Ausência de rate limiting próprio

A §10 pede "considerar rate limiting"; a §43 proíbe Redis sem necessidade.

**Mitigação na V0:** dependemos dos limites nativos do Supabase Auth (o vetor
realmente exposto é o disparo de magic link) e do Vercel na borda. Comentários e
aprovações exigem sessão válida e vínculo, o que limita o abuso a usuários já
autenticados. Gatilho para revisar: qualquer endpoint público não autenticado
além do login, ou incidente de abuso. Documentado como lacuna consciente.

### R-14 [C] PII em log estruturado

Respostas de onboarding e legendas podem conter informação sensível de negócio.

**Mitigação:** o logger tem allowlist de campos; `metadata` do activity log guarda
identificadores e transições de estado, nunca o conteúdo em si; nunca logar
`Authorization`, cookie, token, signed URL ou corpo de e-mail.

### R-15 [C] Deriva entre os enums do Postgres e as unions do TypeScript

Duas fontes descrevendo a mesma taxonomia acabam divergindo.

**Mitigação:** teste que lê `pg_enum` do banco local e compara com as constantes
de `src/config/enums.ts`; falha o CI na divergência.

---

## 3. Decisões que ainda precisam de uma pessoa

Nenhuma bloqueia a FASE 1. Cada uma tem um **default assumido** que será seguido
se ninguém decidir o contrário até a fase indicada.

| #    | Decisão                                                                                               | Default assumido                                                                   | Precisa até |
| ---- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------- |
| D-01 | Domínio e subdomínio da aplicação (`os.boop…`? `app.boop…`?) e domínio remetente verificado no Resend | `os.<dominio-da-boop>`, remetente `os@`                                            | FASE 5      |
| D-02 | Um cliente pode ter usuários com níveis diferentes (ex.: aprovador vs. leitor)?                       | Não na V0 — todo `client_user` do cliente aprova                                   | FASE 11     |
| D-03 | Quem aprova conteúdo quando há dois contatos: qualquer um ou ambos?                                   | Qualquer um; registra-se quem aprovou                                              | FASE 11     |
| D-04 | Conteúdo aprovado pode ser reaberto pela Boop após aprovação?                                         | Sim, criando v2; a aprovação da v1 fica no histórico                               | FASE 10     |
| D-05 | O cliente pode ver o activity log dele na V0?                                                         | Não. A coluna `visibility` já nasce pronta para ligar depois                       | FASE 8      |
| D-06 | Magic Link apenas, ou também OTP de 6 dígitos?                                                        | Apenas Magic Link                                                                  | FASE 3      |
| D-07 | Retenção de arquivos e política de exclusão (quem apaga, quando)                                      | Sem exclusão automática; exclusão lógica por `boop_admin`                          | FASE 12     |
| D-08 | O `boop_member` enxerga todos os clientes ou só os que tem vínculo?                                   | Só os com vínculo (princípio do menor privilégio)                                  | FASE 4      |
| D-09 | Idioma da interface                                                                                   | pt-BR único, sem i18n                                                              | FASE 1      |
| D-10 | Tipografia e paleta definitivas (§34)                                                                 | Sistema de tokens neutro, decidido junto com a marca                               | FASE 8      |
| D-11 | LGPD: base legal, política de privacidade e prazo de retenção                                         | Fora da V0; registrar dívida antes de produção                                     | FASE 20     |
| D-12 | Métricas obrigatórias por canal em Resultados (§26)                                                   | Alcance, seguidores, visualizações, compartilhamentos, salvamentos + `extra` livre | FASE 14     |

---

## 4. Overengineering a evitar

O que a especificação sugere, ou o que seria tentador construir, e que **não**
deve ser feito na V0:

| Tentação                                         | Por que não                                                                | O que fazer                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------- |
| Construtor visual de jornadas                    | Uma consultoria com poucos clientes muda jornada em código, não em UI      | Templates tipados em `src/config/journeys`        |
| Construtor visual de formulários de onboarding   | Idem: o ganho não paga a complexidade                                      | Templates via seed/migration; UI de edição depois |
| Motor genérico de RBAC (CASL, policies em banco) | Três papéis não justificam engine                                          | `can(actor, action, resource)` em TypeScript puro |
| Event sourcing / CQRS                            | Activity log já dá auditoria com 1% do custo                               | `activity_log` append-only                        |
| Fila distribuída, Redis, cron elaborado          | Volume é baixíssimo; side-effect inline resolve                            | `notifications` com status + reenvio manual       |
| Realtime (websocket) no portal                   | O cliente entra poucas vezes por semana                                    | Revalidação normal do Next.js                     |
| ORM (Prisma/Drizzle) sobre o Supabase            | Duas fontes de verdade de schema, e RLS é escrita em SQL de qualquer forma | Migrations SQL + tipos gerados pelo CLI           |
| Monorepo / Turborepo / design system em pacote   | Uma aplicação, um deploy                                                   | Um app Next.js                                    |
| Centro de notificações in-app                    | O e-mail resolve; o dashboard já mostra pendências                         | "Precisa da sua atenção" derivado por query       |
| Soft delete em tudo                              | Complica toda query e toda policy                                          | Só onde há razão de negócio (`archived`)          |
| Storybook, tRPC, GraphQL, i18n                   | Sem consumidor externo, sem segundo idioma, sem time de UI dedicado        | Server Actions + Tailwind                         |
| `project_memberships`                            | Cliente vê todos os projetos dele; `boop_member` é escopado por cliente    | Adicionar só quando existir um caso real          |
| Sync bidirecional com Notion                     | Conflito de escrita é o problema mais caro de sistemas pequenos            | Projeção unidirecional, FASE 17                   |

---

## 5. Fora da V0

Confirmado da §5, com os acréscimos que esta revisão identificou.

**Já listado pela especificação:** Google Drive, Google Calendar, Google Meet,
Meta API, TikTok API, agendador de redes sociais, CRM, financeiro, assinatura
eletrônica, chat interno, WhatsApp, billing, pagamentos, microservices, fila
distribuída, ERP, n8n.

**Acrescentado por esta revisão:**

- `research_items`, `research_collections`, `meeting_notes` (I-09)
- `project_memberships`, `strategy_comments`, `content_publications`
- `integrations`, `integration_events`, `automation_runs` (entram na FASE 17/18)
- Perguntas de onboarding do tipo `file` (I-05)
- Comentário em Estratégia (I-11)
- Notificação in-app, realtime, exportação de PDF, i18n
- Autoatendimento de cadastro (não existe signup público: todo acesso nasce de um
  convite feito por `boop_admin`)
