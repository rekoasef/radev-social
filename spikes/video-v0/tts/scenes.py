"""V0-3: voz de cada escena con ElevenLabs (Fran), con caché por hash.

Uso: python3 tts/scenes.py [texts/scenes-es.json]
Por escena escribe en out/v0-3/audio/:
  <clave>.wav         48 kHz mono PCM, con un silencio al final hasta un número exacto de cuadros
  <clave>.words.json  palabras con tiempos relativos al inicio de la escena
y deja out/v0-3/manifest.json con el orden, la clave y los cuadros de cada escena.

La clave es un hash de voz + modelo + texto + parámetros: si no cambió, no se vuelve a pedir
(no gasta caracteres). `previous_text`/`next_text` se mandan para que la entonación siga el hilo,
pero no entran en la clave: cambiar una escena no obliga a rehacer las vecinas.
"""

import base64
import hashlib
import json
import math
import subprocess
import sys
import time
import wave
from pathlib import Path

from cloud import ELEVEN_MODEL, env, http
from eleven_words import words_from_chars

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "out" / "v0-3"
AUDIO = OUT / "audio"

VOICE = ("0bu1GUsOfNJYyXbmSTxD", "fran")
FPS = 30
RATE = 48_000  # 48000 / 30 = 1600 muestras por cuadro, entero
TAIL = 0.25  # segundos de aire al final de cada escena, antes de redondear a cuadros


def key_of(text: str) -> str:
    raw = json.dumps({"voice": VOICE[0], "model": ELEVEN_MODEL, "text": text, "fps": FPS,
                      "rate": RATE, "tail": TAIL}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def synth(api_key: str, text: str, prev: str, nxt: str) -> tuple[bytes, dict]:
    body = {"text": text, "model_id": ELEVEN_MODEL, "previous_text": prev, "next_text": nxt}
    res = http(f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE[0]}/with-timestamps",
               json.dumps(body).encode(), {"xi-api-key": api_key, "Content-Type": "application/json"})
    data = json.loads(res)
    return base64.b64decode(data["audio_base64"]), data.get("alignment") or {}


def to_exact_frames(mp3: Path, wav: Path) -> int:
    """MP3 -> WAV 48 kHz mono, rellenado con silencio hasta un número entero de cuadros."""
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(mp3), "-ar", str(RATE), "-ac", "1",
                          "-f", "s16le", "-"], check=True, capture_output=True).stdout
    samples = len(raw) // 2
    frames = math.ceil((samples / RATE + TAIL) * FPS)
    target = frames * (RATE // FPS)
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(raw + b"\0\0" * (target - samples))
    return frames


def main() -> None:
    src = HERE / (sys.argv[1] if len(sys.argv) > 1 else "texts/scenes-es.json")
    texts: list[str] = json.loads(src.read_text())
    AUDIO.mkdir(parents=True, exist_ok=True)
    api_key = env()["ELEVENLABS_API_KEY"]
    scenes, chars = [], 0
    for i, text in enumerate(texts):
        key = key_of(text)
        wav, words_json = AUDIO / f"{key}.wav", AUDIO / f"{key}.words.json"
        meta_json = AUDIO / f"{key}.meta.json"
        cached = wav.exists() and words_json.exists() and meta_json.exists()
        t0 = time.perf_counter()
        if not cached:
            prev = texts[i - 1] if i > 0 else ""
            nxt = texts[i + 1] if i + 1 < len(texts) else ""
            audio, alignment = synth(api_key, text, prev, nxt)
            mp3 = AUDIO / f"{key}.mp3"
            mp3.write_bytes(audio)
            frames = to_exact_frames(mp3, wav)
            words_json.write_text(json.dumps(words_from_chars(alignment), ensure_ascii=False, indent=1))
            meta_json.write_text(json.dumps({"frames": frames, "text": text}, ensure_ascii=False))
            chars += len(text)
        frames = json.loads(meta_json.read_text())["frames"]
        secs = time.perf_counter() - t0
        scenes.append({"index": i, "key": key, "frames": frames, "text": text, "cached": cached,
                       "ttsSeconds": round(secs, 2)})
        print(f"escena {i + 1}: {key} {frames:4d} cuadros ({frames / FPS:5.2f} s) "
              f"{'caché' if cached else f'nueva, {secs:.1f} s'}")
    total = sum(s["frames"] for s in scenes)
    (OUT / "manifest.json").write_text(json.dumps(
        {"source": src.name, "voice": VOICE[1], "fps": FPS, "rate": RATE, "scenes": scenes},
        ensure_ascii=False, indent=1))
    print(f"total: {total} cuadros ({total / FPS:.2f} s) · caracteres gastados: {chars}")


if __name__ == "__main__":
    main()
