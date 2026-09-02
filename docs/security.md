# Segurança — Boop OS

Regra que organiza tudo o que vem abaixo: **o dado de um cliente nunca alcança
outro cliente**. Qualquer decisão em conflito com isso perde.

## Modelo de ameaças

Quem pode atacar, o que quer, e o que impede.

| Ator                                  | Objetivo                                    | Controle principal                                                                 |
| ------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Anônimo na internet                   | Ler dados privados, enumerar clientes       | Sem signup público; nenhuma rota de dado acessível sem sessão; RLS nega por padrão |
| `client_user` autenticado (Cliente A) | Ver dados do Cliente B trocando IDs na URL  | `requireProjectAccess` + RLS por vínculo; 404 em vez de 403                        |
| `client_user` curioso                 | Ver backlog, comentário interno, rascunho   | Filtro por status e por `is_internal` na RLS; projeções explícitas                 |
| `client_user` malicioso               | Chamar Server Action direto, forjar payload | Toda action passa por `defineWorkflow`; zod `.strict()`; autorização server-side   |
| `boop_member`                         | Acessar cliente sem vínculo                 | RLS por vínculo também para interno (D-08)                                         |
| Terceiro com link vazado              | Baixar arquivo                              | Signed URL com TTL curto, gerada sob demanda, nunca cacheada nem logada            |
| Vazamento de código/env               | Obter `service_role`                        | `server-only`, sem prefixo público, scanning, teste de lint                        |

## Duas camadas, sempre

1. **Aplicação** — nega cedo, com contexto, e produz a mensagem certa.
2. **Banco (RLS)** — nega mesmo se a camada 1 tiver um bug.

Nenhuma das duas é considerada suficiente sozinha. Uma feature não está pronta se
funciona apenas por causa de uma delas.

## Autenticação

- **Supabase Auth, Magic Link, fluxo PKCE.** Sem senha na V0: nada de política de
  senha, reset, vazamento de hash ou credential stuffing.
- Sessão em **cookie httpOnly, Secure, SameSite=Lax**, gerenciada por
  `@supabase/ssr`. O JWT nunca vai para `localStorage`.
- **Não existe cadastro público.** Todo acesso nasce de um convite feito por
  `boop_admin`. Signup desabilitado no projeto Supabase.
- Link com validade de 15 minutos e uso único.
- `proxy.ts` apenas renova a sessão e redireciona quem não tem sessão. **Não
  toma decisão de autorização** — já houve classe de bypass desse arquivo no
  Next.js, e ele não é fronteira de segurança. No Next 16 ele se chama `proxy.ts`
  (o antigo `middleware.ts` está depreciado), e o nome novo descreve melhor o que
  ele é: uma camada de rede na frente da aplicação. Ver
  [`spec-review.md` I-14](spec-review.md).
- Toda página e todo workflow refazem a checagem no servidor.

O fluxo completo — PKCE, callback, cookies, primeiro login, logout, redirect
seguro e configuração do projeto — está em
[`authentication.md`](authentication.md).

### O `actor`

Carregado uma vez por request e passado adiante. Nunca reconstruído a partir de
dado enviado pelo cliente.

```ts
type Actor = {
  userId: string
  role: 'boop_admin' | 'boop_member' | 'client_user'
  status: 'invited' | 'active' | 'disabled'
  clientIds: string[] // vínculos; vazio para boop_admin
}
```

`status = 'disabled'` derruba o acesso no request seguinte, sem esperar o token
expirar.

> **Estado na FASE 3.** O Actor implementado carrega identidade — `userId`,
> `email`, `fullName`, `role`, `status` — e **não** carrega `clientIds`.
> Vínculo é escopo, escopo é autorização, e autorização é a FASE 4: até lá o
> campo viria de uma consulta que ignora RLS, o que é exatamente o contrário
> do que ele deveria provar. Ver
> [`authentication.md`](authentication.md#o-actor) e
> [ADR-0021](adr/0021-service-role-para-resolver-identidade.md).

## Autorização

Papel **global** em `profiles.role`; vínculo em `client_memberships` concede
**escopo**. Matriz completa em [`permissions.md`](permissions.md).

Guards obrigatórios em qualquer rota com parâmetro de recurso:

```ts
requireActor() // sessão válida e perfil ativo
requireClientAccess(clientId) // vínculo ou boop_admin
requireProjectAccess(projectId) // resolve o cliente do projeto e verifica
requireBoop() / requireBoopAdmin()
```

Recurso inacessível responde **404**, não 403 — 403 confirma que o recurso
existe.

## Row Level Security

**Implementada na FASE 4.** A matriz por tabela, as funções e os guards estão em
[`authorization.md`](authorization.md); aqui fica o desenho e o que é obrigatório.

RLS habilitada em **todas** as tabelas de `public`, sem exceção. Políticas
declaradas separadamente para `select`, `insert`, `update` e `delete`. Uma policy
de SELECT **não** cobre UPDATE.

Onde uma operação deve ser impossível, **não há policy e não há GRANT** — a
ausência é decisão registrada, não esquecimento, e o teste de varredura confere
a matriz inteira contra o catálogo do Postgres.

### Funções auxiliares

No schema `app`, que **não** é exposto pelo PostgREST. `security definer`,
`stable`, `search_path` fixado.

```sql
create schema if not exists app;
revoke all on schema app from anon, authenticated;

create or replace function app.actor_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p
   where p.id = (select auth.uid()) and p.status = 'active'
$$;

create or replace function app.is_boop_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.actor_role() = 'boop_admin' $$;

create or replace function app.is_boop()
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.actor_role() in ('boop_admin','boop_member') $$;

create or replace function app.has_client_access(p_client_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_boop_admin()
      or exists (
        select 1 from public.client_memberships m
         where m.client_id = p_client_id
           and m.user_id = (select auth.uid())
      )
$$;

create or replace function app.has_project_access(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.projects pr
     where pr.id = p_project_id
       and app.has_client_access(pr.client_id)
  )
$$;

create or replace function app.is_client_user()
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.actor_role() = 'client_user' $$;
```

Por que `security definer`: quebra a recursão de policies (`clients` → `memberships`
→ `clients`) e permite ler `profiles` de dentro de uma policy sobre `profiles`.
Por que **não** ler o papel do JWT: mudança de papel ou revogação de vínculo
valeriam só na expiração do token (~1 h). Aqui valem no request seguinte.
Ver [ADR-0004](adr/0004-rls-com-funcoes-security-definer.md).

### Forma padrão de uma policy

```sql
alter table public.content_items enable row level security;

-- SELECT: Boop com acesso ao cliente; cliente só a partir de awaiting_client
create policy content_items_select on public.content_items
for select to authenticated
using (
  app.has_client_access(client_id)
  and (
    not app.is_client_user()
    or status in ('awaiting_client','changes_requested','approved','scheduled','published')
  )
);

-- INSERT: só time Boop, e só dentro de cliente ao qual tem acesso
create policy content_items_insert on public.content_items
for insert to authenticated
with check (app.is_boop() and app.has_client_access(client_id));

-- UPDATE: USING **e** WITH CHECK. Sem WITH CHECK o usuário move a linha de tenant.
create policy content_items_update on public.content_items
for update to authenticated
using (app.is_boop() and app.has_client_access(client_id))
with check (app.is_boop() and app.has_client_access(client_id));

-- DELETE: apenas boop_admin
create policy content_items_delete on public.content_items
for delete to authenticated
using (app.is_boop_admin() and app.has_client_access(client_id));
```

### Erros de RLS que já sabemos evitar

| Erro                                 | Consequência                                          | Como evitamos                                               |
| ------------------------------------ | ----------------------------------------------------- | ----------------------------------------------------------- |
| UPDATE só com `USING`                | O usuário troca `client_id` e migra a linha de tenant | `WITH CHECK` obrigatório + trigger de imutabilidade         |
| Policy que consulta a própria tabela | Recursão infinita                                     | Predicados só via funções `security definer`                |
| `auth.uid()` solto no predicado      | Reavaliação por linha, query lenta                    | Sempre `(select auth.uid())`                                |
| Esquecer `enable row level security` | Tabela aberta a qualquer autenticado                  | Teste que varre `pg_tables` e falha se faltar RLS ou policy |
| Confiar no `client_id` do payload    | Escrita cruzada entre tenants                         | `client_id` derivado por trigger a partir do pai            |
| Schema auxiliar exposto              | Funções internas chamáveis via API                    | `app` fora dos schemas expostos, `revoke` explícito         |

### Regras por papel (resumo)

| Tabela                                | `boop_admin` | `boop_member`                             | `client_user`                              |
| ------------------------------------- | ------------ | ----------------------------------------- | ------------------------------------------ |
| `clients`                             | CRUD         | R (com vínculo)                           | R (com vínculo, colunas públicas)          |
| `client_memberships`                  | CRUD         | R                                         | R (apenas as próprias)                     |
| `projects`                            | CRUD         | RU (com vínculo)                          | R                                          |
| `project_stages`                      | CRUD         | RU                                        | R                                          |
| `onboarding_*` (template)             | CRUD         | R                                         | R (apenas o template da própria submissão) |
| `onboarding_submissions`              | CRUD         | RU                                        | RU (apenas enquanto `draft`)               |
| `onboarding_answers`                  | CRUD         | R                                         | CRU (apenas enquanto `draft`)              |
| `strategies` / `strategy_versions`    | CRUD         | CRU                                       | R (`status <> 'draft'`)                    |
| `strategy_approvals`                  | R            | R                                         | R — escrita **apenas** via RPC             |
| `content_items`                       | CRUD         | CRU                                       | R (`status >= awaiting_client`)            |
| `content_versions`                    | CRUD         | CRU                                       | R (`sent_for_approval_at is not null`)     |
| `content_comments`                    | CRUD         | CRU                                       | CR (`is_internal = false`)                 |
| `content_approvals`                   | R            | R                                         | R — escrita **apenas** via RPC             |
| `files`                               | CRUD         | CRU                                       | R (`visibility = 'client'`)                |
| `meetings`                            | CRUD         | CRU                                       | R                                          |
| `account_metrics` / `content_metrics` | CRUD         | CRU                                       | R                                          |
| `monthly_reviews`                     | CRUD         | CRU                                       | R (`status = 'published'`)                 |
| `activity_log`                        | R            | R (`visibility='internal'` do seu escopo) | —                                          |
| `notifications`                       | R            | —                                         | —                                          |

Aprovações não têm policy de INSERT para ninguém: são gravadas por funções
`security definer` que validam a transição de estado. Isso torna impossível
aprovar direto pela API, pulando a máquina de estados.

## Uso da `service_role`

Ignora toda a RLS. Tratada como chave de root.

**A FASE 4 zerou os chamadores.** Os três usos da FASE 3 (`getActor`,
`recordFirstLogin`, `logActivity`) migraram para o caminho com RLS ou para
fronteiras privilegiadas menores
([ADR-0022](adr/0022-autorizacao-no-banco-e-fim-da-service-role-de-identidade.md)).

**A FASE 5 devolveu UM chamador, e é o que a própria ADR previu:** criar a conta
em `auth.users` no convite. Nenhum papel de aplicação escreve em `auth` — não é
schema de domínio e não há policy que sirva.

A diferença entre este uso e o que a FASE 4 removeu:

| Removido na FASE 4                    | Aceito na FASE 5                                  |
| ------------------------------------- | ------------------------------------------------- |
| **autorização** — ler domínio sem RLS | **administração do Auth** — criar conta em `auth` |

Três coisas mantêm isso pequeno:

- `createAdminClient()` **não é exportado**. O que sai de `admin.ts` é
  `inviteAuthUser()`, uma operação nomeada que faz uma coisa só. Exportar a
  fábrica tornaria possível instanciá-la no meio de um workflow "só para essa
  consulta", que é como um bypass volta.
- **Nada em `admin.ts` consulta `clients`, `projects`, `profiles` ou
  `client_memberships`.** Domínio se lê e se escreve pelo JWT do ator.
- O grep continua servindo: `grep -rn "from '@/lib/supabase/admin'" src/` devolve
  uma linha — `src/domains/people/mutations.ts`.

Storage (FASE 12) é o próximo uso legítimo previsto.

- Vive **exclusivamente** em `src/lib/supabase/admin.ts`, cujo primeiro import é
  `server-only` — importar no cliente quebra o build.
- **Nunca** `NEXT_PUBLIC_`. **Nunca** em Client Component. **Nunca** em log.
- Usos legítimos na V0, e só estes: criar usuário no convite, gerar link de
  autenticação, assinar URL de storage, executar seed/manutenção.
- Todo uso passa por função nomeada em `admin.ts` — nada de instanciar client
  admin no meio de um workflow.
- Teste de lint falha se `SUPABASE_SERVICE_ROLE_KEY` aparecer fora daquele
  arquivo. Secret scanning e push protection ligados no GitHub.

## O que a RLS **não** faz: coluna

Registrado porque é a lacuna mais fácil de ler errado.

**RLS é row-level, não column-level.** Quando a policy concede a linha, ela
concede a linha inteira — todas as colunas. Duas colunas internas viajam nessa
carona:

| Coluna                            | Quem não pode ler | Por que a RLS não resolve                      |
| --------------------------------- | ----------------- | ---------------------------------------------- |
| `clients.notes`                   | `client_user`     | nota interna da Boop na mesma linha do cliente |
| `content_versions.internal_notes` | `client_user`     | idem, na versão que o cliente precisa ver      |

GRANT de coluna também não resolve: `authenticated` é **um papel só** para as
três personas, então não há como conceder `notes` a `boop_member` e negar a
`client_user` por privilégio.

**A proteção efetiva é a projeção do lado do servidor** — nenhuma leitura
client-facing seleciona essas colunas, e `select *` é proibido pela regra do
repositório.

### A dívida foi paga na FASE 5 — em três camadas

A FASE 4 registrou isso como dívida datada, com prazo na FASE 5, porque enquanto
o portal lia mocks não existia caminho que expusesse a coluna. Ligar o dado real
abriu esse caminho, e a resposta é `src/lib/data/projection.ts` mais as
projeções por audiência em `src/domains/*/types.ts`:

| Camada                           | O que garante                                                        | Onde falha se alguém errar |
| -------------------------------- | -------------------------------------------------------------------- | -------------------------- |
| **1. A coluna não sai do banco** | `CLIENT_PUBLIC_COLUMNS` e `CLIENT_LIST_COLUMNS` não pedem `notes`    | teste de RLS               |
| **2. O tipo não tem o campo**    | `AssertClientFacing<T>` recusa qualquer projeção com campo interno   | `pnpm typecheck`           |
| **3. A capacidade é conferida**  | `getClientDetailForBoop()` exige `can('client.read_internal_notes')` | teste de unidade           |

A separação é por **audiência**, e não por um parâmetro `includeNotes`: um
argumento tem valor padrão, pode ser esquecido, pode ser invertido num refactor e
não deixa rastro no tipo. `ClientPublic` simplesmente não tem `notes` para vazar.

**Por que não uma view.** Uma view client-facing resolveria por outro caminho e
traria `security_invoker`, GRANTs próprios, comportamento próprio no PostgREST e
um segundo lugar onde a verdade sobre colunas mora. A projeção explícita resolve
o mesmo com menos peças móveis.

**O que continua verdade.** A LINHA ainda carrega `notes` para quem a policy
concede — RLS é row-level, e isso não mudou. `tests/rls/internal-visibility.test.ts`
e `tests/rls/phase5-admin-surface.test.ts` afirmam a limitação de propósito: se um
deles falhar, a limitação deixou de existir e esta seção precisa ser reescrita.

**Para as fases seguintes:** `content_versions.internal_notes` já está em
`INTERNAL_FIELDS`. A primeira leitura client-facing de versão de conteúdo
(FASE 10) já nasce sob a mesma trava — o compilador cobra antes da revisão.

## Coluna, de novo: a policy não decide quais colunas (FASE 5)

Achado na validação hospedada da FASE 5, e o irmão do problema acima — só que do
lado da ESCRITA.

`authenticated` tem GRANT de UPDATE nas tabelas de domínio, e a policy decide
QUAIS LINHAS. Nenhuma delas diz nada sobre colunas. Quem passa por
`clients_update` reescrevia a linha inteira, `created_at` e `created_by`
incluídos — e a única coisa entre isso e a Data API era a aplicação não pedir.

Não é isolamento entre tenants nem escalada: quem consegue já alcançava a linha.
É **integridade de auditoria**, e num sistema cujo valor está em registrar
decisões, um `created_by` que aceita ser reescrito vale menos que nenhum.

Corrigido com trigger, em duas regras — porque há dois comportamentos legítimos:

| Regra                                                        | Colunas                   | Por quê                                                         |
| ------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------- |
| estrita — `app.enforce_immutable_columns()`                  | `created_at`              | nada a altera, nunca                                            |
| não-reatribuível — `app.enforce_authorship_not_reassigned()` | `created_by`, `author_id` | `alguém → null` é o `on delete set null` da FK e precisa passar |

A segunda regra existe porque a primeira versão da correção quebrou a suíte da
FASE 2: um trigger estrito em `created_by` tornaria impossível apagar qualquer
pessoa que já tivesse criado alguma coisa, e trocaria o `23503` que a ADR-0019
afirma por um `23514` de outra causa. Autoria pode ser **limpa**, nunca
**reatribuída**.

`onboarding_submissions.submitted_by` fica fora: nasce nulo e é preenchido no
UPDATE que submete o onboarding (FASE 7).

**A regra geral, para as fases seguintes:** tabela que ganhe GRANT de UPDATE
ganha junto o trigger de autoria. A varredura em
`tests/rls/phase5-immutable-authorship.test.ts` falha sozinha se alguém
esquecer.

## Achados do linter do Supabase — classificação

Rodado em staging depois da FASE 4 e de novo depois da FASE 5. **Zero achados de
RLS nas duas vezes**: nenhuma tabela sem política, nenhuma política sem RLS,
nenhum GRANT indevido. Fingerprint local ↔ staging idêntico nas nove partes.

| Achado                                                                                                                                                  | Nível | Classificação                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `authenticated_security_definer_function_executable` em `promote_invited_profile`, `record_activity`, `assign_invited_profile_role` e `disable_profile` | WARN  | **Esperado.** É o desenho: as quatro existem para ser chamadas por `rpc`. Todas derivam a identidade de QUEM CHAMA de `auth.uid()` — as duas da FASE 5 recebem o ALVO por parâmetro e conferem o chamador por dentro com `app.is_boop_admin()`. `anon` teve o EXECUTE revogado nas quatro, e cada uma tem teste adversarial (`tests/rls/phase5-people-boundaries.test.ts`) |
| `auth_leaked_password_protection`                                                                                                                       | WARN  | **Não se aplica.** Não existe senha no produto: só Magic Link (D-06, [ADR-0009](adr/0009-autenticacao-magic-link-e-convites.md))                                                                                                                                                                                                                                           |
| `unindexed_foreign_keys` (18)                                                                                                                           | INFO  | **Um virou migration** — `onboarding_submissions.template_id`, medido por `explain` no caminho de `app.has_template_access()`. Os outros são `created_by`/`decided_by`/`author_id`: não estão em predicado de policy, e índice especulativo custa escrita sem pagar leitura                                                                                                |
| `unused_index` (25)                                                                                                                                     | INFO  | **Sem ação.** "Nunca usado" num staging sem tráfego não é sinal. Derrubar índice com base em banco ocioso é como apagar teste que nunca falhou                                                                                                                                                                                                                             |

## Uploads e arquivos

Bucket **privado**, sempre. Zero policy para `anon`/`authenticated` em
`storage.objects`: nada é acessível sem passar pela aplicação.

Fluxo em dois passos ([ADR-0008](adr/0008-uploads-privados-com-url-assinada.md)):

1. `requestUpload()` — autentica, autoriza a entidade de destino, valida nome,
   extensão, MIME declarado e tamanho declarado; grava `files` com
   `status='pending'` e um `storage_path` derivado de UUID; devolve uma **signed
   upload URL**.
2. O browser envia o arquivo direto ao Supabase Storage (sem passar pelo limite
   de corpo da Vercel).
3. `confirmUpload()` — lê a metadata real do objeto, **revalida MIME e tamanho no
   servidor** (o cliente mente no passo 1), marca `status='ready'` e registra
   `file.uploaded`.

Validações:

- Whitelist de MIME: `image/png`, `image/jpeg`, `image/webp`, `video/mp4`,
  `application/pdf`. **SVG bloqueado** (vetor de XSS).
- Tamanho máximo por tipo (imagem 10 MB, vídeo 200 MB, PDF 25 MB).
- Extensão coerente com o MIME.
- `original_name` sanitizado e usado **apenas para exibição**; o path vem de UUID.
- Download: `Content-Disposition: attachment` para tudo que não seja imagem ou
  vídeo de preview.

Downloads: `GET /api/files/[fileId]` autentica, autoriza consultando `files`
(nunca inferindo do path), verifica `visibility` para `client_user`, e só então
assina uma URL com TTL de 60 s (preview) ou 300 s (download). A URL nunca é
embutida em HTML cacheável e nunca é logada.

Objetos órfãos (`pending` que nunca virou `ready`) são limpos por rotina de
manutenção a partir da FASE 12.

## Endpoints

Todo endpoint sensível — Server Action ou Route Handler:

1. autentica;
2. autoriza;
3. valida payload com zod `.strict()`;
4. trata erro com código de domínio;
5. **não** devolve stack trace, SQL, nome de tabela nem valor de env;
6. registra activity log quando altera estado.

Server Action é endpoint público: qualquer pessoa com o ID da action pode
chamá-la. "Só é renderizado para admin" não protege nada.

Resposta de erro para o cliente:

```json
{ "ok": false, "error": { "code": "content.version_not_pending", "message": "..." } }
```

`message` é texto de produto em português. Detalhe técnico vai só para o log,
com `requestId`.

## Rate limiting

Na V0 dependemos dos limites nativos do Supabase Auth (o único vetor realmente
exposto é o disparo de magic link) e da borda da Vercel. Comentário e aprovação
exigem sessão e vínculo, o que restringe abuso a usuários já convidados.

Lacuna consciente. Gatilho para revisar: qualquer endpoint público não autenticado
além do login, ou incidente de abuso. A solução preferida será limitação por
contagem em Postgres antes de introduzir Redis (§43).

## Logs

Nunca registrar: token, senha, `service_role`, cookie, header `Authorization`,
signed URL, corpo de e-mail, resposta de onboarding, legenda de conteúdo.

Log estruturado em JSON com `requestId`, `actorId`, `clientId`, `action`,
`durationMs`, `outcome`. O logger tem allowlist de campos — não é possível
despejar um objeto inteiro por engano.

`activity_log.metadata` guarda identificadores e transições de estado. **Não é
lugar de conteúdo.**

## Cabeçalhos e superfície web

**Implementado na FASE 1** (`next.config.ts`, verificado em produção):

| Cabeçalho                    | Valor                                                          |
| ---------------------------- | -------------------------------------------------------------- |
| `X-Content-Type-Options`     | `nosniff`                                                      |
| `X-Frame-Options`            | `DENY`                                                         |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                              |
| `Permissions-Policy`         | `camera=(), microphone=(), geolocation=(), browsing-topics=()` |
| `Cross-Origin-Opener-Policy` | `same-origin`                                                  |
| `X-DNS-Prefetch-Control`     | `off`                                                          |

`poweredByHeader: false` — a versão do framework não é anunciada.
`/portal` e `/admin` respondem com `Cache-Control: private, no-store`.

**Adiado para a FASE 19, deliberadamente:**

- **CSP.** Uma política útil no App Router exige nonce por request (gerado no
  `proxy.ts`), e a superfície de assets e integrações ainda muda até a FASE 17.
  Uma CSP com `unsafe-inline` agora daria falsa sensação de proteção. Entra junto
  com a renovação de sessão, com nonce.
- **HSTS.** É a Vercel que termina o TLS e já envia `Strict-Transport-Security`
  no domínio de produção; declarar aqui só teria efeito na FASE 20, ao
  configurar o domínio próprio — e é lá que será conferido.

## Environment e segredos no código

Duas regras aplicadas pelo ESLint, não por combinado
([ADR-0017](adr/0017-env-validacao-em-duas-camadas.md)):

- **`process.env` só existe em `src/config/env.ts`.** Qualquer outro acesso é
  erro de lint.
- **`console` só existe em `src/lib/logging/logger.ts`.** O logger tem
  `redact()`, que mascara chaves com nome sensível em qualquer profundidade.

`src/lib/supabase/admin.ts` é o único arquivo autorizado a ler
`SUPABASE_SERVICE_ROLE_KEY`, e começa com `import 'server-only'` — importá-lo de
um Client Component quebra o build.

O painel de integrações da página inicial existe apenas em desenvolvimento e
mostra **apenas booleanos** (`configured` / `not configured`). Há teste que falha
se o valor de uma variável aparecer no HTML renderizado.

## Checklist de revisão de segurança

Antes de qualquer PR que toque em dado:

- [ ] Tabela nova tem RLS habilitada e quatro políticas explícitas?
- [ ] Toda policy de UPDATE tem `USING` **e** `WITH CHECK`?
- [ ] `client_id` é derivado por trigger, nunca aceito do input?
- [ ] O `client_user` continua sem enxergar rascunho, backlog e nota interna?
- [ ] A Server Action passa por `defineWorkflow` com zod `.strict()`?
- [ ] Alguma mensagem de erro vaza estrutura interna?
- [ ] Algum log novo pode conter PII, token ou signed URL?
- [ ] `service_role` continua confinada em `lib/supabase/admin.ts`?
- [ ] Existe teste de isolamento cobrindo o caminho novo?
