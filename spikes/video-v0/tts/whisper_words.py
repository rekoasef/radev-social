"""Voz propia: una grabación del operador -> tiempos de cada palabra del guion con Whisper local
(faster-whisper, CPU, gratis), cortada por escena igual que whole.py.

Whisper puede entender mal una palabra ("Peruggia" -> "Perugia"); por eso no se usa su texto: se
empareja su lista de palabras con la del guion (difflib) y el karaoke muestra siempre el guion.
Las palabras del guion que Whisper no reconoció toman tiempos interpolados entre sus vecinas.

Uso (con el entorno de out/whisper/.venv):
  out/whisper/.venv/bin/python tts/whisper_words.py <audio> texts/v0-11-mona.json --tag yo \
      [--model small] [--compare out/v0-12/fran-v2-1.2]
--compare: el audio es una toma de ElevenLabs; compara los tiempos de Whisper con los de
ElevenLabs (que son exactos) y muestra el error. Sirve para medir sin tener grabación propia.
Salida: out/v0-12/whisper-<tag>/ (manifest.json + audio/, para `pnpm anim --voices`).
"""

import difflib
import subprocess
import json
import os
import re
import statistics
import sys
import time
import unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "out"
os.environ.setdefault("HF_HOME", str(OUT / "whisper" / "models"))  # modelos fuera de ~/.cache

import numpy as np  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402

from whole import split_scenes  # noqa: E402


def norm(w: str) -> str:
    w = unicodedata.normalize("NFD", w.lower())
    return re.sub(r"[^a-z0-9ñ]", "", "".join(c for c in w if unicodedata.category(c) != "Mn"))


def arg(args: list[str], name: str, default: str | None) -> str | None:
    if name in args:
        at = args.index(name)
        val = args[at + 1]
        del args[at:at + 2]
        return val
    return default


def align(script: list[str], heard: list[dict]) -> tuple[list[dict], int]:
    """Tiempos de Whisper sobre las palabras del guion. Devuelve las palabras y cuántas coincidieron."""
    a, b = [norm(w) for w in script], [norm(h["word"]) for h in heard]
    times: list[tuple[float, float] | None] = [None] * len(script)
    matched = 0
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        tag, i1, i2, j1, j2 = blk
        if tag == "equal":
            for k in range(i2 - i1):
                times[i1 + k] = (heard[j1 + k]["start"], heard[j1 + k]["end"])
                matched += 1
        elif tag == "replace" and j2 > j1:
            # Mismo tramo dicho distinto ("500.000" -> "quinientas mil"): se reparte su duración.
            s, e = heard[j1]["start"], heard[j2 - 1]["end"]
            n = i2 - i1
            for k in range(n):
                times[i1 + k] = (s + (e - s) * k / n, s + (e - s) * (k + 1) / n)
    # Lo que quedó sin tiempo: interpolado entre vecinas.
    for i, t in enumerate(times):
        if t is None:
            prev = next((times[j][1] for j in range(i - 1, -1, -1) if times[j]), 0.0)
            nxt = next((times[j][0] for j in range(i + 1, len(times)) if times[j]), prev)
            times[i] = (prev, max(prev, nxt))
    return [{"word": w, "start": round(s, 3), "end": round(e, 3)}
            for w, (s, e) in zip(script, times, strict=True)], matched


def reference(folder: Path) -> list[dict]:
    """Palabras de ElevenLabs con tiempos absolutos (full.words.json, o rearmadas desde el manifest:
    cada corte cae en la mitad de la pausa, así que corte = fin anterior + inicio relativo)."""
    if (folder / "full.words.json").exists():
        return json.loads((folder / "full.words.json").read_text())
    man = json.loads((folder / "manifest.json").read_text())
    words, cut = [], 0.0
    for sc in man["scenes"]:
        ws = json.loads((folder / "audio" / f"{sc['key']}.words.json").read_text())
        if words:
            cut = words[-1]["end"] + ws[0]["start"]
        words += [{**w, "start": w["start"] + cut, "end": w["end"] + cut} for w in ws]
    return words


def main() -> None:
    args = sys.argv[1:]
    tag = arg(args, "--tag", None) or sys.exit("falta --tag")
    model_name = arg(args, "--model", "small")
    compare = arg(args, "--compare", None)
    audio, texts_file = Path(args[0]).resolve(), args[1]
    texts: list[str] = json.loads((HERE / texts_file).read_text())
    script = " ".join(texts).split()

    t0 = time.perf_counter()
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    t1 = time.perf_counter()
    # El audio lo decodifica ffmpeg (el PyAV que trae faster-whisper 1.2.1 choca de versión).
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(audio), "-ar", "16000", "-ac", "1",
                          "-f", "f32le", "-"], check=True, capture_output=True).stdout
    segments, info = model.transcribe(np.frombuffer(raw, np.float32), language="es", word_timestamps=True,
                                      initial_prompt=" ".join(texts), vad_filter=False)
    heard = [{"word": w.word.strip(), "start": w.start, "end": w.end}
             for seg in segments for w in seg.words or []]
    t2 = time.perf_counter()
    words, matched = align(script, heard)
    print(f"modelo {model_name}: carga {t1 - t0:.1f} s · transcripción {t2 - t1:.1f} s para "
          f"{info.duration:.1f} s de audio · {matched}/{len(script)} palabras del guion reconocidas")

    out = OUT / "v0-12" / f"whisper-{tag}"
    split_scenes(out, f"whisper-{tag}", texts, words, audio,
                 {"source": texts_file, "voice": "grabación", "model": f"whisper-{model_name}"})
    (out / "heard.json").write_text(json.dumps(heard, ensure_ascii=False, indent=1))

    if compare:
        ref = reference(Path(compare).resolve())
        ds = [abs(w["start"] - r["start"]) * 1000 for w, r in zip(words, ref, strict=True)]
        de = [abs(w["end"] - r["end"]) * 1000 for w, r in zip(words, ref, strict=True)]
        q = statistics.quantiles(ds, n=20)
        print(f"error de inicio vs ElevenLabs: mediana {statistics.median(ds):.0f} ms · "
              f"p95 {q[18]:.0f} ms · máx {max(ds):.0f} ms · fin: mediana {statistics.median(de):.0f} ms")
        print(f"  > 100 ms (3 cuadros): {sum(d > 100 for d in ds)} de {len(ds)} palabras")
        worst = sorted(range(len(ds)), key=lambda i: -ds[i])[:5]
        print("  peores:", ", ".join(f"{words[i]['word']} {ds[i]:.0f} ms" for i in worst))


if __name__ == "__main__":
    main()
