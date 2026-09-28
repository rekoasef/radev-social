#!/usr/bin/env bash
# Restaura un backup en producción (fase 4, T12). PISA la base: pide confirmación escrita.
# En el servidor (ssh radev-oracle y después):
#   ~/radev-social/infra/server/restore.sh --list     lista los backups
#   ~/radev-social/infra/server/restore.sh [NOMBRE]    restaura NOMBRE (por defecto, el último)
# Frena web y worker (nadie escribe mientras tanto), restaura la base y media/, y los levanta.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/radev-social}"
cd "$APP_DIR"
compose() { docker compose -f compose.yaml -f compose.prod.yaml "$@"; }
# media/ con permiso de escritura en otra ruta: el servicio la monta de solo lectura.
run_restore() {
  compose run --rm --no-deps -v "$APP_DIR/media:/restore-media" -e MEDIA_DIR=/restore-media \
    backup restore.sh "$@"
}

if [ "${1:-}" = "--list" ]; then
  run_restore --list
  exit 0
fi

echo "Esto REEMPLAZA la base de producción por el backup ${1:-más reciente} y trae media/."
echo "Lo que se haya hecho después de ese backup se pierde."
read -r -p "Para seguir, escribí RESTAURAR: " answer
[ "$answer" = "RESTAURAR" ] || { echo "Cancelado."; exit 1; }

compose stop web worker
trap 'compose up -d web worker' EXIT
run_restore --yes "$@"
echo "Listo. Levantando web y worker…"
