#!/usr/bin/env bash
# Mudanza, parte 2 (fase 4, T13): en el servidor, con el archivo de move-export.sh. REEMPLAZA la
# base del servidor por la local y suma media/. Pide confirmación escrita.
#   ~/radev-social/infra/server/move-import.sh ARCHIVO.tar
# Frena web, worker y backup; carga la base (pg_restore en el contenedor de backup, misma versión
# de Postgres); pone media/ con el dueño de los contenedores (uid 1000); levanta todo y compara.
set -euo pipefail

bundle="$(realpath "${1:?Uso: move-import.sh ARCHIVO.tar}")"
APP_DIR="${APP_DIR:-$HOME/radev-social}"
MEDIA_PATH="${MEDIA_PATH:-$APP_DIR/media}"
cd "$APP_DIR"
export COMPOSE_FILE="${COMPOSE_FILE:-compose.yaml:compose.prod.yaml}"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

tar -C "$work" -xf "$bundle" db.dump media.tar counts.txt
echo "La base del servidor se REEMPLAZA por la de la compu (lo que haya en el servidor se pierde):"
sed 's/^/  /' "$work/counts.txt"
read -r -p "Para seguir, escribí MUDAR: " answer
[ "$answer" = "MUDAR" ] || { echo "Cancelado."; exit 1; }

echo "== Frenando web, worker y backup"
docker compose stop web worker backup
trap 'rm -rf "$work"; docker compose up -d' EXIT

echo "== Base"
db=$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2- | tr -d "'\"")
db=${db:-radev_social}
docker compose up -d postgres >/dev/null
docker compose run --rm --no-deps -v "$work/db.dump:/tmp/db.dump:ro" --entrypoint pg_restore backup \
  --clean --if-exists --no-owner --no-privileges --single-transaction -d "$db" /tmp/db.dump

echo "== media/"
mkdir -p "$MEDIA_PATH"
tar -C "$work" -xf "$work/media.tar"
cp -a "$work/media/." "$MEDIA_PATH/"
if [ -n "$(find "$MEDIA_PATH" ! -uid 1000 -print -quit)" ]; then
  sudo chown -R 1000:1000 "$MEDIA_PATH"
fi
echo "  $(find "$MEDIA_PATH" -type f | wc -l) archivos"

echo "== Comparando"
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F " "' \
  < infra/server/move-counts.sql > "$work/counts-server.txt"
if diff -u "$work/counts.txt" "$work/counts-server.txt" > "$work/diff.txt"; then
  echo "  OK: los conteos coinciden."
else
  echo "  NO coinciden:"; cat "$work/diff.txt"; exit 1
fi
echo "== Listo: levantando todo. Entrá de nuevo al panel (las sesiones viejas no sirven)."
