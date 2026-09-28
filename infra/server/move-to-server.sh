#!/usr/bin/env bash
# Mudanza completa (fase 4, T13), desde la raíz del repo en la compu del operador: exporta la base
# local y media/, las manda al servidor y las importa ahí (pide escribir MUDAR).
#   infra/server/move-to-server.sh
set -euo pipefail
HOST="${HOST:-radev-oracle}"
cd "$(dirname "$0")/../.."
bundle="/tmp/radev-move-$(date +%Y%m%d-%H%M%S).tar"
infra/server/move-export.sh "$bundle"
echo "== Enviando a ${HOST}"
scp -q "$bundle" "${HOST}:/tmp/"
ssh -t "$HOST" "~/radev-social/infra/server/move-import.sh /tmp/$(basename "$bundle"); rm -f /tmp/$(basename "$bundle")"
rm -f "$bundle"
