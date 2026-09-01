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

RLS habilitada em **todas** as tabelas de `public`, sem exceção. Políticas
declaradas separadamente para `select`, `insert`, `update` e `delete`. Uma policy
de SELECT **não** cobre UPDATE.

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

- Vive **exclusivamente** em `src/lib/supabase/admin.ts`, cujo primeiro import é
  `server-only` — importar no cliente quebra o build.
- **Nunca** `NEXT_PUBLIC_`. **Nunca** em Client Component. **Nunca** em log.
- Usos legítimos na V0, e só estes: criar usuário no convite, gerar link de
  autenticação, assinar URL de storage, executar seed/manutenção.
- Todo uso passa por função nomeada em `admin.ts` — nada de instanciar client
  admin no meio de um workflow.
- Teste de lint falha se `SUPABASE_SERVICE_ROLE_KEY` aparecer fora daquele
  arquivo. Secret scanning e push protection ligados no GitHub.

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
