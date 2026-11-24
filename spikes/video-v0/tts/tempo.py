"""Acelera las voces del manifest actual después de generarlas (ElevenLabs llega hasta speed 1,2).

Uso: python3 tts/tempo.py 1.3
Lee out/v0-3/manifest.json (por ejemplo, el de speed 1,2), pasa cada voz por `atempo` de ffmpeg
(cambia la velocidad sin cambiar el tono) con el factor que falta para llegar a la velocidad
pedida, divide los tiempos de cada palabra por ese factor y rellena con silencio hasta un número
entero de cuadros. Deja todo en out/v0-3/x<velocidad>/ (audio/ y manifest.json), para
`pnpm anim --voices out/v0-3/x1.3`.
"""

import json
import math
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "out" / "v0-3"
target = float(sys.argv[1])
manifest = json.loads((SRC / "manifest.json").read_text())
base = manifest.get("speed") or 1.0
factor = target / base
out = SRC / f"x{target}"
(out / "audio").mkdir(parents=True, exist_ok=True)
fps, rate = manifest["fps"], manifest["rate"]
per_frame = rate // fps

scenes = []
for scene in manifest["scenes"]:
    key = scene["key"]
    src = SRC / "audio" / f"{key}.wav"
    dst = out / "audio" / f"{key}.wav"
    tmp = out / "audio" / f"{key}.tmp.wav"
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(src), "-af", f"atempo={factor}",
         "-ar", str(rate), "-ac", "1", "-c:a", "pcm_s16le", str(tmp)],
        check=True,
    )
    with wave.open(str(tmp)) as w:
        samples = w.getnframes()
        data = w.readframes(samples)
    frames = math.ceil(samples / per_frame)
    pad = frames * per_frame - samples
    with wave.open(str(dst), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(data + b"\x00\x00" * pad)
    tmp.unlink()
    words = json.loads((SRC / "audio" / f"{key}.words.json").read_text())
    words = [{**w, "start": w["start"] / factor, "end": w["end"] / factor} for w in words]
    (out / "audio" / f"{key}.words.json").write_text(json.dumps(words, ensure_ascii=False, indent=1))
    scenes.append({**scene, "frames": frames})
    print(f"escena {scene['index'] + 1}: {scene['frames']} → {frames} cuadros")

(out / "manifest.json").write_text(
    json.dumps({**manifest, "speed": target, "atempo": factor, "scenes": scenes}, indent=1)
)
print(f"x{target} (atempo {factor:.4f}): {sum(s['frames'] for s in scenes) / fps:.2f} s en {out}")
