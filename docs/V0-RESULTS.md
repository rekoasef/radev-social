# Resultados de V0 (RAdev Studio)

Pruebas definidas en `RADEV-STUDIO-REVISION.md` §6. Cada resultado indica la máquina en la que se midió: **los números de una máquina no valen para la otra** (`ENVIRONMENTS.md`).

Código de las pruebas: `spikes/video-v0/` en la rama `spike/video-v0` (descartable). Las salidas (MP4, audio, mediciones crudas) quedan en `spikes/video-v0/out/`, fuera de git.

## V0-0 · Prerrequisitos (PC de casa, 2026-11-21)

- `.wslconfig`: 10 GB de RAM y 8 GB de swap. WSL ve 9,7 GiB y 8 GiB de swap.
- `ffmpeg` 6.1.1-3ubuntu5 con apt.
- Línea base en reposo, con Docker Desktop apagado: WSL ~0,5 GiB usados, GPU 36 °C. La temperatura de la CPU no se puede leer desde WSL; queda sin medir.

## V0-1 · Remotion en el entorno local

**Máquina:** PC de casa (Ubuntu), 2026-11-21. Remotion 4.0.545, Node 24.15, Chrome Headless Shell 158 (lo baja Remotion), 16 hilos. Docker, web y worker **apagados**.

**Qué se renderizó:** un Short de 1080×1920 a 30 fps con 5 escenas de motion graphics (título por palabras, lista con entradas, número que cuenta, cita que se escribe, cierre con pulso), fondo animado en todas, dos tipografías del repo (Space Grotesk e Inter Tight). H.264, sin audio. Composición en `spikes/video-v0/src/Short.tsx`, medición en `scripts/bench.ts`.

| Video | Concurrency | Render (3 corridas) | s de render por s de video | RAM pico WSL | CPU promedio / máx. | GPU máx. | MP4 |
|---|---|---|---|---|---|---|---|
| 30 s | 2 | 48,2 · 47,4 · 46,8 s | 1,58 | 1,9–3,0 GiB | 29 % / 59 % | 43 °C | 7,9 MiB |
| 30 s | 4 | 34,3 · 34,1 · 34,3 s | 1,14 | 2,1 GiB | 43 % / 70 % | 45 °C | 7,9 MiB |
| 30 s | 6 | 33,3 · 33,3 · 33,2 s | 1,11 | 2,3–2,4 GiB | 46 % / 70 % | 45 °C | 7,9 MiB |
| **45 s** | **4** | **54,0 · 50,8 · 50,7 s** | 1,13–1,20 | 2,1–3,2 GiB | 43 % / 74 % | 45 °C | 11,4 MiB |

- **Bundle** (empaquetar el proyecto antes de renderizar): 15,2–15,4 s en frío, 4,1–4,4 s con caché.
- **Swap:** nunca se usó.
- **Windows:** 12–13 GB usados de 15,2 durante el render, con ~12 GB ya en reposo (Windows + la VM de WSL). El render suma poco del lado de Windows, pero el margen total es chico: cerrar programas pesados en las sesiones de render sigue valiendo.
- **El primer render de cada tanda** usa ~1 GiB más de RAM y tarda un poco más (Chrome arrancando).

**Lectura:**
- **Éxito: un Short de 45 s en ~51 s con concurrency 4** (el criterio pedía ≤ 3 min), con WSL lejos de 8 GB y sin inestabilidad.
- **De 4 a 6 casi no mejora** (−3 %) y usa más RAM: el cuello de botella no es la cantidad de pestañas, la CPU nunca pasó del 50 % de promedio. **Concurrency por defecto: 4.**
- El `.wslconfig` (10 GB) alcanza con margen para el render solo.

**Con el sistema levantado (PC de casa, 2026-11-23):** Docker Desktop abierto, `docker compose up -d --build` (postgres, migrate, web y worker; build + arranque 270 s), Short de 45 s con concurrency 4.

| Situación | Render | s/s | RAM pico WSL | CPU prom. | Bundle frío / caché |
|---|---|---|---|---|---|
| Web, worker y Postgres arriba (en reposo: worker ≤ 3 % CPU, ~150–300 MiB) | 73,6 · 68,5 · 67,0 s | 1,49–1,64 | 2,9–3,5 GiB | 45 % | 26,0 / 8,5 s |
| Contenedores frenados, Docker Desktop abierto | 69,4 · 67,5 s | 1,50–1,54 | 2,6–3,6 GiB | 44 % | 24,5 / 5,3 s |

- **Los contenedores no frenan el render**: con o sin ellos da ~68 s. Sigue cumpliendo de sobra (≤ 3 min).
- **Contra el 2026-11-21 es ~35 % más lento** (51 → 68 s; bundle en frío 15 → 25 s). Causa sin confirmar: Docker Desktop abierto (su VM comparte la máquina) o el estado de energía de la notebook. Para producción local no cambia ninguna decisión; si importa, repetir con Docker Desktop cerrado y el cargador puesto.

**Pendiente de V0-1:**
- [x] Una corrida con la web, el worker y Postgres levantados al mismo tiempo (2026-11-23).
- [ ] Ver si `@remotion/player` anda dentro del panel (se puede pasar a V1: no cambia ninguna decisión).
- Temperatura de la CPU: no se puede leer desde WSL. La GPU no subió de 45 °C (Remotion renderiza con la CPU).

## V0-2 · Kokoro y Piper

**Máquina:** PC de casa (Ubuntu), 2026-11-23. Python 3.12.3 en un entorno virtual (`spikes/video-v0/tts/setup.sh`; versiones exactas en `requirements.lock.txt`): kokoro 0.9.4, misaki 0.9.4, piper-tts 1.8.0 (con `onnx` 1.23.2 para los tiempos), torch 2.15.0 **solo CPU**. Modelos bajados con `download.py` a `spikes/video-v0/out/tts/models` (726 MB). Prueba: `synth.py`, cada voz en su propio proceso, todo en CPU (16 hilos).

**Texto:** el mismo en español (voseo) y en inglés, 93 palabras: números (1978, 6 millones, 64, 23 %, 3, 15), siglas (JFK), nombres propios (Nueva York, Lufthansa) y dos preguntas (`tts/texts/`).

| Voz | Idioma | Licencia de la voz | Audio | Síntesis | × tiempo real | RAM pico |
|---|---|---|---|---|---|---|
| Kokoro `ef_dora` | es (España) | Apache 2.0 | 32,7 s | 21,9 s | 1,5× | 1,4 GiB |
| Kokoro `em_alex` | es (España) | Apache 2.0 | 32,8 s | 23,1 s | 1,4× | 1,4 GiB |
| Kokoro `em_santa` | es (España) | Apache 2.0 | 32,9 s | 22,9 s | 1,4× | 1,4 GiB |
| Kokoro `ef_dora` + `es-419` | es (Latinoamérica) | Apache 2.0 | 32,8 s | 22,8 s | 1,4× | 1,4 GiB |
| Kokoro `em_alex` + `es-419` | es (Latinoamérica) | Apache 2.0 | 33,0 s | 24,5 s | 1,3× | 1,4 GiB |
| Kokoro `af_heart` | en | Apache 2.0 | 31,3 s | 22,0 s | 1,4× | 1,6 GiB |
| Kokoro `am_michael` | en | Apache 2.0 | 34,7 s | 28,4 s | 1,2× | 1,7 GiB |
| Piper `es_AR-daniela-high` | es (Argentina) | dataset CC BY-SA 4.0 (atribución y "compartir igual": revisar en V0-7) | 27,1 s | 9,1 s | 3,0× | 0,5 GiB |
| Piper `es_MX-claude-high` | es (México) | dataset Apache 2.0 | 34,9 s | 2,7 s | 13× | 0,4 GiB |
| Piper `es_MX-ald-medium` | es (México) | dataset Unlicense | 34,9 s | 4,3 s | 8× | 0,4 GiB |
| Piper `es_ES-davefx-medium` | es (España) | dataset CC0 | 30,6 s | 3,9 s | 7,8× | 0,4 GiB |
| Piper `en_US-joe-medium` | en | dataset CC0 | 31,9 s | 2,1 s | 15× | 0,4 GiB |
| Piper `en_US-kristin-medium` | en | dominio público | 34,4 s | 1,9 s | 18× | 0,5 GiB |

Descartadas por licencia antes de probar: Piper `en_US-ryan` y `hfc_female`/`hfc_male` (CC BY-NC-SA: no comercial), `en_US-lessac` (licencia de investigación de Blizzard 2013).

**Lectura (parcial):**
- **Todas cumplen "más rápida que el tiempo real" en CPU.** Piper es mucho más rápido (8–18×, Daniela 3× por ser `high`) y usa un tercio de la RAM. Kokoro anda a ~1,4×: un Short de 45 s tarda ~35 s en generar la voz, que con la caché por hash se paga una sola vez por escena.
- **Kokoro en español usa por defecto las reglas de España** (`espeak-ng` `es`: "diθjembre", con θ). Con `es-419` (cambiando `pipe.g2p`) sale "disjembre". Ninguna de las dos es rioplatense: `espeak-ng` no tiene esa variante (falta el sonido "sh" de "yo" y "calle").
- **Tiempos por palabra:** ninguno los da de fábrica en español (Kokoro solo en inglés), pero **los dos dan la duración de cada fonema** (Kokoro: `pred_dur`; Piper: `include_alignments`). Agrupando por espacios salen palabras fonéticas con inicio y fin (`out/tts/samples/<voz>.json`), coherentes con el audio. Falta: (1) unir las palabras fonéticas con las del texto, porque los números se expanden ("1978" → "mil novecientos setenta y ocho"); (2) medir la precisión contra una referencia (Whisper), con el criterio de ≤ 100 ms.
- **Calidad (operador, 2026-11-23):** en inglés eligió **Kokoro `am_michael`**. En español, la que más lo convenció es **Kokoro `em_alex` con `es-419`** ("no es 100 % real, pero para empezar podemos usar esa"). Más adelante quiere subir el nivel con un proveedor pago (ElevenLabs o similar) para que suene humana: entra como otro `TtsProvider`, con ADR (regla de costo cero; tope de USD 6/mes).
- **Palabras del texto:** `tts/align.py` convierte cada palabra del texto por separado con el mismo espeak y cuenta cuántas palabras fonéticas le tocan. Con la voz elegida cuadra exacto: 93/93 palabras y 95/95 fonéticas ("1978" = 3 fonéticas, 0,93–2,62 s). Salida en `<voz>.words.json`.
- **Entonación de las preguntas (operador, 2026-11-23):** "¿Vos sabés cuánto tarda la tuya?" no suena a pregunta. Medido con el tono (F0, Praat): Kokoro **baja** el tono al final de las preguntas en todos los casos (−28 % en la muestra; también en inglés: −14 % y −16 %), y termina con voz rasposa sin tono (*vocal fry*: de "tuya?" solo los primeros ~80 ms tienen tono). Piper `es_ES-davefx` sí sube (+15 %); la medición detecta subidas donde las hay. **Sin arreglo del lado de Kokoro:** puntuación ("??"), pregunta en bloque aparte, redacción y 11 vectores de estilo distintos: todas bajan. Subir el tono después (PSOLA de Praat) no sirve, porque en la parte rasposa no hay tono que mover. **Lo que sí funciona:** en español, las preguntas con *qué, cómo, cuánto, cuándo* se dicen bajando ("¿Cómo lo hicieron?" no le molestó al operador). Para V1: la guía del guion pide preguntas de ese tipo ("¿Cuánto tarda la tuya?") y no de sí/no; la voz paga lo resolvería del todo. Muestras para comparar en `Descargas\v0-2-voces\preguntas`.
- **Prueba de sincronía a ojo:** `pnpm --filter @radev/spike-video-v0 captions` (composición `captions`: la voz + subtítulos palabra por palabra con la palabra actual resaltada y un reloj abajo). 33,5 s de video en 30,6 s de render, H.264 + AAC. **El operador confirmó que los subtítulos están bien sincronizados**: los tiempos sacados de los fonemas alcanzan y no hace falta alinear con Whisper.

**Resultado de V0-2 (cerrada el 2026-11-23, PC de casa):**
- **D-G → Kokoro** como único motor de voz de V1: `em_alex` con `es-419` en español y `am_michael` en inglés. Un solo modelo (Apache 2.0; espeak-ng GPLv3 como dependencia, se usa sin distribuirlo), ~1,4× tiempo real en CPU, ~1,4 GiB de RAM por proceso.
- **Tiempos por palabra sin paso extra:** duración de cada fonema (`pred_dur`) + unión con las palabras del texto (`align.py`). No hace falta Whisper.
- **Límite conocido:** Kokoro no sube el tono en las preguntas de sí/no → la guía del guion pide preguntas con qué/cómo/cuánto (falta que el operador confirme de oído con los cierres de `Descargas\v0-2-voces\preguntas`).
- **Más adelante:** una voz paga para que suene humana, como otro `TtsProvider` y con ADR.
- Piper queda como alternativa rápida (8–18×), pero no se eligió ninguna de sus voces.

### V0-2b · Voces pagas (en curso, 2026-11-23)

- **Reabierto por el operador:** escuchando más, el español de Kokoro le parece "muy malo" (el inglés, `am_michael`, sí le gusta: "fluida y muy profesional"). Acepta pagar USD 6/mes; primero se prueba gratis y se paga recién cuando una voz convenza (con ADR por la regla 13).
- **Comparación preparada** (`tts/cloud.py`, claves en el `.env`): ElevenLabs, Azure (`es-AR-TomasNeural`, `es-AR-ElenaNeural` + HD de México) y Google Chirp 3 HD (solo `es-US`/`es-ES`). Datos verificados en las páginas oficiales: ElevenLabs Free 10.000 créditos/mes sin licencia comercial, Starter USD 6 con 30.000 y licencia comercial; 1 crédito por carácter en Multilingual v2; `POST /v1/text-to-speech/{voz}/with-timestamps` devuelve tiempos por carácter.
- **ElevenLabs gratis no puede usar voces de la biblioteca por la API** (HTTP 402 `paid_plan_required`); desde la web sí. Todas las voces argentinas son de la biblioteca. Hay muchas (filtro `accent=argentine`).
- **Decisión del operador: varias voces, elegidas por video.** Las voces de los primeros resultados suenan "a comercial"; para historias quiere una voz **narrativa**. Se queda con **Carlos Pro** (`gBTPbHzRd0ZmV75Z5Zk4`, "Argentinian Documentary") para comerciales (por ejemplo de Lumus) y busca otra narrativa. En V1: catálogo de voces en la base (proveedor, id, nombre, uso: narrativa/comercial), voz por defecto por marca y selector al crear cada video (regla 6: nada de una marca en código).
- **Candidatas narrativas (operador, 2026-11-23):** **Fran** (`0bu1GUsOfNJYyXbmSTxD`) y **Juan** (`dGjL92Li0y7ZUQ3MESQW`). Falta probarlas con el texto de prueba (web o API ya paga).
- **Con Starter pago (2026-11-23):** `cloud.py --only=<voz>` + `eleven_words.py` (tiempos por carácter → palabras, MP3 → WAV) + composición `captions`.

| Voz | Uso | Audio | Generación | Tono al final de la pregunta | Palabras |
|---|---|---|---|---|---|
| Fran | narrativa | 41,5 s | 8,0 s | **+15 %** (sube) | 93/93 |
| Juan | narrativa | 42,2 s | 13,2 s | −40 % (baja) | 93/93 |
| Carlos Pro | comercial | 33,7 s | 3,2 s | **+29 %** (sube) | 93/93 |
| Kokoro `em_alex` (referencia) | — | 32,8 s | 22,8 s (local) | −28 % | 93/93 |

  Los tiempos por carácter vienen del texto original: no hace falta la unión con números de `align.py`. Videos con subtítulos (42 s en ~38 s de render cada uno) en `Descargas\v0-2-voces\elevenlabs\videos`. Decisión en **ADR 0027**. **Elección del operador:** Fran como narrativa por defecto ("la que más me convenció"); Juan también sirve para relatos y Carlos Pro para lo comercial. **V0-2 cerrada.**
- Muestras gratis (las de la biblioteca, con su propio texto) en `Descargas\v0-2-voces\elevenlabs` y `...\narrativas` (12 voces argentinas narrativas por uso).

## V0-7 · Licencias y condiciones

*En curso.* Primera lectura (2026-11-21), a confirmar en las páginas oficiales antes de cerrar:

| Herramienta | Licencia | Uso comercial | Nota |
|---|---|---|---|
| Remotion 4.0.545 | Licencia propia | **Gratis** para personas, organizaciones sin fines de lucro y empresas de **hasta 3 personas**; desde 4 se paga la Company License | El tope cuenta la suma de empresas que colaboran. Remotion 5.0 cambia la licencia con el mismo tope: revisar al actualizar |
| Kokoro-82M | Apache 2.0 (pesos), MIT (código) | Sí | Depende de espeak-ng (GPLv3) para idiomas que no son inglés. Datos de entrenamiento mayormente en inglés: el español puede sonar peor (lo decide V0-2) |
| Piper (OHF-Voice/piper1-gpl) | GPL-3.0 | Sí para generar audio; la GPL importa si se distribuye el programa | El repo original (MIT) quedó archivado en octubre de 2025. **Cada voz tiene su licencia**: revisar la ficha de cada una en V0-2 |
