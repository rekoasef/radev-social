"""V0-2b: tiempos por carácter de ElevenLabs -> palabras del texto, y audio en WAV.

Uso: python eleven_words.py eleven-fran [eleven-juan ...]
Lee out/tts/cloud/<voz>.mp3 y <voz>.alignment.json; escribe en out/tts/samples/
<voz>.wav y <voz>.words.json (mismo formato que align.py, para la composición `captions`).
"""

import json
import subprocess
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "out" / "tts"


def words_from_chars(al: dict) -> list[dict]:
    words, cur, start, end = [], "", None, 0.0
    for ch, s, e in zip(al["characters"], al["character_start_times_seconds"],
                        al["character_end_times_seconds"], strict=True):
        if ch.isspace():
            if cur:
                words.append({"word": cur, "start": round(start, 3), "end": round(end, 3)})
            cur, start = "", None
            continue
        if start is None:
            start = s
        cur, end = cur + ch, e
    if cur:
        words.append({"word": cur, "start": round(start, 3), "end": round(end, 3)})
    return words


for voice in sys.argv[1:]:
    al = json.loads((OUT / "cloud" / f"{voice}.alignment.json").read_text())
    words = words_from_chars(al)
    (OUT / "samples" / f"{voice}.words.json").write_text(json.dumps(words, ensure_ascii=False, indent=1))
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(OUT / "cloud" / f"{voice}.mp3"),
                    "-ar", "24000", "-ac", "1", "-map_metadata", "-1", "-fflags", "+bitexact",
                    str(OUT / "samples" / f"{voice}.wav")], check=True)
    print(f"{voice}: {len(words)} palabras, {words[0]['start']}–{words[-1]['end']} s · "
          f"últimas: {' '.join(w['word'] for w in words[-4:])}")
