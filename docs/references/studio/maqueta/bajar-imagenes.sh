#!/usr/bin/env bash
# Baja de Wikimedia Commons las miniaturas (480 px) que usan las maquetas de aprobar guion y video.
# Son las candidatas del fixture de la Mona Lisa; no se guardan en git (quedan en maqueta/img/).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
fixture="$here/../../../../packages/video/test/fixtures/mona-candidates.json"
mkdir -p "$here/img"
python3 - "$fixture" <<'EOF' | while read -r id file; do
import json, sys
wanted = "i01 i03 i04 i05 i06 i07 i08 i09 i11 i14 i20 i23 i24 i25 i26 i28 i30 i33".split()
for c in json.load(open(sys.argv[1])):
    if c["id"] in wanted:
        print(c["id"], c["page"].split("File:")[1])
EOF
  [ -s "$here/img/$id.jpg" ] && continue
  curl -sfL -A "radev-studio-mockups/0.1" -o "$here/img/$id.jpg" \
    "https://commons.wikimedia.org/wiki/Special:FilePath/$file?width=480" || echo "no se pudo bajar $id"
  sleep 0.4
done
ls "$here/img" | wc -l
