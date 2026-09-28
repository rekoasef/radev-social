#!/usr/bin/env bash
# Mudanza, parte 1 (fase 4, T13): en la compu del operador, desde la raíz del repo. Arma un archivo
# con la base local (pg_dump del Postgres de Docker), media/ y los conteos para comparar después.
#   infra/server/move-export.sh [SALIDA.tar]     (por defecto /tmp/radev-move-AAAAMMDD-HHMMSS.tar)
# Mejor con `pnpm dev` frenado: que nada escriba mientras tanto.
set -euo pipefail

cd "$(dirname "$0")/../.."
out="${1:-/tmp/radev-move-$(date +%Y%m%d-%H%M%S).tar}"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
# Local: el compose de desarrollo (sus variables vienen del .env de la raíz).
pg() { docker compose exec -T postgres "$@"; }
user=$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2- | tr -d "'\"")
db=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2- | tr -d "'\"")
user=${user:-radev}; db=${db:-radev_social}

if curl -s -o /dev/null --max-time 2 http://localhost:3000; then
  echo "AVISO: la web local está andando (¿pnpm dev?). Lo que se haga mientras tanto no viaja."
fi

echo "== Base local (${db})"
pg pg_dump --format=custom --no-owner --no-privileges -U "$user" -d "$db" > "$work/db.dump"
pg psql -U "$user" -d "$db" -At -F ' ' < infra/server/move-counts.sql > "$work/counts.txt"
sed 's/^/  /' "$work/counts.txt"

echo "== media/"
tar -C . -cf "$work/media.tar" --exclude='.*' media
echo "  $(tar -tf "$work/media.tar" | grep -vc '/$') archivos"

tar -C "$work" -cf "$out" db.dump media.tar counts.txt
echo "== Listo: ${out} ($(du -h "$out" | cut -f1))"
