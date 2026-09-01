# Ambientes e deploy — Boop OS

## Ambientes

Três, com bancos separados. Ver
[ADR-0014](adr/0014-dois-projetos-supabase.md).

| | Aplicação | Supabase | Quem usa |
| --- | --- | --- | --- |
| **development** | `localhost:3000` | Supabase local (Docker, via CLI) | quem desenvolve |
| **preview / staging** | Preview da Vercel, por PR | **projeto `boop-os-staging`** | revisão de PR, testes manuais |
| **production** | domínio da Boop | **projeto `boop-os-prod`** | clientes reais |

Dois projetos Supabase, não três: o desenvolvimento roda local (mais rápido,
gratuito, isolado, e é onde os testes de RLS rodam contra Postgres real). Todos
os previews compartilham o staging — aceitável porque preview é para revisar
mudança, não para dado permanente.

**Nenhum segredo de produção existe fora da produção.** A `service_role` de
produção não vai para `.env.local` de ninguém.

### Matriz de variáveis

| Variável | dev | preview | prod | Exposta ao browser |
| --- | :---: | :---: | :---: | :---: |
| `NEXT_PUBLIC_SITE_URL` | ✓ | ✓ | ✓ | sim |
| `NEXT_PUBLIC_APP_ENV` | ✓ | ✓ | ✓ | sim |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | ✓ | sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | ✓ | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ (local) | ✓ (staging) | ✓ (prod) | **NUNCA** |
| `SUPABASE_DB_URL` | ✓ (testes) | — | — | **NUNCA** |
| `RESEND_API_KEY` | — (dry-run) | ✓ (sandbox) | ✓ | **NUNCA** |
| `EMAIL_FROM` | ✓ | ✓ | ✓ | não |
| `EMAIL_DRY_RUN` | `true` | `false` | `false` | não |
| `NOTION_API_KEY` | — | ✓ (F17) | ✓ (F17) | **NUNCA** |
| `CRON_SECRET` | — | ✓ | ✓ | **NUNCA** |

Em preview, o e-mail sai apenas para domínios da Boop — nenhum e-mail de teste
pode alcançar um cliente real. Garantido por allowlist no `EmailService` quando
`NEXT_PUBLIC_APP_ENV !== 'production'`.

## Setup local

```bash
cp .env.example .env.local
npm install
supabase start          # Postgres, Auth, Storage, Studio locais
npm run db:reset        # migrations + seed
npm run dev
```

`supabase start` imprime as chaves locais — são fixas e públicas por design,
podem ir no `.env.local`.

## Migrations

Fonte única do schema: `supabase/migrations/*.sql`. Ver
[ADR-0013](adr/0013-migrations-sql-versionadas.md).

```bash
supabase migration new add_content_versions   # cria o arquivo
npm run db:reset                              # recria o banco local do zero
npm run db:types                              # regenera database.types.ts
npm run db:diff                               # confere que nada ficou fora
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
- `supabase/seed.sql` popula apenas desenvolvimento: uma Boop admin, dois
  clientes fictícios com usuários distintos (essenciais para os testes de
  isolamento), um projeto social, um template de onboarding. **Nunca** dado real
  de cliente.

## CI (GitHub Actions)

Em todo PR, nesta ordem, com falha bloqueando o merge:

```
1. typecheck        tsc --noEmit
2. lint             eslint (inclui a regra de service_role confinada)
3. test:unit        vitest — policies, máquinas de estado, validação
4. supabase start   + db reset
5. test:rls         isolamento entre tenants contra Postgres real
6. build            next build
7. audit            npm audit --audit-level=high
```

O passo 5 é o que garante multi-tenancy de verdade e por isso não é opcional nem
"nightly".

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
