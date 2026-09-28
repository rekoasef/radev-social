#!/usr/bin/env bash
# Lo que comparten backup.sh y restore.sh (fase 4, T12). Se incluye con `source`.
# Variables (compose.prod.yaml): PGHOST/PGUSER/PGPASSWORD/PGDATABASE de Postgres; BACKUP_S3_ENDPOINT,
# BACKUP_S3_REGION (opcional), BACKUP_S3_BUCKET, BACKUP_S3_KEY, BACKUP_S3_SECRET del almacenamiento;
# BACKUP_PASSPHRASE cifra los volcados; MEDIA_DIR; TELEGRAM_* para avisar si falla.
set -euo pipefail

need() { [ -n "${!1:-}" ] || { echo "Falta ${1} (ver infra/backup/README.md)." >&2; exit 1; }; }
for var in PGHOST PGUSER PGPASSWORD PGDATABASE BACKUP_S3_ENDPOINT BACKUP_S3_BUCKET BACKUP_S3_KEY \
  BACKUP_S3_SECRET BACKUP_PASSPHRASE; do need "$var"; done

MEDIA_DIR="${MEDIA_DIR:-/data/media}"

# rclone sin archivo de config: un remoto "store" de tipo S3 (sirve para B2, R2 y MinIO).
# Un archivo vacío, así no avisa que falta uno; todo va por estas variables.
export RCLONE_CONFIG="${TMPDIR:-/tmp}/rclone-empty.conf"
: > "$RCLONE_CONFIG"
export RCLONE_CONFIG_STORE_TYPE=s3
export RCLONE_CONFIG_STORE_PROVIDER=Other
export RCLONE_CONFIG_STORE_ENDPOINT="$BACKUP_S3_ENDPOINT"
export RCLONE_CONFIG_STORE_REGION="${BACKUP_S3_REGION:-}"
export RCLONE_CONFIG_STORE_ACCESS_KEY_ID="$BACKUP_S3_KEY"
export RCLONE_CONFIG_STORE_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET"
# El bucket lo crea el operador; la llave puede no tener permiso para crearlo.
export RCLONE_CONFIG_STORE_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_STORE_FORCE_PATH_STYLE=true
DB_REMOTE="store:${BACKUP_S3_BUCKET}/db"
MEDIA_REMOTE="store:${BACKUP_S3_BUCKET}/media"

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S') $*"; }

# Aviso por Telegram (el token nunca se imprime). Sin Telegram configurado, solo queda en el log.
telegram() {
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ] || return 0
  curl -s -o /dev/null -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text=$1" || true
}
