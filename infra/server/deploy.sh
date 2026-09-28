#!/usr/bin/env bash
# Actualiza producción con lo último de main (fase 4, T11): git pull, build en el servidor y
# levantar (decisión 4 del plan de la fase: sin registro de imágenes). Desde la compu del operador:
#   ssh radev-oracle '~/radev-social/infra/server/deploy.sh'
# Las migraciones corren solas (servicio `migrate`, antes de web y worker). Los datos viven en el
# volumen de Postgres y en media/: un deploy no los toca.
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/radev-social}"
cd "$APP_DIR"
compose() { docker compose -f compose.yaml -f compose.prod.yaml "$@"; }

[ -f .env ] || { echo "Falta ${APP_DIR}/.env: corré infra/server/setup.sh."; exit 1; }
if grep -qE '=COMPLETAR' .env; then
  echo "El .env tiene valores sin completar:"
  grep -E '=COMPLETAR' .env | cut -d= -f1 | sed 's/^/  - /'
  exit 1
fi

echo "== Código"
before=$(git rev-parse --short HEAD)
git pull --ff-only --quiet
after=$(git rev-parse --short HEAD)
[ "$before" = "$after" ] && echo "Sin cambios (${after})." || echo "${before} → ${after}: $(git log -1 --format=%s)"

echo "== Build y arranque (el primer build tarda varios minutos)"
compose up -d --build --remove-orphans

echo "== Limpieza de imágenes viejas"
docker image prune -f >/dev/null && echo "OK"

echo "== Estado"
compose ps --format 'table {{.Service}}\t{{.Status}}'

domain=$(grep -E '^APP_DOMAIN=' .env | cut -d= -f2-)
echo "== https://${domain}"
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://${domain}/login" || true)
  [ "$code" = "200" ] && break
  sleep 3
done
if [ "$code" = "200" ]; then
  echo "OK: responde."
else
  echo "No responde todavía (${code:-sin conexión}). Si es el primer deploy: ¿el DNS ya apunta acá?"
  echo "Logs: docker compose -f compose.yaml -f compose.prod.yaml logs --tail 50 caddy web"
  exit 1
fi
