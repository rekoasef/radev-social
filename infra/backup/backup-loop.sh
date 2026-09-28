#!/usr/bin/env bash
# El servicio `backup` (fase 4, T12): espera la hora del backup (BACKUP_TIME_UTC, 10:30 = 07:30 de
# Argentina, después de la ventana de generación) y lo corre, todos los días.
set -uo pipefail
TIME="${BACKUP_TIME_UTC:-10:30}"

log() { echo "$(date -u '+%Y-%m-%d %H:%M:%S') $*"; }

# Sin almacenamiento configurado (por ejemplo, antes de crear la cuenta) no hay backups: se avisa
# una vez y el servicio queda quieto, sin reiniciarse en bucle.
missing=()
for var in BACKUP_S3_ENDPOINT BACKUP_S3_BUCKET BACKUP_S3_KEY BACKUP_S3_SECRET BACKUP_PASSPHRASE; do
  [ -n "${!var:-}" ] || missing+=("$var")
done
if [ "${#missing[@]}" -gt 0 ]; then
  log "Backups APAGADOS: falta ${missing[*]} en el .env (ver infra/backup/README.md)."
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -o /dev/null -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=⚠️ RAdev Social: los backups están apagados (falta configurar el almacenamiento)." || true
  fi
  exec sleep infinity
fi

log "Backup diario a las ${TIME} UTC."
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "today ${TIME}" +%s)
  [ "$next" -gt "$now" ] || next=$(date -u -d "tomorrow ${TIME}" +%s)
  log "Próximo: $(date -u -d "@${next}" '+%Y-%m-%d %H:%M') UTC."
  sleep $((next - now))
  backup.sh || log "El backup falló (ya se avisó)."
done
