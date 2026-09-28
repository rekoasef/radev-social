#!/usr/bin/env bash
# Un backup (fase 4, T12): volcado de Postgres cifrado + media/ incremental al almacenamiento S3,
# y borra los volcados de más de BACKUP_KEEP_DAYS días. Se puede correr a mano:
#   docker compose -f compose.yaml -f compose.prod.yaml run --rm backup backup.sh
source /usr/local/bin/backup-common.sh

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
stamp=$(date -u '+%Y%m%d-%H%M%S')
name="radev-${stamp}.dump.enc"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fail() {
  log "ERROR: $1"
  telegram "❌ Backup de RAdev Social: falló (${1}). Revisá: docker compose logs backup"
  exit 1
}

log "Volcado de ${PGDATABASE}…"
# Formato custom de pg_dump (ya comprimido), cifrado con AES-256 y la frase del .env.
pg_dump --format=custom --no-owner --no-privileges 2>"$work/pg_dump.err" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$work/$name" \
  || fail "pg_dump: $(tail -1 "$work/pg_dump.err")"
[ -s "$work/$name" ] || fail "el volcado quedó vacío"
size=$(stat -c %s "$work/$name")

log "Subiendo ${name} ($((size / 1024)) KB)…"
rclone copyto "$work/$name" "$DB_REMOTE/$name" --quiet || fail "no se pudo subir el volcado"
# Verifica que lo subido tenga el mismo tamaño.
remote_size=$(rclone size "$DB_REMOTE/$name" --json 2>/dev/null | sed -E 's/.*"bytes":([0-9]+).*/\1/')
[ "$remote_size" = "$size" ] || fail "el volcado subido no coincide (${remote_size:-?} de ${size} bytes)"

if [ -d "$MEDIA_DIR" ]; then
  log "Media (solo lo nuevo)…"
  # copy, no sync: lo borrado en el servidor sigue en el backup (los nombres nunca se repiten).
  rclone copy "$MEDIA_DIR" "$MEDIA_REMOTE" --quiet --exclude '.*' || fail "no se pudo subir media/"
fi

log "Borrando volcados de más de ${KEEP_DAYS} días…"
rclone delete "$DB_REMOTE" --min-age "${KEEP_DAYS}d" --include 'radev-*.dump.enc' --quiet \
  || log "AVISO: no se pudieron borrar los volcados viejos."

count=$(rclone lsf "$DB_REMOTE" --include 'radev-*.dump.enc' | wc -l)
log "Listo: ${name} · ${count} volcados guardados."
