# Backups

Backup diario de producción (fase 4, T12): la base (cifrada) y `media/`, a un almacenamiento externo gratuito compatible con S3. Si el servidor se pierde, con esto y el repo se vuelve a levantar todo en otro.

## Qué hace

El servicio `backup` de `compose.prod.yaml` (imagen `backup` del `Dockerfile`: `postgres:17` + `rclone`), todos los días a las **10:30 UTC = 07:30 de Argentina** (después de la ventana de generación):

1. **Base**: `pg_dump` (formato custom, comprimido), **cifrado** con AES-256 y `BACKUP_PASSPHRASE`, a `db/radev-AAAAMMDD-HHMMSS.dump.enc`. Verifica que lo subido tenga el mismo tamaño.
2. **Media**: `media/` a `media/`, solo lo nuevo (`rclone copy`: lo borrado en el servidor sigue en el backup; los nombres nunca se repiten).
3. **Limpieza**: borra los volcados de más de `BACKUP_KEEP_DAYS` (14) días.
4. Si algo falla, **avisa por Telegram**. Si falta configurar el almacenamiento, avisa una vez que los backups están apagados y el servicio queda quieto.

Corre como el uid 1000 (el de web y worker), así lo que restaura en `media/` se puede seguir escribiendo.

## Configurar el almacenamiento (Backblaze B2, una vez)

B2 da 10 GB gratis (verificar al crear la cuenta que no pida tarjeta; R2 también sirve, con el mismo `.env`).

1. Crear la cuenta en backblaze.com (B2 Cloud Storage).
2. **Buckets → Create a Bucket**: nombre único (ej. `radev-social-backups-<algo>`), **Private**, sin cifrado de B2 (ya va cifrado), sin Object Lock.
3. En el bucket, **Lifecycle Settings → Keep only the last version of the file**. Si no, lo que el backup borra queda como versión oculta y sigue ocupando espacio.
4. Anotar el **Endpoint** del bucket (ej. `s3.us-east-005.backblazeb2.com`); la región es la parte del medio (`us-east-005`).
5. **Application Keys → Add a New Application Key**: acceso **solo a ese bucket**, **Read and Write**. Anotar `keyID` y `applicationKey` (se muestra una sola vez).
6. En el `.env` del servidor:

```
BACKUP_S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com
BACKUP_S3_REGION=us-east-005
BACKUP_S3_BUCKET=radev-social-backups-<algo>
BACKUP_S3_KEY=<keyID>
BACKUP_S3_SECRET='<applicationKey>'
BACKUP_PASSPHRASE='<frase larga>'
```

La frase se genera con `openssl rand -base64 32`. **Guardala también fuera del servidor** (gestor de contraseñas): sin ella los volcados no se pueden abrir, y si se pierde el servidor se pierde con él.

7. `ssh radev-oracle '~/radev-social/infra/server/deploy.sh'` y un backup a mano para probar:

```
ssh radev-oracle 'cd ~/radev-social && docker compose -f compose.yaml -f compose.prod.yaml run --rm backup backup.sh'
```

## Restaurar

En el servidor (`ssh radev-oracle`):

```
~/radev-social/infra/server/restore.sh --list     # los volcados guardados
~/radev-social/infra/server/restore.sh            # el último
~/radev-social/infra/server/restore.sh radev-20261001-103000.dump.enc
```

Pide escribir `RESTAURAR`: **reemplaza la base** por la del backup (lo posterior se pierde). Frena web y worker, carga la base, trae `media/` y los vuelve a levantar.

En un servidor nuevo: `setup.sh`, el mismo `.env` (con la misma `BACKUP_PASSPHRASE`), `deploy.sh` y después `restore.sh`.

## Probado (2026-09-28)

En local, con MinIO en lugar de B2 y una base aparte: backup (volcado cifrado + media), base rota a propósito (nombres cambiados, documentos borrados, una imagen borrada) y restaurada entera; `restore.sh` sin `--yes` y con otra frase se niega; el servicio calcula bien el próximo backup y sin configuración queda quieto.
