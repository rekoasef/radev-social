#!/usr/bin/env bash
# Carga un volcado (pg_dump --format=custom) PISANDO la base, en una sola transacción: si algo
# falla, la base queda como estaba. Lo usan restore.sh y la mudanza (infra/server/move-import.sh).
#   load-dump.sh ARCHIVO.dump          (conexión con PGHOST/PGUSER/PGPASSWORD/PGDATABASE)
# No usa `pg_restore --clean`: no puede borrar las tablas particionadas de pg-boss (las
# restricciones de cada partición no se pueden borrar sueltas). Borra los esquemas enteros.
set -euo pipefail

dump="${1:?Uso: load-dump.sh ARCHIVO.dump}"
# Los esquemas que trae el volcado (drizzle, pgboss…) más public, que pg_dump no crea.
schemas=$(pg_restore -l "$dump" | awk '$4 == "SCHEMA" { print $6 }' | sort -u)

{
  echo "BEGIN;"
  echo "SET client_min_messages TO warning;"
  for schema in $schemas public; do echo "DROP SCHEMA IF EXISTS \"${schema}\" CASCADE;"; done
  echo "CREATE SCHEMA public;"
  pg_restore --no-owner --no-privileges -f - "$dump"
  echo "COMMIT;"
} | psql -X -q -v ON_ERROR_STOP=1 --dbname "$PGDATABASE" >/dev/null
