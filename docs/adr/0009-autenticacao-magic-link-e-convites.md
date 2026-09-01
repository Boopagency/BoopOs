# ADR-0009 — Magic Link e convite sem tabela de convite

**Status:** aceito · **Data:** 2026-09-01 · **Fase:** 0

## Contexto
A §4 define Magic Link como método inicial. O acesso do cliente nasce sempre de
um convite da Boop; não existe cadastro público. Seria natural criar uma tabela
`invitations` com token e expiração.

## Decisão
Supabase Auth com Magic Link (PKCE), sessão em cookie httpOnly via
`@supabase/ssr`, signup público desabilitado. **Não existe tabela de convite:**
convidar cria o usuário em `auth.users`, o `profiles` com `status='invited'` e o
vínculo em `client_memberships`, e dispara o e-mail. O primeiro login promove para
`active` e registra `user.joined`.

## Alternativas consideradas
| Alternativa | Por que não |
| --- | --- |
| Tabela `invitations` com token próprio | Reimplementa expiração, uso único e revogação que o Supabase já faz — e mal |
| Senha + e-mail | Política de senha, reset, vazamento de hash, credential stuffing: superfície inteira que não precisamos |
| OAuth (Google) | O cliente pode não usar Google corporativo; adia decisão sem ganho hoje |

## Consequências
- Menos superfície: sem senha, sem reset, sem tabela de token.
- O vínculo existe antes do primeiro login, então o convite é idempotente por
  `unique (client_id, user_id)`: reconvidar reenvia o link, não duplica nada.
- Existem linhas de usuário para quem nunca entrou. `profiles.status` deixa isso
  explícito no admin.
- O link é credencial: encaminhar o e-mail entrega a conta. Mitigado por
  expiração de 15 min, uso único e aviso no texto.
- Scanner corporativo de e-mail pode consumir o link antes do usuário. Se
  acontecer, a saída é OTP de 6 dígitos (D-06) — o Supabase já suporta, sem
  mudança de arquitetura.

## Gatilho de revisão
Cliente corporativo com SSO obrigatório, ou incidente recorrente de link
consumido por scanner.
