#!/usr/bin/env bash
#
# Postgres local SEM Docker — plano B, nunca o plano A.
#
#   O caminho oficial é `supabase start` (docs/deployment.md). Ele sobe o stack
#   inteiro: Postgres, GoTrue, PostgREST, Storage. Use-o sempre que houver Docker.
#
#   Este script existe para ambientes onde não há daemon de Docker (CI enxuto,
#   contêiner de agente, máquina restrita) e a pergunta a responder é apenas:
#   "as migrations deste repositório recriam o banco do zero?".
#
#   O que ele NÃO dá: auth de verdade, API, Storage. Ver scripts/db/auth-shim.sql.
#
# Uso:
#   scripts/db/local-postgres.sh start|stop|status|reset|psql|url
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGDATA_DIR="${BOOP_PG_DATA:-$ROOT/.tmp/postgres}"
PGPORT="${BOOP_PG_PORT:-54322}"
PGDATABASE="${BOOP_PG_DATABASE:-postgres}"

# A mesma porta do `supabase start` de propósito: a connection string não muda
# conforme o ambiente. Os dois nunca sobem juntos — quem tentar recebe um erro
# de bind, que é a mensagem certa.
PG_URL="postgresql://postgres@127.0.0.1:$PGPORT/$PGDATABASE"

BINDIR="${BOOP_PG_BINDIR:-}"
if [ -z "$BINDIR" ]; then
  for candidate in /usr/lib/postgresql/*/bin; do
    [ -x "$candidate/initdb" ] && BINDIR="$candidate"
  done
fi
if [ -z "$BINDIR" ] || [ ! -x "$BINDIR/initdb" ]; then
  echo "erro: binários do Postgres não encontrados. Defina BOOP_PG_BINDIR." >&2
  exit 1
fi

# Postgres se recusa a rodar como root. Em contêiner de agente, quem executa é
# root, então rebaixamos para o usuário do sistema.
RUN_AS=""
if [ "$(id -u)" -eq 0 ]; then
  if id -u postgres >/dev/null 2>&1; then
    RUN_AS="postgres"
  else
    echo "erro: rodando como root e sem usuário 'postgres' no sistema." >&2
    exit 1
  fi
fi

as_pg() {
  if [ -n "$RUN_AS" ]; then
    su "$RUN_AS" -c "$*"
  else
    eval "$*"
  fi
}

# psql conecta por TCP como superusuário do cluster. O superusuário é sempre
# `postgres`, porque é assim que o initdb abaixo o cria.
pg() {
  PGPASSWORD="" "$BINDIR/psql" \
    --host=127.0.0.1 --port="$PGPORT" --username=postgres --dbname="$PGDATABASE" \
    --no-psqlrc --set ON_ERROR_STOP=1 "$@"
}

is_running() {
  "$BINDIR/pg_isready" --host=127.0.0.1 --port="$PGPORT" --quiet 2>/dev/null
}

do_init() {
  [ -f "$PGDATA_DIR/PG_VERSION" ] && return 0

  echo "→ initdb em $PGDATA_DIR"
  mkdir -p "$PGDATA_DIR"
  if [ -n "$RUN_AS" ]; then
    chown "$RUN_AS" "$PGDATA_DIR"
    chmod 700 "$PGDATA_DIR"
  fi
  as_pg "'$BINDIR/initdb' --pgdata='$PGDATA_DIR' --username=postgres --auth=trust --encoding=UTF8 --locale=C >/dev/null"
}

do_start() {
  if is_running; then
    echo "→ já rodando em $PG_URL"
    return 0
  fi
  do_init
  echo "→ subindo Postgres na porta $PGPORT"
  as_pg "'$BINDIR/pg_ctl' --pgdata='$PGDATA_DIR' --log='$PGDATA_DIR/server.log' \
    --options=\"-p $PGPORT -k '$PGDATA_DIR' -c listen_addresses=127.0.0.1\" \
    --wait start >/dev/null"
  echo "→ pronto: $PG_URL"
}

do_stop() {
  if [ ! -f "$PGDATA_DIR/postmaster.pid" ]; then
    echo "→ não está rodando"
    return 0
  fi
  as_pg "'$BINDIR/pg_ctl' --pgdata='$PGDATA_DIR' --mode=fast --wait stop >/dev/null"
  echo "→ parado"
}

do_status() {
  if is_running; then
    echo "up   $PG_URL"
  else
    echo "down $PG_URL"
  fi
}

# Recria o banco DO ZERO. É o gate da FASE 2: banco vazio → migrations → seed.
do_reset() {
  do_start

  echo "→ recriando o banco '$PGDATABASE'"
  PGPASSWORD="" "$BINDIR/psql" \
    --host=127.0.0.1 --port="$PGPORT" --username=postgres --dbname=template1 \
    --no-psqlrc --set ON_ERROR_STOP=1 --quiet \
    --command="drop database if exists $PGDATABASE with (force);" \
    --command="create database $PGDATABASE;"

  echo "→ shim de auth (local; não é Supabase)"
  pg --quiet --file "$ROOT/scripts/db/auth-shim.sql"

  for file in "$ROOT"/supabase/migrations/*.sql; do
    echo "→ migration $(basename "$file")"
    pg --quiet --file "$file"
  done

  if [ "${BOOP_PG_SEED:-1}" = "1" ] && [ -f "$ROOT/supabase/seed.sql" ]; then
    echo "→ seed"
    pg --quiet --file "$ROOT/supabase/seed.sql"
  fi

  echo "→ banco recriado do zero em $PG_URL"
}

case "${1:-}" in
  start)  do_start ;;
  stop)   do_stop ;;
  status) do_status ;;
  reset)  do_reset ;;
  url)    echo "$PG_URL" ;;
  psql)   shift; pg "$@" ;;
  *)
    echo "uso: $0 start|stop|status|reset|psql|url" >&2
    exit 1
    ;;
esac
