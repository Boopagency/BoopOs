#!/usr/bin/env bash
#
# Ponto de entrada de banco em desenvolvimento — escolhe o motor e diz qual usou.
#
#   Com Docker:  `supabase start` / `supabase db reset`. Stack completo:
#                Postgres, GoTrue, PostgREST, Storage. É o caminho oficial.
#
#   Sem Docker:  Postgres nu + shim de auth (scripts/db/local-postgres.sh).
#                Responde "as migrations recriam o banco do zero?" e roda a
#                suíte que precisa de Postgres de verdade. NÃO tem auth nem API.
#
# A escolha nunca é silenciosa: o fallback avisa em toda execução. Um ambiente
# que acha que está rodando Supabase e está rodando outra coisa produz conclusão
# errada — e conclusão errada sobre banco é a categoria de bug mais cara aqui.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOCAL="$ROOT/scripts/db/local-postgres.sh"

tem_docker() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

avisa_fallback() {
  cat >&2 <<'AVISO'
┌─────────────────────────────────────────────────────────────────────────┐
│ Sem Docker: usando Postgres nu + shim de auth, não o Supabase.          │
│                                                                         │
│ Vale para migrations, constraints, triggers, enums e RLS.               │
│ NÃO vale para login, e-mail, Storage nem PostgREST — para isso é        │
│ preciso `supabase start` numa máquina com Docker.                       │
│                                                                         │
│ scripts/db/auth-shim.sql · docs/database.md#sem-docker                  │
└─────────────────────────────────────────────────────────────────────────┘
AVISO
}

cabecalho() {
  cat <<'CAB'
// ─────────────────────────────────────────────────────────────────────────────
// ARQUIVO GERADO. NÃO EDITE À MÃO.
//
//   pnpm db:types
//
// A fonte é o schema, e o schema é `supabase/migrations/`. Editar aqui não
// muda o banco: só faz o TypeScript mentir sobre ele. Mudou uma tabela?
// Migration nova, `pnpm db:reset`, `pnpm db:types`, e commite este arquivo
// junto (.claude/rules/database.md).
//
// Gerado a partir do staging (`boop-os-staging`, sa-east-1), cujo schema é
// idêntico ao local — conferido por `scripts/db/fingerprint.sql`.
//
// Fora do `format:check` de propósito: é saída de ferramenta, e reformatá-la
// só criaria diff a cada regeração (ver .prettierignore).
// ─────────────────────────────────────────────────────────────────────────────

CAB
}

comando="${1:-}"
shift || true

if tem_docker; then
  case "$comando" in
    start)  exec pnpm exec supabase start ;;
    stop)   exec pnpm exec supabase stop ;;
    status) exec pnpm exec supabase status ;;
    reset)  exec pnpm exec supabase db reset ;;
    types)
      # O cabeçalho é regravado junto, senão a regeração o apagaria e o arquivo
      # deixaria de dizer que é gerado.
      {
        cabecalho
        pnpm exec supabase gen types typescript --local --schema public
      } > "$ROOT/src/lib/supabase/database.types.ts"
      echo "→ tipos regenerados em src/lib/supabase/database.types.ts"
      exit 0
      ;;
    psql)   exec "$LOCAL" psql "$@" ;;
    *) echo "uso: $0 start|stop|status|reset|types|psql" >&2; exit 1 ;;
  esac
fi

avisa_fallback

case "$comando" in
  start | stop | status | reset | psql) exec "$LOCAL" "$comando" "$@" ;;
  types)
    # `supabase gen types` sobe um contêiner mesmo com --db-url, então aqui ele
    # não roda. Sem Docker, os tipos vêm do projeto remoto de staging, que tem
    # o mesmo schema porque saiu das mesmas migrations.
    cat >&2 <<'TIPOS'
Geração de tipos exige Docker (`supabase gen types --local`) ou o projeto
remoto. Sem Docker, gere a partir do staging:

  supabase gen types typescript --project-id <ref> --schema public \
    > src/lib/supabase/database.types.ts

Ver docs/database.md#tipos.
TIPOS
    exit 1
    ;;
  *) echo "uso: $0 start|stop|status|reset|types|psql" >&2; exit 1 ;;
esac
