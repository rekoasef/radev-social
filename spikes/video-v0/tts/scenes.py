"""V0-3: voz de cada escena con ElevenLabs (Fran), con caché por hash.

Uso: python3 tts/scenes.py [texts/scenes-es.json] [--speed 1.1]
--speed (0,7 a 1,2) cambia solo la velocidad: el resto de los ajustes se copia de los guardados en
la voz (Fran tiene speed 0,92). Sin --speed, ElevenLabs usa los guardados tal cual.
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


def key_of(text: str, speed: float | None) -> str:
    params = {"voice": VOICE[0], "model": ELEVEN_MODEL, "text": text, "fps": FPS, "rate": RATE,
              "tail": TAIL}
    # La velocidad cambia el audio, así que entra en la clave. Sin --speed no se agrega, para que
    # los audios ya generados con la velocidad guardada sigan valiendo.
    if speed is not None:
        params["speed"] = speed
    raw = json.dumps(params, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def voice_settings(api_key: str, speed: float) -> dict:
    """Los ajustes guardados en la voz, con otra velocidad. Mandar solo `speed` podría dejar el
    resto (estabilidad, parecido, estilo) en los valores por defecto de la API."""
    stored = json.loads(http(f"https://api.elevenlabs.io/v1/voices/{VOICE[0]}/settings", None,
                             {"xi-api-key": api_key}))
    return {**stored, "speed": speed}


def synth(api_key: str, text: str, prev: str, nxt: str, settings: dict | None) -> tuple[bytes, dict]:
    body = {"text": text, "model_id": ELEVEN_MODEL, "previous_text": prev, "next_text": nxt}
    if settings:
        body["voice_settings"] = settings
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
    args = sys.argv[1:]
    speed: float | None = None
    if "--speed" in args:
        at = args.index("--speed")
        speed = float(args[at + 1])
        del args[at:at + 2]
        if not 0.7 <= speed <= 1.2:
            sys.exit("--speed va de 0.7 a 1.2 (límite de ElevenLabs)")
    src = HERE / (args[0] if args else "texts/scenes-es.json")
    texts: list[str] = json.loads(src.read_text())
    AUDIO.mkdir(parents=True, exist_ok=True)
    api_key = env()["ELEVENLABS_API_KEY"]
    settings = voice_settings(api_key, speed) if speed is not None else None
    scenes, chars = [], 0
    for i, text in enumerate(texts):
        key = key_of(text, speed)
        wav, words_json = AUDIO / f"{key}.wav", AUDIO / f"{key}.words.json"
        meta_json = AUDIO / f"{key}.meta.json"
        cached = wav.exists() and words_json.exists() and meta_json.exists()
        t0 = time.perf_counter()
        if not cached:
            prev = texts[i - 1] if i > 0 else ""
            nxt = texts[i + 1] if i + 1 < len(texts) else ""
            audio, alignment = synth(api_key, text, prev, nxt, settings)
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
        {"source": src.name, "voice": VOICE[1], "speed": speed, "fps": FPS, "rate": RATE,
         "scenes": scenes},
        ensure_ascii=False, indent=1))
    print(f"total: {total} cuadros ({total / FPS:.2f} s) · caracteres gastados: {chars}")


if __name__ == "__main__":
    main()
