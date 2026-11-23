"""V0-2: pasa los tiempos de las palabras fonéticas a las palabras del texto.

Los números y símbolos se expanden al pronunciarse ("1978" -> "mil novecientos
setentaiocho"), así que cada palabra del texto se convierte por separado con el
mismo espeak y se cuenta cuántas palabras fonéticas le tocan.

Uso: python align.py <voz> [es|es-419|en]
Salida: out/tts/samples/<voz>.words.json  [{word, start, end}]
"""

import json
import sys
from pathlib import Path

from misaki.espeak import EspeakG2P

HERE = Path(__file__).resolve().parent
SAMPLES = HERE.parent / "out" / "tts" / "samples"


def main() -> None:
    voice, lang = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "es-419"
    text = (HERE / "texts" / f"{lang[:2]}.txt").read_text().strip()
    phon = json.loads((SAMPLES / f"{voice}.json").read_text())
    g2p = EspeakG2P(language=lang if lang != "en" else "en-us")

    words, i = [], 0
    for w in text.split():
        ps, _ = g2p(w)
        n = max(1, len([p for p in ps.split() if any(c.isalpha() for c in p)]))
        group = phon[i : i + n]
        if not group:
            break
        words.append({"word": w, "start": group[0]["start"], "end": group[-1]["end"], "n": n})
        i += n

    ok = i == len(phon) and len(words) == len(text.split())
    out = SAMPLES / f"{voice}.words.json"
    out.write_text(json.dumps(words, ensure_ascii=False, indent=1))
    print(f"{voice}: {len(words)}/{len(text.split())} palabras, "
          f"{i}/{len(phon)} fonéticas usadas -> {'OK' if ok else 'DESCUADRE'}")
    for x in words:
        if x["n"] > 1:
            print(f"  {x['word']:12} {x['start']:6.2f}-{x['end']:6.2f} s  ({x['n']} fonéticas)")


if __name__ == "__main__":
    main()
