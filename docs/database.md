# Banco de dados — Boop OS

Como o banco é criado, mantido e testado. O raciocínio sobre **quais** tabelas
existem está em [`data-model.md`](data-model.md); aqui está o **como**.

A promessa desta camada cabe em uma frase:

> **O banco do Boop OS pode ser recriado do zero a partir do repositório.**

Se isso deixar de ser verdade, o repositório parou de ser a fonte da verdade e
qualquer conclusão sobre o schema passa a ser palpite.

---

## Estado atual

**FASE 2 concluída.** Existem 19 tabelas, 16 enums, 10 migrations, seed com dois
tenants e 64 testes contra Postgres real.

**A RLS está LIGADA e SEM POLÍTICAS.** Em Postgres isso significa negar tudo, que
é o baseline seguro para um banco que ainda não tem autorização escrita. As
políticas, as funções `app.has_client_access()` e a suíte de isolamento são a
**FASE 4**. Até lá, o acesso acontece só server-side por `service_role`, que
ignora RLS por definição e por isso vive confinada em
`src/lib/supabase/admin.ts`.

Ninguém deve ler "RLS habilitada em 19/19 tabelas" como "o banco está seguro
para multi-tenant". Ele está fechado, não protegido — a diferença aparece no dia
em que a primeira policy abrir a porta.

---

## Ambientes

| Onde              | O quê                                        | Região                     |
| ----------------- | -------------------------------------------- | -------------------------- |
| local             | Supabase CLI (Docker) ou Postgres nu         | —                          |
| `boop-os-staging` | projeto Supabase, ref `njlkuzrppnwkgrdacmos` | `sa-east-1` (São Paulo)    |
| `boop-os-prod`    | ainda **não existe**                         | `sa-east-1` quando existir |

São Paulo, e não Oregon: o cliente e a equipe estão no Brasil, e a latência de
ida e volta para `us-west` custa entre 150 e 200 ms em toda leitura do portal.
Ver [ADR-0014](adr/0014-dois-projetos-supabase.md).

Produção nasce na FASE 20, não antes. Criar um projeto de produção vazio meses
antes só cria um lugar a mais onde um segredo pode vazar.

---

## Rodar localmente

### Com Docker — o caminho oficial

```bash
supabase start     # Postgres + Auth + Storage + Studio
pnpm db:reset      # apaga, aplica as migrations, roda o seed
pnpm db:types      # regenera src/lib/supabase/database.types.ts
pnpm test:rls      # a suíte que precisa de banco
```

`supabase start` imprime as chaves locais. São fixas e públicas por design.

### Sem Docker — o plano B

Contêiner de CI, ambiente de agente, máquina restrita: sem daemon de Docker,
`supabase start` não sobe. `pnpm db:reset` percebe isso, **avisa em voz alta** e
usa `scripts/db/local-postgres.sh`: um cluster Postgres descartável em
`.tmp/postgres` mais `scripts/db/auth-shim.sql`, que recria a superfície mínima
de `auth` de que as migrations dependem.

O que o plano B **dá**: migrations, constraints, triggers, enums, índices, seed,
RLS. Ou seja, tudo que responde "as migrations recriam o banco do zero?".

O que ele **não dá**: GoTrue, login, e-mail, Storage, PostgREST. Qualquer teste
que precise de uma dessas coisas precisa de Docker.

O shim reproduz de propósito duas coisas que seriam fáceis de errar:

- `service_role` nasce com `BYPASSRLS`, como no Supabase. É o que impede um
  teste de "provar" isolamento com o papel que ignora isolamento.
- As _default privileges_ de `public` concedem tudo a `anon` e `authenticated`,
  como no Supabase. Sem isso, o `revoke` da migration 140008 não teria o que
  revogar e o teste "anon não tem privilégio" passaria por vacuidade.

---

### O que o plano B não reproduzia (corrigido na FASE 6)

O shim concedia `execute` em `auth.uid()` a `anon` e `authenticated`, e **não**
concedia `usage` no schema `auth` — então o grant era inalcançável. A ausência
ficou invisível por três fases porque toda função que chamava `auth.uid()` até a
FASE 5 era `security definer` e rodava como dona.

A primeira função `security invoker` que precisou da identidade quebrou só
localmente, com `permission denied for schema auth`, enquanto passava no
staging. Conferido contra o `boop-os-staging`: lá `has_schema_privilege` devolve
`true` para `anon` e `authenticated`. O shim passou a fazer o mesmo.

A lição vale além do caso: **um plano B que não reproduz o ambiente real deixa
de ser plano B**. Divergência entre os dois é bug do shim, não do código.

## Migrations

Forward-only, em `supabase/migrations/*.sql`, nomeadas
`AAAAMMDDHHMMSS_assunto.sql`. Ver
[ADR-0013](adr/0013-migrations-sql-versionadas.md).

| Arquivo                                          | O que traz                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `20260901140001_bootstrap.sql`                   | schema `app`, citext, as cinco funções de infraestrutura                  |
| `20260901140002_enums.sql`                       | os 16 enums do Marco 1                                                    |
| `20260901140003_core.sql`                        | `profiles`, `clients`, `client_memberships`, `projects`, `project_stages` |
| `20260901140004_onboarding.sql`                  | template, seções, perguntas, submissão, respostas                         |
| `20260901140005_strategy.sql`                    | estratégia, versões, aprovações                                           |
| `20260901140006_content.sql`                     | itens, versões, comentários, aprovações                                   |
| `20260901140007_system.sql`                      | `activity_log` append-only e `notifications`                              |
| `20260901140008_enable_rls.sql`                  | RLS ligada em tudo, `revoke` de anon/authenticated                        |
| `20260901160001_move_citext_to_extensions.sql`   | citext sai de `public`                                                    |
| `20260901160002_index_tenant_on_leaf_tables.sql` | `client_id` indexado onde faltava                                         |

As duas últimas nasceram de achados do linter do Supabase **depois** de aplicar
no staging. É o fluxo correto: migration nova corrige, ninguém reescreve as
anteriores.

### Regras que não mudam

- A mudança nasce em arquivo. O Studio serve para explorar, nunca para alterar.
- Não existe `down`. Errou? Migration nova.
- Migration já aplicada em staging ou produção **não se edita**.
- Tabela nova nasce com RLS, `created_at`/`updated_at` + trigger, `client_id`
  derivado por trigger quando for tabela de domínio, e índices dos caminhos de
  leitura reais.
- Depois de mexer no schema: `pnpm db:reset && pnpm db:types`, e commite
  `database.types.ts`.
- Enum novo entra no Postgres **e** em `src/config/enums.ts` — dois testes de
  paridade falham se divergirem.
- **Coluna citext nova se escreve `extensions.citext`.** A extensão não mora
  mais em `public`.

---

## As cinco funções de infraestrutura

Vivem no schema `app`, fora de `public`, para não serem expostas pelo PostgREST.
`anon` e `authenticated` não têm nem `usage` no schema.

### `app.derive_client_id()` — a regra central de multi-tenancy

> `client_id` NUNCA vem do input. É sempre derivado do pai.

O valor enviado pelo cliente não é validado: é **descartado**. Isso torna
estruturalmente impossível gravar uma linha do Cliente A apontando para o
Cliente B, mesmo com um bug na aplicação.

```sql
create trigger content_versions_derive_client
  before insert on public.content_versions
  for each row execute function app.derive_client_id('content_items', 'content_item_id');
```

É `security definer` por necessidade real: a partir da FASE 4 a RLS estará
ativa, e quem insere pode não enxergar a linha-pai. Sem `definer`, a derivação
falharia justamente sob RLS. `search_path = ''` obriga qualificar tudo, e a
única interpolação é `%I` sobre valores fixados na definição do trigger — nunca
entrada de usuário.

Exceções, todas nomeadas em `tests/rls/schema.test.ts`: `projects` e
`client_memberships` são raiz do tenant (não há pai de onde derivar);
`activity_log` e `notifications` são transversais, com `client_id` nulável.

### `app.enforce_immutable_columns()` — tenant é para sempre

Depois que uma linha pertence a um cliente, ela pertence para sempre. Sem isto,
uma policy de UPDATE mal escrita permitiria migrar uma linha de tenant — o erro
clássico de RLS descrito em [`security.md`](security.md). Também guarda
`project_id`, `version` e as chaves de idempotência.

### `app.reject_mutation()` — append-only de verdade

RLS sozinha não garantiria: `service_role` a ignora. Trigger vale para todo
mundo, inclusive para quem tem bypass. Usada nas duas pontas de `activity_log`.

### `app.set_updated_at()`

Um trigger por tabela com `updated_at`. `tests/rls/schema.test.ts` varre o
catálogo e falha se alguma tabela tiver a coluna e não o trigger.

### `app.handle_new_auth_user()` e `app.handle_auth_user_email_change()`

Espelham `auth.users` em `public.profiles`, que é a tabela legível pela
aplicação. O perfil nasce `invited` e com o papel menos privilegiado
(`client_user`); promover é ato explícito.

---

## Seed

`supabase/seed.sql`. **Local e staging. Nunca produção. Nunca dado real.**

Todos os e-mails ficam sob `example.com`, domínio reservado pela IANA para
documentação: não resolve, não recebe, não alcança ninguém. Hartmann e Velmont
são marcas inventadas.

O seed não é enfeite: é a **pré-condição da suíte de isolamento**. Com um
cliente só, "o Cliente A não vê o Cliente B" é uma frase sem teste possível.

| Pessoa           | Papel         | Vínculo              | Serve para                        |
| ---------------- | ------------- | -------------------- | --------------------------------- |
| Marina Duarte    | `boop_admin`  | nenhum               | alcance global sem vínculo (D-08) |
| Ana Prado        | `boop_member` | Hartmann             | membro que vê um lado             |
| Rafa Nunes       | `boop_member` | Velmont              | o outro lado, simétrico           |
| Dani Ferraz      | `boop_member` | **nenhum**           | o caso negativo puro              |
| Cecília Hartmann | `client_user` | Hartmann             | quem aprova, lado A               |
| João Velmont     | `client_user` | Velmont              | quem aprova, lado B               |
| Marta Hartmann   | `client_user` | Hartmann, `disabled` | vínculo sem acesso                |

Os dois projetos estão em **pontos diferentes da jornada** de propósito: se um
dia um vazar para o portal do outro, a diferença salta aos olhos. E há conteúdo
em `idea` e `in_production` nos dois tenants, comentário interno junto de
público, e versão de estratégia em rascunho — porque sem material invisível no
banco, um teste de "o portal esconde o interno" passa por vacuidade.

**Idempotente:** UUIDs fixos e `on conflict do update`. Rodar duas vezes converge
para o mesmo estado. `activity_log` é append-only e por isso é a única parte
protegida por um `not exists`.

**Trava:** o seed aborta se encontrar um cliente fora do conjunto demo. Um banco
com cliente de verdade não é um banco de seed, e é melhor falhar ruidosamente do
que escrever fixture por cima de dado de alguém.

**Nenhuma senha.** Os usuários nascem sem `encrypted_password`: são fixtures de
dados, não credenciais. Login é assunto da FASE 3, por magic link.

---

## Tipos gerados

`src/lib/supabase/database.types.ts` é **gerado**. Editar ali não muda o banco:
só faz o TypeScript mentir sobre ele.

```bash
pnpm db:types
```

Fora do `format:check` e do `eslint` de propósito — é saída de ferramenta, e
corrigir lint em código gerado é trabalho que a próxima regeração desfaz.

Sem Docker, `supabase gen types` não roda (ele sobe um contêiner mesmo com
`--db-url`). Nesse caso os tipos vêm do staging, que tem o mesmo schema porque
saiu das mesmas migrations — e "o mesmo schema" aqui é verificado, não suposto:
ver a seção seguinte.

---

## Conferir que dois bancos são o mesmo

```bash
pnpm db:psql -- -At -f scripts/db/fingerprint.sql
```

Sete hashes: colunas, constraints, índices, triggers, enums, funções de `app` e
configuração de RLS. Rode nos dois lados e compare. É como se verificou que o
Postgres 16 local reconstruído do repositório e o Postgres 17 do staging são o
mesmo banco.

Detalhe que não é detalhe: o script fixa `search_path = pg_catalog`. Sem isso,
`format_type` e `pg_get_*def` escondem o schema dos objetos que estiverem no
caminho de busca, e o **mesmo** schema produz hashes diferentes só porque um
lado tem `extensions` no search_path e o outro não.

---

## Testes

`tests/rls/` — tudo que precisa de Postgres de verdade. Nunca de dublê: um mock
de RLS testaria o mock ([ADR-0015](adr/0015-testes-de-rls-contra-postgres-real.md)).

| Arquivo               | O que prova                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schema.test.ts`      | varredura: RLS em toda tabela, zero privilégio para anon/authenticated, todo `updated_at` com trigger, toda folha com derivação, `app.*` com `search_path` fechado |
| `enums.test.ts`       | `pg_enum` bate com `src/config/enums.ts`, valor a valor e na ordem                                                                                                 |
| `invariants.test.ts`  | derivação, imutabilidade, append-only, idempotência, integridade                                                                                                   |
| `seed.test.ts`        | o elenco de dois tenants existe e é simétrico                                                                                                                      |
| `support/db.ts`       | conexão, identidades, transação com rollback                                                                                                                       |
| `support/fixtures.ts` | os identificadores do seed, com nome                                                                                                                               |

Os invariantes rodam como `service_role` **de propósito**: é o papel que ignora
RLS, o mais poderoso que o sistema usa. Se a regra segura nele, segura em
qualquer um. Isso é o oposto de "provar isolamento com service_role", que seria
um erro — isolamento é RLS, e RLS é a FASE 4.

Cada caso vive numa transação que termina em rollback. Teste que só passa em
certa ordem está errado.

Duas paridades, não uma:

```
Postgres  ⟷  enums.ts     tests/rls/enums.test.ts     precisa de banco
tipos     ⟷  enums.ts     tests/unit/enums.test.ts    não precisa
```

A segunda pega o caso de quem rodou `pnpm db:types` e esqueceu de atualizar
`enums.ts` — e falha para todo mundo, não só para quem tem Postgres rodando.

Há também um **tripwire** deliberado: `file_category`, `meeting_type` e
`meeting_status` existem em TypeScript e ainda não no banco. O teste exige que
continuem ausentes. No dia em que a FASE 12 criar o tipo, ele quebra — e quebrar
é o comportamento certo: é o lembrete de mover a chave para `PG_ENUMS` no mesmo
PR, em vez de deixar as duas fontes divergirem em silêncio.

---

## O que a FASE 2 deliberadamente não fez

- **Políticas de RLS.** São a FASE 4, com a suíte de isolamento junto.
- **Tabelas de arquivo, reunião, métrica e review.** Chegam nas FASES 12–14. O
  ERD do Marco 1 as desenha; o roadmap as constrói depois. Ver
  [`spec-review.md` I-13](spec-review.md).
- **Funções SQL transacionais** (`approve_content_version` e as outras quatro).
  São a FASE 11 ([ADR-0011](adr/0011-workflows-transacionais-em-sql.md)).
- **Buckets de Storage e políticas de `storage.objects`.** FASE 12.
- **Índice em `created_by`, `decided_by`, `author_id`, `submitted_by`.** O linter
  os aponta; eles só pesariam ao APAGAR um perfil, e perfil aqui não é apagado —
  é desabilitado ([ADR-0019](adr/0019-log-append-only-vence-a-exclusao-de-pessoa.md)).
