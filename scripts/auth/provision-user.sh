#!/usr/bin/env bash
#
# Cria uma pessoa no Supabase Auth e ajusta o perfil correspondente.
#
#   Nao existe cadastro publico no Boop OS (ADR-0009): todo acesso nasce de um
#   convite. A tela de convite chega na FASE 5. Ate la, este script e o
#   mecanismo controlado para colocar alguem dentro — inclusive o usuario de
#   teste que valida o Magic Link contra o staging.
#
#   O que ele faz:
#     1. cria a linha em `auth.users` pela Admin API (e-mail ja confirmado,
#        sem senha — o login e por link);
#     2. o trigger `on_auth_user_created` cria o espelho em `profiles` com
#        `status = 'invited'`;
#     3. ajusta o papel, se pedido.
#
#   O status fica em `invited` de proposito: e o primeiro login que promove
#   para `active` e registra `user.joined`. Criar ja ativo pularia justamente
#   o caminho que se quer testar.
#
# Uso:
#   scripts/auth/provision-user.sh <email> [client_user|boop_member|boop_admin]
#
# Variaveis (do ambiente ou de .env.local):
#   NEXT_PUBLIC_SUPABASE_URL     projeto alvo
#   SUPABASE_SERVICE_ROLE_KEY    segredo — nunca e impresso por este script
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EMAIL="${1:-}"
ROLE="${2:-client_user}"

if [[ -z "$EMAIL" ]]; then
  echo "uso: scripts/auth/provision-user.sh <email> [client_user|boop_member|boop_admin]" >&2
  exit 64
fi

case "$ROLE" in
  client_user|boop_member) ;;
  boop_admin)
    # Privilegio elevado nunca e default, e nunca e silencioso.
    echo "!! boop_admin enxerga TODOS os clientes. Confirme digitando 'boop_admin':" >&2
    read -r confirmation
    [[ "$confirmation" == "boop_admin" ]] || { echo "cancelado" >&2; exit 1; }
    ;;
  *)
    echo "papel invalido: $ROLE (client_user | boop_member | boop_admin)" >&2
    exit 64
    ;;
esac

# .env.local nunca e commitado; e so a origem local dos valores.
if [[ -f "$ROOT/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env.local"
  set +a
fi

: "${NEXT_PUBLIC_SUPABASE_URL:?defina NEXT_PUBLIC_SUPABASE_URL (ver .env.example)}"
: "${SUPABASE_SERVICE_ROLE_KEY:?defina SUPABASE_SERVICE_ROLE_KEY (ver .env.example)}"

API="${NEXT_PUBLIC_SUPABASE_URL%/}"

echo "→ criando $EMAIL em ${API#https://}"

created="$(
  curl -sS -X POST "$API/auth/v1/admin/users" \
    -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H 'Content-Type: application/json' \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"email": sys.argv[1], "email_confirm": True}))' "$EMAIL")"
)"

user_id="$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("id",""))' <<<"$created")"

if [[ -z "$user_id" ]]; then
  # A resposta pode conter o motivo (e-mail ja existe, projeto errado). Nao
  # contem segredo: a chave viaja em header, nunca no corpo.
  echo "!! Supabase recusou a criacao:" >&2
  python3 -c 'import json,sys; d=json.load(sys.stdin); print(" ", d.get("msg") or d.get("message") or d.get("error_description") or d)' <<<"$created" >&2
  exit 1
fi

echo "→ auth.users: $user_id"

curl -sS -X PATCH "$API/rest/v1/profiles?id=eq.$user_id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Prefer: return=representation' \
  -d "$(python3 -c 'import json,sys; print(json.dumps({"role": sys.argv[1]}))' "$ROLE")" \
  | python3 -c '
import json, sys
rows = json.load(sys.stdin)
if not rows:
    print("!! perfil nao encontrado — o trigger on_auth_user_created rodou?", file=sys.stderr)
    raise SystemExit(1)
row = rows[0]
print(f"→ profiles: role={row[\"role\"]} status={row[\"status\"]}")
'

echo
echo "Pronto. A pessoa esta 'invited': o primeiro login pelo Magic Link"
echo "promove para 'active' e registra user.joined (docs/authentication.md)."
