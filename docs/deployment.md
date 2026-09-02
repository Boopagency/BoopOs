# Ambientes e deploy — Boop OS

## Ambientes

Três, com bancos separados. Ver
[ADR-0014](adr/0014-dois-projetos-supabase.md).

|                       | Aplicação                 | Supabase                                                         | Quem usa                      |
| --------------------- | ------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| **development**       | `localhost:3000`          | Supabase local (Docker, via CLI)                                 | quem desenvolve               |
| **preview / staging** | Preview da Vercel, por PR | **`boop-os-staging`** · `sa-east-1` · ref `njlkuzrppnwkgrdacmos` | revisão de PR, testes manuais |
| **production**        | domínio da Boop           | **`boop-os-prod`** — ainda não existe, nasce na FASE 20          | clientes reais                |

**Região: `sa-east-1` (São Paulo).** O cliente e a equipe estão no Brasil, e a
ida e volta até `us-west` custa entre 150 e 200 ms em toda leitura do portal.
Região de projeto Supabase não se altera depois: mudar exige projeto novo e
migração de dados. Por isso foi decidida antes da primeira migration.

Dois projetos Supabase, não três: o desenvolvimento roda local (mais rápido,
gratuito, isolado, e é onde os testes de RLS rodam contra Postgres real). Todos
os previews compartilham o staging — aceitável porque preview é para revisar
mudança, não para dado permanente.

**Nenhum segredo de produção existe fora da produção.** A `service_role` de
produção não vai para `.env.local` de ninguém.

### Matriz de variáveis

| Variável                        |     dev     |   preview   |   prod   | Exposta ao browser |
| ------------------------------- | :---------: | :---------: | :------: | :----------------: |
| `NEXT_PUBLIC_APP_URL`           |      ✓      |      ✓      |    ✓     |        sim         |
| `NEXT_PUBLIC_APP_ENV`           |      ✓      |      ✓      |    ✓     |        sim         |
| `NEXT_PUBLIC_SUPABASE_URL`      |      ✓      |      ✓      |    ✓     |        sim         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` |      ✓      |      ✓      |    ✓     |        sim         |
| `SUPABASE_SERVICE_ROLE_KEY`     |  ✓ (local)  | ✓ (staging) | ✓ (prod) |     **NUNCA**      |
| `SUPABASE_DB_URL`               | ✓ (testes)  |      —      |    —     |     **NUNCA**      |
| `RESEND_API_KEY`                | — (dry-run) | ✓ (sandbox) |    ✓     |     **NUNCA**      |
| `EMAIL_FROM`                    |      ✓      |      ✓      |    ✓     |        não         |
| `EMAIL_DRY_RUN`                 |   `true`    |   `false`   | `false`  |        não         |
| `NOTION_API_KEY`                |      —      |   ✓ (F17)   | ✓ (F17)  |     **NUNCA**      |
| `CRON_SECRET`                   |      —      |      ✓      |    ✓     |     **NUNCA**      |

**Nenhuma variável é obrigatória para `pnpm dev` ou `pnpm build`.** Cada
integração só exige a sua no momento em que é usada — ver
[ADR-0017](adr/0017-env-validacao-em-duas-camadas.md). Isso vale inclusive em
produção: a aplicação sobe, e a rota que precisa da integração ausente falha com
mensagem nomeando a variável.

Em preview, o e-mail sai apenas para domínios da Boop — nenhum e-mail de teste
pode alcançar um cliente real. Garantido por allowlist no `EmailService` quando
`NEXT_PUBLIC_APP_ENV !== 'production'`.

### Autenticação do projeto hospedado

A partir da FASE 3 a validação manual acontece no ambiente hospedado — Vercel
apontando para o `boop-os-staging`. O `supabase/config.toml` governa **apenas o
ambiente local**: o projeto hospedado é configurado no painel, e as duas
configurações precisam combinar.

| Item                  | Valor                                  | Onde                 |
| --------------------- | -------------------------------------- | -------------------- |
| Signup público        | **desligado**                          | Auth → Providers     |
| Expiração do link     | **900 s** (15 min)                     | Auth → Email         |
| Site URL              | URL estável da aplicação               | Auth → URL Config    |
| Redirect URLs         | `<APP_URL>/auth/callback`, sem curinga | Auth → URL Config    |
| `NEXT_PUBLIC_APP_URL` | a mesma URL estável                    | Vercel → Environment |

Duas armadilhas específicas deste projeto:

- **Preview da Vercel muda de URL a cada deployment.** Cadastrar
  `*.vercel.app` como redirect aceitaria qualquer preview — inclusive de outro
  projeto na mesma conta — como destino de uma sessão. Use a URL estável do
  ambiente e mantenha a lista exata.
- **`NEXT_PUBLIC_APP_URL` é a origem de todo link de retorno.** O `Host` do
  request não é usado para isso de propósito: é controlável pelo cliente. Se
  essa variável apontar para outro lugar, o Magic Link volta para outro lugar.

O e-mail de autenticação sai pelo Supabase, não pelo `EmailService`
([ADR-0010](adr/0010-email-auth-vs-produto.md)). O convite da FASE 5 é e-mail de
autenticação e segue por esse mesmo caminho — a configuração que ele exige está
em [Configuração do Auth para o convite](#configuração-do-auth-para-o-convite-fase-5),
mais abaixo. Ver também [`authentication.md`](authentication.md).

## Toolchain

Node 22 (`.nvmrc`) e **pnpm 10 como package manager único** — `npm` e `yarn`
falham por `engine-strict` no `.npmrc`. Ver
[ADR-0016](adr/0016-toolchain-pnpm-node-typescript.md).

## Setup local

**Hoje (FASE 1)** — o `.env.local` pode ficar vazio:

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

**A partir da FASE 2**, com banco local:

```bash
supabase start          # Postgres, Auth, Storage, Studio locais
pnpm db:reset           # migrations + seed
pnpm db:types           # regenera src/lib/supabase/database.types.ts
pnpm test:rls           # a suíte que precisa de banco
```

`supabase start` imprime as chaves locais — são fixas e públicas por design,
podem ir no `.env.local`.

**Sem Docker?** `pnpm db:reset` avisa e cai para um Postgres nu com shim de
`auth` (`scripts/db/local-postgres.sh`). Serve para migrations, constraints,
triggers e RLS; não serve para login, e-mail, Storage nem PostgREST. Ver
[`database.md`](database.md#rodar-localmente).

## Migrations

Fonte única do schema: `supabase/migrations/*.sql`. Ver
[ADR-0013](adr/0013-migrations-sql-versionadas.md).

```bash
supabase migration new add_content_versions   # cria o arquivo
pnpm db:reset                              # recria o banco local do zero
pnpm db:types                              # regenera database.types.ts
pnpm db:diff                               # confere que nada ficou fora
```

Regras:

- **Nunca** alterar o banco pelo Studio como fonte da mudança. O Studio serve
  para explorar; a mudança nasce em arquivo.
- Migrations são **forward-only**. Não há `down`. Errou? Nova migration corrige.
- Cada migration é idempotente na medida do possível (`if not exists`), e nunca
  editada depois de ter sido aplicada em staging ou produção.
- Mudança destrutiva usa **expandir → migrar → contrair**, em três deploys:
  1. adiciona a coluna nova, a aplicação escreve nas duas;
  2. faz o backfill e passa a ler da nova;
  3. remove a antiga.
     Nunca renomear coluna em uso num único passo.
- Toda tabela nova nasce, **na mesma migration**, com `enable row level security`
  e as quatro políticas. Tabela sem RLS não passa no CI.
- `database.types.ts` é gerado e commitado; o CI falha se estiver desatualizado.
- `supabase/seed.sql` popula apenas desenvolvimento e staging: uma Boop admin,
  dois clientes fictícios com usuários distintos (essenciais para os testes de
  isolamento), um projeto social cada, um template de onboarding. **Nunca** dado
  real de cliente — e o seed **aborta** se encontrar um cliente fora do conjunto
  demo.
- Depois de aplicar em staging, rode `scripts/db/fingerprint.sql` nos dois lados
  e compare os sete hashes. É como se verifica que o banco reconstruído do
  repositório e o remoto são o mesmo banco, sem depender de `supabase db diff`.
- O linter do Supabase (`security` e `performance`) faz parte do fechamento de
  qualquer fase que mexa em schema. Achado dele vira migration nova, nunca
  edição de migration antiga.

## CI (GitHub Actions)

O CI cresce junto com o projeto. Falha em qualquer passo bloqueia o merge.

**Hoje** (`.github/workflows/ci.yml`):

```
install --frozen-lockfile → typecheck → lint → format:check → test → build
```

**A partir da FASE 4**, entram os passos de banco:

```
… → supabase start → db reset → test:rls → build
```

`test:rls` é o que garante multi-tenancy de verdade: não é opcional e não vira
execução noturna. `pnpm audit --audit-level=high` entra na FASE 19.

Localmente, `pnpm check` roda typecheck, lint, format e testes — é o portão
antes de abrir PR.

## Configuração do Auth para o convite (FASE 5)

Duas coisas que **não** estão no repositório e precisam de uma pessoa no painel
do Supabase. Sem elas o código do convite roda, mas ninguém consegue entrar pelo
link — então trate como parte do deploy da FASE 5, não como opcional.

### 1. SMTP customizado apontando para o Resend

`Authentication → Emails → SMTP Settings`. Sem isso o convite sai pelo SMTP
padrão do Supabase: remetente genérico, entregabilidade baixa e nenhuma
identidade da Boop ([ADR-0010](adr/0010-email-auth-vs-produto.md)).

### 2. O template de convite precisa usar `{{ .TokenHash }}`

⚠️ **É o passo que quebra silenciosamente se for esquecido.**

`Authentication → Emails → Templates → Invite user`. O corpo precisa apontar
para o callback com `token_hash`, e não para o `.ConfirmationURL` padrão:

```html
<a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite">
  Ativar meu acesso
</a>
```

**Confirmado em produção-like no QA da FASE 5.** Com o template padrão, os logs
de borda do staging mostram a diferença exata entre os dois cliques:

```
/auth/v1/verify?token=e4cf5fad…&type=invite         → 303   (convite: sem sessão)
/auth/v1/verify?token=pkce_ddef0559…&type=magiclink → 303
POST /auth/v1/token?grant_type=pkce                 → 200   (Magic Link: sessão)
```

O token do convite não tem o prefixo `pkce_`, e depois dele **não há**
`POST /auth/v1/token`: a sessão foi para o fragmento e se perdeu. A pessoa
convidada vê "esse link não funciona mais" com o link intacto.

**Por quê.** O Magic Link do `/login` nasce no navegador de quem pede: o
`signInWithOtp` grava um verifier PKCE em cookie, e o callback troca `?code=` por
sessão com ele. O convite nasce no SERVIDOR — a pessoa convidada nunca chamou
`signInWithOtp`, então não existe verifier no navegador dela.

Com o template padrão, o GoTrue cai no fluxo implícito e devolve a sessão no
**fragmento** da URL (`#access_token=…`), que nunca chega ao servidor. O
resultado é a pessoa clicando no convite e caindo em `/login?erro=link_invalid`.

Com `{{ .TokenHash }}`, o callback resolve por `verifyOtp` inteiramente no
servidor e grava o cookie pelo mesmo caminho do Magic Link.

### 3. Redirect URL do callback

`Authentication → URL Configuration → Redirect URLs` precisa conter
`https://<host>/auth/callback` para cada ambiente.

## Deploy

- **Preview:** automático a cada PR. Migrations aplicadas em staging pelo
  workflow, com aprovação manual quando a migration for destrutiva.
- **Produção:** merge em `main` → `supabase db push` no projeto de produção →
  build e deploy na Vercel. Migration roda **antes** do deploy da aplicação; por
  isso toda migration precisa ser compatível com a versão anterior do código
  (o "expandir" do expandir/contrair).
- Rollback da aplicação: promover o deploy anterior na Vercel. Rollback de
  banco: nova migration corretiva — nunca restaurar snapshot com o app novo no ar.

## Antes de ir a produção (FASE 20)

- [ ] Domínio configurado, HTTPS, redirect de auth apontando para o domínio final
- [ ] Signup público desabilitado no Supabase
- [ ] Domínio verificado no Resend (SPF, DKIM, DMARC)
- [ ] SMTP customizado do Supabase apontando para o Resend, com template revisado
- [ ] Buckets privados confirmados; nenhuma policy pública em `storage.objects`
- [ ] `supabase inspect` / advisors sem alerta de RLS
- [ ] Backup automático ligado e **restauração testada uma vez**
- [ ] Secret scanning e push protection ligados no GitHub
- [ ] Cabeçalhos de segurança conferidos em produção
- [ ] Log estruturado sem PII; alerta de erro configurado
- [ ] Suíte de RLS verde contra staging, não só local
- [ ] Fluxo do Marco 1 executado ponta a ponta com dois clientes reais de teste
- [ ] Dívida de LGPD registrada (D-11)
