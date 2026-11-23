"""V0-2b: el mismo texto en español con voces pagas (capa gratis) para comparar de oído.

Lee las claves del .env de la raíz (nunca las imprime). Se saltea el proveedor sin clave.
  ELEVENLABS_API_KEY
  AZURE_SPEECH_KEY + AZURE_SPEECH_REGION
  GOOGLE_TTS_API_KEY

Uso: python cloud.py               -> todas las voces de los proveedores con clave
     python cloud.py --list-eleven -> voces de la biblioteca de ElevenLabs en español
Salida: out/tts/cloud/<proveedor>-<voz>.(mp3|wav) y results.json
"""

import base64
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = HERE.parent / "out" / "tts" / "cloud"
TEXT = (HERE / "texts" / "es.txt").read_text().strip()

AZURE_VOICES = [
    ("es-AR", "es-AR-TomasNeural"),
    ("es-AR", "es-AR-ElenaNeural"),
    ("es-MX", "es-MX-Tristan:DragonHDLatestNeural"),
    ("es-MX", "es-MX-Ximena:DragonHDLatestNeural"),
]
GOOGLE_VOICES = ["es-US-Chirp3-HD-Charon", "es-US-Chirp3-HD-Orus", "es-US-Chirp3-HD-Kore"]
# Voces argentinas de la biblioteca (elegidas con --list-eleven el 2026-11-23).
ELEVEN_VOICES: list[tuple[str, str]] = [
    ("ByVRQtaK1WDOvTmP1PKO", "agustin"),
    ("gBTPbHzRd0ZmV75Z5Zk4", "carlos-pro"),
    ("MjtZn5tagxL1RO6w9ER5", "lionel"),
    ("FrrTxu4nrplZwLlMy2kD", "javier"),
    ("GXjmyUMreNIadjZrZRka", "nicolas-porteno"),
    ("9oPKasc15pfAbMr7N6Gs", "valeria"),
    ("p7AwDmKvTdoHTBuueGvP", "malena"),
    ("bN1bDXgDIGX5lw0rtY2B", "melanie"),
]
ELEVEN_MODEL = "eleven_multilingual_v2"


def env() -> dict[str, str]:
    vals = {}
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip().strip("'\"")
    return vals


def http(url: str, body: bytes | None, headers: dict[str, str]) -> bytes:
    req = urllib.request.Request(url, data=body, headers=headers, method="POST" if body else "GET")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        # El cuerpo del error no trae la clave; se recorta por las dudas.
        raise RuntimeError(f"HTTP {e.code}: {e.read()[:300].decode(errors='replace')}") from None


def azure(key: str, region: str, lang: str, voice: str) -> tuple[bytes, str]:
    ssml = (f"<speak version='1.0' xml:lang='{lang}'><voice name='{voice}'>"
            f"{TEXT.replace('&', 'y')}</voice></speak>")
    audio = http(
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
        ssml.encode(),
        {"Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
         "X-Microsoft-OutputFormat": "riff-24khz-16bit-mono-pcm", "User-Agent": "radev-v0"},
    )
    return audio, "wav"


def google(key: str, voice: str) -> tuple[bytes, str]:
    body = {"input": {"text": TEXT}, "voice": {"languageCode": voice[:5], "name": voice},
            "audioConfig": {"audioEncoding": "LINEAR16", "sampleRateHertz": 24000}}
    res = http(f"https://texttospeech.googleapis.com/v1/text:synthesize?key={urllib.parse.quote(key)}",
               json.dumps(body).encode(), {"Content-Type": "application/json"})
    return base64.b64decode(json.loads(res)["audioContent"]), "wav"


def eleven(key: str, voice_id: str) -> tuple[bytes, str, dict]:
    res = http(f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps",
               json.dumps({"text": TEXT, "model_id": ELEVEN_MODEL}).encode(),
               {"xi-api-key": key, "Content-Type": "application/json"})
    data = json.loads(res)
    return base64.b64decode(data["audio_base64"]), "mp3", data.get("alignment") or {}


def list_eleven(key: str) -> None:
    for accent in ["argentinian", "latin american", "mexican", ""]:
        q = urllib.parse.urlencode({"language": "es", "accent": accent, "page_size": 15,
                                    "sort": "usage_character_count_1y"})
        res = json.loads(http(f"https://api.elevenlabs.io/v1/shared-voices?{q}", None, {"xi-api-key": key}))
        print(f"\n== acento: {accent or '(cualquiera)'}")
        for v in res.get("voices", []):
            print(f"  {v['voice_id']}  {v.get('name', '')[:30]:30} {v.get('gender', ''):7} "
                  f"{v.get('accent', ''):15} {v.get('use_case', '')}")


def main() -> None:
    e = env()
    if "--list-eleven" in sys.argv:
        list_eleven(e["ELEVENLABS_API_KEY"])
        return
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = []
    if e.get("AZURE_SPEECH_KEY"):
        jobs += [(f"azure-{v.split(':')[0]}", lambda l=lang, v=v: azure(e["AZURE_SPEECH_KEY"], e.get("AZURE_SPEECH_REGION", "eastus"), l, v))
                 for lang, v in AZURE_VOICES]
    if e.get("GOOGLE_TTS_API_KEY"):
        jobs += [(f"google-{v}", lambda v=v: google(e["GOOGLE_TTS_API_KEY"], v)) for v in GOOGLE_VOICES]
    if e.get("ELEVENLABS_API_KEY"):
        jobs += [(f"eleven-{name}", lambda i=vid: eleven(e["ELEVENLABS_API_KEY"], i)) for vid, name in ELEVEN_VOICES]
    only = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--only=")), None)
    if only:
        jobs = [j for j in jobs if only in j[0]]
    results = []
    for name, fn in jobs:
        t0 = time.perf_counter()
        try:
            audio, ext, *extra = fn()
        except Exception as err:  # noqa: BLE001 — prueba descartable: se anota y sigue
            print(f"{name:45} FALLÓ: {err}")
            continue
        secs = time.perf_counter() - t0
        (OUT / f"{name}.{ext}").write_bytes(audio)
        if extra:
            (OUT / f"{name}.alignment.json").write_text(json.dumps(extra[0], ensure_ascii=False))
        results.append({"voice": name, "seconds": round(secs, 1), "bytes": len(audio), "chars": len(TEXT)})
        print(f"{name:45} {secs:5.1f} s  {len(audio) / 1024:6.0f} KB")
    (OUT / "results.json").write_text(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
