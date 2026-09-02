# Autenticação — Boop OS

Como uma pessoa entra, como a sessão se mantém, e onde a identidade vira
decisão. O raciocínio sobre ameaças está em [`security.md`](security.md); aqui
está o **como**.

A promessa desta camada cabe em uma frase:

> **O Boop OS sabe quem é a pessoa em todo request, e descobre isso no
> servidor.**

---

## Estado atual

**FASE 3 concluída.** Magic Link com PKCE, sessão SSR em cookie, `proxy.ts`
renovando o token, `getActor()`/`requireActor()`, rotas protegidas e logout.

**A autorização multi-tenant NÃO está pronta.** A RLS continua ligada e sem
políticas, e o Actor desta fase carrega identidade — não carrega escopo. Saber
quem é a pessoa não é saber o que ela pode ver: isso é a **FASE 4**.

Enquanto isso durar, `getActor()` lê `profiles` pela `service_role`
([ADR-0021](adr/0021-service-role-para-resolver-identidade.md)), e nenhuma tela
do portal está ligada a dado real.

---

## O fluxo

```
/login  ─ Server Action ─→  signInWithOtp
                              shouldCreateUser: false
                              emailRedirectTo: <APP_URL>/auth/callback
                              ↓  grava o code verifier (PKCE) em cookie
                              ↓  grava o destino pedido em cookie
                            e-mail com link
                              ↓  a pessoa clica
                            /auth/v1/verify  (Supabase)
                              ↓  redireciona
/auth/callback ─ Route Handler ─→ exchangeCodeForSession(code)
                              ↓  cookie de sessão httpOnly
                            recordFirstLogin()   invited → active + user.joined
                              ↓
                            safe redirect  →  /portal
```

**O `code` sozinho não vale nada.** Ele só vira sessão junto do _code verifier_
que o `signInWithOtp` gravou no navegador de quem pediu o link. É o que faz um
e-mail encaminhado a terceiro não entregar a conta — a mitigação do
[R-12](spec-review.md).

### Magic Link, e só

Sem senha, sem OAuth, sem MFA, sem passkey (D-06). Menos superfície: nada de
política de senha, reset, vazamento de hash ou credential stuffing.

**Não existe cadastro público.** `shouldCreateUser: false` na chamada, signup
desligado no projeto, e nenhuma tela que crie conta. Todo acesso nasce de um
convite ([ADR-0009](adr/0009-autenticacao-magic-link-e-convites.md)); a tela de
convite chega na FASE 5, e até lá o caminho controlado é
`scripts/auth/provision-user.sh`.

### Enumeração de e-mail

A tela responde a mesma coisa exista ou não a conta: _"Se este e-mail tiver
acesso, o link chega em instantes."_ Os erros do Supabase que revelariam a
existência da conta (`otp_disabled`, `user_not_found`, `signup_disabled`,
`email_address_not_authorized`, `user_banned`) são silenciados em
`src/lib/auth/errors.ts`, com teste.

Sem isso, o formulário de login seria um consultor gratuito de quem é cliente
da Boop.

---

## Sessão

Cookie `httpOnly`, `Secure`, `SameSite=Lax`, gerenciado pelo `@supabase/ssr`. O
JWT nunca vai para `localStorage`, e nunca trafega por props de React.

**Quem renova é o `proxy.ts`** ([ADR-0020](adr/0020-proxy-renova-sessao-e-nao-autoriza.md)).
Um Server Component não pode escrever cookie — o Next só aceita `set` em Server
Action ou Route Handler —, então uma renovação feita durante o render se
perderia. O par que faz isso funcionar:

| Onde                         | Faz                                                                |
| ---------------------------- | ------------------------------------------------------------------ |
| `src/proxy.ts`               | renova o cookie, redireciona quem não tem sessão. **Não autoriza** |
| `src/lib/supabase/proxy.ts`  | monta o cliente ligado ao request/response e chama `getUser()`     |
| `src/lib/supabase/server.ts` | cliente das páginas e actions; `setAll` engole o erro de escrita   |

`getUser()`, e não `getSession()`: o segundo apenas decodifica o cookie, que
foi enviado pelo navegador. Onde o resultado decide acesso, o token é validado
com o servidor de Auth.

Sessão que não pode ser renovada não vira loop: o `@supabase/ssr` limpa os
cookies, o proxy leva os cookies limpos junto no redirect, e a pessoa cai no
login uma vez — não a cada request.

---

## O Actor

```ts
type Actor = {
  userId: string
  email: string
  fullName: string | null
  role: 'boop_admin' | 'boop_member' | 'client_user'
  status: 'invited' | 'active' | 'disabled'
}
```

Carregado uma vez por request (`cache` do React) e passado adiante. **Nunca**
reconstruído a partir de dado enviado pelo cliente.

Falta o `clientIds` que [`security.md`](security.md#o-actor) desenha, e a falta
é deliberada: vínculo é **escopo**, escopo é autorização, autorização é a FASE 4. Quando as políticas existirem, o vínculo vem das funções `app.*` sob RLS — e
não de uma consulta que ignora RLS.

### `getActor()` · `requireActor()`

`getActor()` devolve o Actor ou `null`. `requireActor()` é o guard: devolve o
Actor ou redireciona.

**Fail closed.** Toda dúvida nega:

| Situação                              | O que acontece                                |
| ------------------------------------- | --------------------------------------------- |
| Sem sessão                            | `/login`                                      |
| Token recusado pelo Auth              | `/login`                                      |
| Sessão válida, `profiles` sem a linha | `/login` + `logger.warn`. **Não cria perfil** |
| `status = 'disabled'`                 | `/login?erro=access_revoked`                  |
| `status = 'invited'`                  | `/login?erro=activation_pending`              |
| Leitura do perfil falha               | `/login`                                      |

Perfil inexistente é estado inconsistente, não usuário novo: criar a linha ali
seria inventar papel para quem o trigger de `auth.users` não registrou.

`disabled` é barrado aqui, e não no proxy — é isso que faz a revogação valer
**no request seguinte**, sem esperar o JWT (que vive ~1 h) expirar.

### Uma rota nunca fica estática por acidente

`getActor()` lê o cookie **antes** de qualquer atalho. Não é estilo: com o
atalho de configuração na frente, o build prerenderizava a rota protegida com a
resposta "ninguém logado" e servia um redirect fixo para `/login` — para todo
mundo, inclusive para quem tinha sessão. Há teste de regressão.

---

## Rotas

| Públicas              | Protegidas (exigem Actor ativo) |
| --------------------- | ------------------------------- |
| `/login`              | `/` (decide destino)            |
| `/auth/callback`      | `/portal/**`                    |
| assets, `/robots.txt` | `/admin/**`                     |
|                       | `/bem-vindo`                    |

A fronteira é o **layout do grupo**, não um `if` espalhado por componente:
`(portal)/layout.tsx` e `(admin)/layout.tsx` chamam `requireActor()`, e toda
rota do grupo herda.

`/admin` tem, além disso, um gate de papel: `client_user` recebe **404** — não
403, que confirmaria a existência da área. É o mínimo para a área interna não
ficar aberta entre as FASES 3 e 4; vira `requireBoop()` na FASE 4.

### Redirect seguro

`safeNextPath()` (`src/lib/auth/routes.ts`) valida todo destino antes de virar
redirect. Só caminho interno passa. Recusa URL absoluta, `//host`, `/\host`,
caractere de controle e volta para o próprio login/callback.

Sem isso, `/login?next=https://evil.example` faria o produto entregar a pessoa
autenticada em outro domínio.

**O destino não viaja na URL do Magic Link.** Ele é gravado em cookie
(`boop-auth-next`, httpOnly, 15 min) quando o link é pedido, e lido — e
revalidado — no callback. Duas razões:

- **Operacional:** o `emailRedirectTo` é conferido contra a lista de Redirect
  URLs do Supabase. Query string ali obrigaria a cadastrar curinga, e um
  curinga aceita como destino de sessão qualquer URL que case com o padrão.
  Sem query, a lista fica exata.
- **De segurança:** no cookie, o destino pertence ao navegador que pediu o
  link — não a quem abrir o e-mail.

### Logout

Server Action (`signOut`), nunca GET: um `/logout` por GET é disparável por um
`<img src>` de terceiro. `supabase.auth.signOut()` derruba a sessão, os cookies
somem e o redirect vai para `/login`. Depois disso, rota protegida bloqueia.

---

## Ambientes

| Onde        | Aplicação  | Auth                                 |
| ----------- | ---------- | ------------------------------------ |
| local       | `pnpm dev` | `supabase start` (precisa de Docker) |
| **staging** | **Vercel** | **`boop-os-staging`** · `sa-east-1`  |
| produção    | FASE 20    | não existe                           |

O ambiente de validação manual é o **hospedado**: Vercel apontando para o
`boop-os-staging`. O container e a máquina local servem para tooling,
migrations e testes automatizados. Sem Docker não há GoTrue local, então o
Magic Link não é exercitável ali — o plano B (`scripts/db/local-postgres.sh`)
cobre migrations e RLS, e nunca cobriu login.

### Variáveis

| Nome                            | Onde                         |
| ------------------------------- | ---------------------------- |
| `NEXT_PUBLIC_APP_URL`           | origem canônica da aplicação |
| `NEXT_PUBLIC_SUPABASE_URL`      | projeto Supabase             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública                |
| `SUPABASE_SERVICE_ROLE_KEY`     | **server-only**              |

`NEXT_PUBLIC_APP_URL` é a origem de todo link de retorno. O `Host` e o
`X-Forwarded-Host` do request **não** são usados para montar o destino do Magic
Link: são controláveis pelo cliente, e um link de entrada apontando para o host
que o atacante escolheu entregaria a sessão.

### Configuração do projeto Supabase

O `supabase/config.toml` governa **apenas o ambiente local**. O projeto
hospedado é configurado no painel, e precisa combinar:

- signup público **desligado**;
- expiração do link em **900 s** (15 min) — a tela promete isso em texto;
- **Site URL** = a URL estável da aplicação;
- **Redirect URLs** = `<APP_URL>/auth/callback`, lista exata. Sem curinga:
  um `*.vercel.app` aceitaria qualquer preview como destino de sessão.

### E-mail

O e-mail de autenticação sai pelo **Supabase Auth**, não pelo `EmailService`
([ADR-0010](adr/0010-email-auth-vs-produto.md)). O SMTP customizado apontando
para o Resend é FASE 5; até lá vale o remetente padrão do Supabase, com o
limite de envio do plano gratuito. O template de auth mora no painel, fora do
repositório.

---

## Provisionar uma pessoa

```bash
scripts/auth/provision-user.sh <email> [client_user|boop_member|boop_admin]
```

Cria a linha em `auth.users` pela Admin API; o trigger cria o espelho em
`profiles` com `status = 'invited'`; o script ajusta o papel.

O status fica em `invited` de propósito — é o primeiro login que promove para
`active` e registra `user.joined`. Criar já ativo pularia justamente o caminho
que se quer testar. `boop_admin` exige confirmação digitada: privilégio elevado
nunca é default.

---

## O que esta camada NÃO faz

- Não decide o que a pessoa pode ver. Isso é a FASE 4.
- Não resolve vínculo, cliente nem projeto.
- Não protege dado: as telas do portal leem mocks, e a RLS não tem políticas.
- Não cria conta, não recupera senha, não tem senha.

Ler "autenticação pronta" como "multi-tenant seguro" é o erro que esta seção
existe para impedir.
