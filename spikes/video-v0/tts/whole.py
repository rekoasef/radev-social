"""Voz: toda la narración en UN solo pedido a ElevenLabs, cortada por escena con los tiempos de
las palabras. Sin atempo. Para comparar con scenes.py (un pedido por escena + atempo), que sonó
robótico y lento.

Uso: python3 tts/whole.py texts/v0-11-mona.json --tag fran-v2 \
        [--voice 0bu1GUsOfNJYyXbmSTxD] [--model eleven_multilingual_v2] [--speed 1.15]
Escribe out/v0-12/<tag>/manifest.json y audio/<clave>.wav + .words.json, el mismo formato que
scenes.py, así que sirve directo para `pnpm anim --guion ... --voices out/v0-12/<tag>`.
También deja full.mp3 (la toma entera, para escucharla sola).

El corte entre dos escenas cae en la mitad del silencio entre la última palabra de una y la
primera de la siguiente: la pausa natural queda repartida y la entonación no se reinicia.
"""

import base64
import json
import math
import subprocess
import sys
from pathlib import Path

from cloud import env, http
from eleven_words import words_from_chars

HERE = Path(__file__).resolve().parent
FPS, RATE = 30, 48_000
PER_FRAME = RATE // FPS


def arg(args: list[str], name: str, default: str | None) -> str | None:
    if name in args:
        at = args.index(name)
        val = args[at + 1]
        del args[at:at + 2]
        return val
    return default


def main() -> None:
    args = sys.argv[1:]
    tag = arg(args, "--tag", None) or sys.exit("falta --tag")
    voice = arg(args, "--voice", "0bu1GUsOfNJYyXbmSTxD")
    model = arg(args, "--model", "eleven_multilingual_v2")
    # 1,15: el operador pidió "un poquito menos rápida" que 1,2 (2026-11-24). "--speed none" usa la
    # velocidad guardada en la voz.
    speed = arg(args, "--speed", "1.15")
    if speed == "none":
        speed = None
    texts: list[str] = json.loads((HERE / args[0]).read_text())
    out = HERE.parent / "out" / "v0-12" / tag
    (out / "audio").mkdir(parents=True, exist_ok=True)

    key = env()["ELEVENLABS_API_KEY"]
    body: dict = {"text": " ".join(texts), "model_id": model}
    if speed:
        stored = json.loads(http(f"https://api.elevenlabs.io/v1/voices/{voice}/settings", None,
                                 {"xi-api-key": key}))
        body["voice_settings"] = {**stored, "speed": float(speed)}
    data = json.loads(http(f"https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps",
                           json.dumps(body).encode(),
                           {"xi-api-key": key, "Content-Type": "application/json"}))
    (out / "full.mp3").write_bytes(base64.b64decode(data["audio_base64"]))
    words = words_from_chars(data["alignment"])
    (out / "full.words.json").write_text(json.dumps(words, ensure_ascii=False, indent=1))
    split_scenes(out, tag, texts, words, out / "full.mp3",
                 {"source": args[0], "voice": voice, "model": model, "speed": speed})
    print(f"{len(body['text'])} caracteres")


def pcm(audio: Path) -> bytes:
    return subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ar", str(RATE), "-ac", "1",
                           "-f", "s16le", "-"], check=True, capture_output=True).stdout


def split_scenes(out: Path, tag: str, texts: list[str], words: list[dict], audio: Path,
                 meta: dict) -> None:
    """Corta la toma entera por escena y escribe manifest.json + audio/ (formato de scenes.py).
    `words` tiene que traer exactamente las palabras del texto, en orden, con tiempos absolutos."""
    (out / "audio").mkdir(parents=True, exist_ok=True)
    raw = pcm(audio)
    total = len(raw) // 2
    counts = [len(t.split()) for t in texts]
    if sum(counts) != len(words):
        sys.exit(f"palabras del texto {sum(counts)} ≠ palabras de la voz {len(words)}")
    # Cortes (en muestras): inicio, mitad de cada pausa entre escenas, final.
    cuts, at = [0], 0
    for n in counts[:-1]:
        at += n
        mid = (words[at - 1]["end"] + words[at]["start"]) / 2
        cuts.append(round(mid * RATE))
    cuts.append(total)

    scenes, at = [], 0
    for i, text in enumerate(texts):
        a, b = cuts[i], cuts[i + 1]
        chunk = raw[a * 2:b * 2]
        frames = math.ceil((b - a) / PER_FRAME)
        chunk += b"\0\0" * (frames * PER_FRAME - (b - a))
        k = f"{tag}-{i}"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "s16le", "-ar", str(RATE), "-ac", "1",
                        "-i", "-", str(out / "audio" / f"{k}.wav")], input=chunk, check=True)
        off = a / RATE
        ws = [{**w, "start": round(w["start"] - off, 3), "end": round(w["end"] - off, 3)}
              for w in words[at:at + counts[i]]]
        at += counts[i]
        (out / "audio" / f"{k}.words.json").write_text(json.dumps(ws, ensure_ascii=False, indent=1))
        scenes.append({"index": i, "key": k, "frames": frames, "text": text})
        print(f"escena {i + 1}: {frames:4d} cuadros ({frames / FPS:5.2f} s)")
    (out / "manifest.json").write_text(json.dumps(
        {**meta, "fps": FPS, "rate": RATE, "scenes": scenes}, ensure_ascii=False, indent=1))
    print(f"{tag}: {total / RATE:.2f} s · {out}")


if __name__ == "__main__":
    main()
