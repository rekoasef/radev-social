"""V0-2: baja el modelo de Kokoro y las voces elegidas (Kokoro y Piper) a out/tts/models.

Licencias revisadas el 2026-11-23 en las fichas de Hugging Face (ver docs/V0-RESULTS.md).
"""

from pathlib import Path

from huggingface_hub import hf_hub_download

MODELS = Path(__file__).resolve().parent.parent / "out" / "tts" / "models"

KOKORO_REPO = "hexgrad/Kokoro-82M"
KOKORO_FILES = ["config.json", "kokoro-v1_0.pth"]
KOKORO_VOICES = ["ef_dora", "em_alex", "em_santa", "af_heart", "am_michael"]

PIPER_REPO = "rhasspy/piper-voices"
PIPER_VOICES = [
    "es/es_AR/daniela/high/es_AR-daniela-high",
    "es/es_MX/claude/high/es_MX-claude-high",
    "es/es_MX/ald/medium/es_MX-ald-medium",
    "es/es_ES/davefx/medium/es_ES-davefx-medium",
    "en/en_US/joe/medium/en_US-joe-medium",
    "en/en_US/kristin/medium/en_US-kristin-medium",
]


def get(repo: str, filename: str, dest: Path) -> None:
    path = hf_hub_download(repo, filename, local_dir=dest)
    print(f"{Path(path).stat().st_size / 1e6:8.1f} MB  {filename}")


def main() -> None:
    kokoro = MODELS / "kokoro"
    for f in KOKORO_FILES:
        get(KOKORO_REPO, f, kokoro)
    for v in KOKORO_VOICES:
        get(KOKORO_REPO, f"voices/{v}.pt", kokoro)
    piper = MODELS / "piper"
    for v in PIPER_VOICES:
        for ext in (".onnx", ".onnx.json"):
            get(PIPER_REPO, v + ext, piper)
        get(PIPER_REPO, str(Path(v).parent / "MODEL_CARD"), piper)


if __name__ == "__main__":
    main()
