#!/usr/bin/env bash
# Recupera un backup (fase 4, T12): baja el volcado, lo descifra y lo carga en la base, PISANDO lo
# que haya; y trae de vuelta media/. Con web y worker frenados (infra/server/restore.sh lo hace).
#   restore.sh --list              lista los volcados
#   restore.sh --yes [NOMBRE]      restaura NOMBRE (por defecto, el último)
source /usr/local/bin/backup-common.sh

if [ "${1:-}" = "--list" ]; then
  rclone lsl "$DB_REMOTE" --include 'radev-*.dump.enc' | sort -k4
  exit 0
fi
[ "${1:-}" = "--yes" ] || { echo "Esto pisa la base ${PGDATABASE}. Para confirmar: restore.sh --yes [NOMBRE]"; exit 1; }
name="${2:-$(rclone lsf "$DB_REMOTE" --include 'radev-*.dump.enc' | sort | tail -1)}"
[ -n "$name" ] || { echo "No hay volcados en ${DB_REMOTE}."; exit 1; }

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
log "Bajando ${name}…"
rclone copyto "$DB_REMOTE/$name" "$work/$name" --quiet
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE \
  -in "$work/$name" -out "$work/db.dump" || { echo "No se pudo descifrar: ¿es la misma BACKUP_PASSPHRASE?"; exit 1; }

log "Cargando en ${PGDATABASE} (pisa lo que haya)…"
load-dump.sh "$work/db.dump"

if [ -d "$MEDIA_DIR" ] && [ -w "$MEDIA_DIR" ]; then
  log "Trayendo media/…"
  rclone copy "$MEDIA_REMOTE" "$MEDIA_DIR" --quiet
else
  log "AVISO: ${MEDIA_DIR} no existe o es de solo lectura: media/ no se trajo."
fi
log "Listo: ${name} restaurado."
