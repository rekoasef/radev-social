#!/usr/bin/env bash
# V0-2: crea el entorno virtual de Python e instala Kokoro y Piper.
# Todo queda en spikes/video-v0/out/tts/ (ignorado por git).
set -euo pipefail
cd "$(dirname "$0")"
OUT=../out/tts
mkdir -p "$OUT"
python3 -m venv "$OUT/.venv"
PIP="$OUT/.venv/bin/pip"
"$PIP" install --quiet --upgrade pip
# torch de solo CPU: evita bajar ~2,5 GB de librerías de CUDA.
"$PIP" install --quiet --index-url https://download.pytorch.org/whl/cpu torch==2.15.0
"$PIP" install --quiet -r requirements.txt
# Lo que quedó instalado de verdad, con versiones exactas (para repetirlo en otra máquina).
"$PIP" freeze > requirements.lock.txt
echo "listo: $("$OUT/.venv/bin/python" --version)"
