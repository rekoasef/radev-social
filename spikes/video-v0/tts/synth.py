"""V0-2: genera el texto de prueba con cada voz y mide velocidad, RAM y tiempos.

Uso: python synth.py            -> todas las voces, cada una en su propio proceso
     python synth.py <voz>      -> una sola voz (lo usa el modo "todas")

Salida en out/tts/samples/: <voz>.wav, <voz>.json (tiempos por palabra fonética)
y results.json con las mediciones.
"""

import json
import resource
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "out" / "tts"
MODELS = OUT / "models"
SAMPLES = OUT / "samples"

VOICES = {
    # id: (motor, idioma, archivo o voz)
    "kokoro-ef_dora": ("kokoro", "es", "ef_dora"),
    "kokoro-em_alex": ("kokoro", "es", "em_alex"),
    "kokoro-em_santa": ("kokoro", "es", "em_santa"),
    # Las mismas voces con las reglas de pronunciación de Latinoamérica (sin θ).
    "kokoro-ef_dora-419": ("kokoro", "es-419", "ef_dora"),
    "kokoro-em_alex-419": ("kokoro", "es-419", "em_alex"),
    "kokoro-af_heart": ("kokoro", "en", "af_heart"),
    "kokoro-am_michael": ("kokoro", "en", "am_michael"),
    "piper-es_AR-daniela-high": ("piper", "es", "es/es_AR/daniela/high/es_AR-daniela-high"),
    "piper-es_MX-claude-high": ("piper", "es", "es/es_MX/claude/high/es_MX-claude-high"),
    "piper-es_MX-ald-medium": ("piper", "es", "es/es_MX/ald/medium/es_MX-ald-medium"),
    "piper-es_ES-davefx-medium": ("piper", "es", "es/es_ES/davefx/medium/es_ES-davefx-medium"),
    "piper-en_US-joe-medium": ("piper", "en", "en/en_US/joe/medium/en_US-joe-medium"),
    "piper-en_US-kristin-medium": ("piper", "en", "en/en_US/kristin/medium/en_US-kristin-medium"),
}


def words_from_phonemes(items: list[tuple[str, float]], offset: float) -> list[dict]:
    """Agrupa (fonema, segundos) en palabras fonéticas, cortando en los espacios."""
    words, cur, start, t = [], "", None, offset
    for ph, dur in items:
        if ph == " ":
            if cur:
                words.append({"ph": cur, "start": round(start, 3), "end": round(t, 3)})
            cur, start = "", None
        elif ph.strip():
            if start is None:
                start = t
            cur += ph
        t += dur
    if cur:
        words.append({"ph": cur, "start": round(start, 3), "end": round(t, 3)})
    return words


def run_kokoro(lang: str, voice: str, text: str):
    import numpy as np
    import torch
    from kokoro import KModel, KPipeline

    t0 = time.perf_counter()
    model = KModel(
        repo_id="hexgrad/Kokoro-82M",
        config=str(MODELS / "kokoro" / "config.json"),
        model=str(MODELS / "kokoro" / "kokoro-v1_0.pth"),
    ).eval()
    pipe = KPipeline(lang_code="a" if lang == "en" else "e", repo_id="hexgrad/Kokoro-82M", model=model)
    if lang == "es-419":
        from misaki.espeak import EspeakG2P

        pipe.g2p = EspeakG2P(language="es-419")
    pack = pipe.load_voice(str(MODELS / "kokoro" / "voices" / f"{voice}.pt"))
    load_s = time.perf_counter() - t0

    t1 = time.perf_counter()
    audio, words, offset = [], [], 0.0
    with torch.inference_mode():
        for r in pipe(text, voice=pack):
            if r.audio is None:
                continue
            a = r.audio.numpy()
            dur = r.pred_dur.tolist()  # cuadros: <bos>, un valor por caracter fonético, <eos>
            items = [(ph, d / 40) for ph, d in zip(r.phonemes, dur[1:-1])]
            words += words_from_phonemes(items, offset + dur[0] / 40)
            audio.append(a)
            offset += len(a) / 24000
    synth_s = time.perf_counter() - t1
    return np.concatenate(audio), 24000, load_s, synth_s, words


def run_piper(voice: str, text: str):
    import numpy as np
    from piper import PiperVoice

    t0 = time.perf_counter()
    v = PiperVoice.load(str(MODELS / "piper" / f"{voice}.onnx"), include_alignments=True)
    load_s = time.perf_counter() - t0

    t1 = time.perf_counter()
    audio, words, offset, sr = [], [], 0.0, v.config.sample_rate
    for chunk in v.synthesize(text, include_alignments=True):
        a = chunk.audio_float_array
        if chunk.phoneme_alignments:
            items = [(al.phoneme, al.num_samples / sr) for al in chunk.phoneme_alignments]
            words += words_from_phonemes(items, offset)
        audio.append(a)
        offset += len(a) / sr
    synth_s = time.perf_counter() - t1
    return np.concatenate(audio), sr, load_s, synth_s, words


def one(vid: str) -> None:
    import soundfile as sf

    engine, lang, ref = VOICES[vid]
    text = (HERE / "texts" / f"{lang[:2]}.txt").read_text().strip()
    if engine == "kokoro":
        audio, sr, load_s, synth_s, words = run_kokoro(lang, ref, text)
    else:
        audio, sr, load_s, synth_s, words = run_piper(ref, text)
    SAMPLES.mkdir(parents=True, exist_ok=True)
    sf.write(SAMPLES / f"{vid}.wav", audio, sr)
    (SAMPLES / f"{vid}.json").write_text(json.dumps(words, ensure_ascii=False, indent=1))
    secs = len(audio) / sr
    print(json.dumps({
        "voice": vid, "engine": engine, "lang": lang,
        "audio_s": round(secs, 2), "load_s": round(load_s, 2), "synth_s": round(synth_s, 2),
        "x_realtime": round(secs / synth_s, 1),
        "peak_rss_mib": round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024),
        "phonetic_words": len(words), "text_words": len(text.split()),
    }))


def main() -> None:
    if len(sys.argv) > 1:
        one(sys.argv[1])
        return
    results = []
    for vid in VOICES:
        p = subprocess.run([sys.executable, __file__, vid], capture_output=True, text=True)
        line = next((ln for ln in reversed(p.stdout.splitlines()) if ln.startswith("{")), None)
        if p.returncode or not line:
            print(f"{vid}: FALLÓ\n{p.stderr[-1500:]}")
            continue
        r = json.loads(line)
        results.append(r)
        print(f"{vid:28} {r['audio_s']:5.1f} s de audio  carga {r['load_s']:4.1f} s  "
              f"síntesis {r['synth_s']:5.1f} s  ({r['x_realtime']:4.1f}× tiempo real)  "
              f"RAM {r['peak_rss_mib']} MiB  palabras {r['phonetic_words']}/{r['text_words']}")
    (SAMPLES / "results.json").write_text(json.dumps(results, indent=1))


if __name__ == "__main__":
    main()
