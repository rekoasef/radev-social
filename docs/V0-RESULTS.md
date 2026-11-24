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

## V0-3 · Render por escena + FFmpeg (PC de casa, 2026-11-23)

**Cómo:** el texto de prueba partido en 6 escenas (`tts/texts/scenes-es.json`). `tts/scenes.py` pide la voz de cada escena a ElevenLabs (Fran) con `previous_text`/`next_text` para que la entonación siga el hilo, la pasa a WAV 48 kHz mono y la rellena con silencio hasta un **número entero de cuadros** (48000/30 = 1600 muestras por cuadro; 0,25 s de aire al final). `scripts/scenes.ts` renderiza un clip Remotion por escena (composición `scene`, mismo navegador para todas) y arma con FFmpeg. Las dos cosas tienen **caché por hash**: voz = hash de voz + modelo + texto + parámetros (el texto de las vecinas no entra, así que cambiar una escena no rehace las de al lado); clip = hash de sus props + versión del render. Los clips se escriben con otro nombre y se renombran al terminar (un render cortado no queda en la caché).

- **Variante A (audio aparte):** `concat -c copy` de los clips mudos + las voces concatenadas en PCM + música de prueba (generada con `aevalsrc`) bajada por la voz (`sidechaincompress`, *ducking*) + `loudnorm` a −14 LUFS + mux con AAC 192k y `-t` al largo exacto.
- **Variante B (audio en los clips):** cada clip con su voz (AAC de Remotion) y `concat -c copy`.
- **Medición** (`out/v0-3/<tag>/results.json`): cuadros y paso entre cuadros (`ffprobe`), largo del video y del audio, y **posición real de la voz en cada escena** (correlación de 0,25 s de la voz de referencia contra el audio final, ±40 ms).

| | A: audio aparte | B: audio en los clips |
|---|---|---|
| Desfase final | **0 ms** (completo), −0,3 ms (editado) | 45,7 ms = **1,37 cuadros** ❌ |
| Voz en cada escena | **0 ms** en las 6 | 8 a 35 ms corrida, distinta en cada unión |
| Saltos en el paso de cuadros | 0 | 5 (uno por unión) |
| Armado | **5,7–5,9 s** ✅ (< 15 s) | 0,3 s |
| Volumen | −14,9 LUFS, pico −4,3 dBTP | −22 LUFS (sin normalizar) |

| Render (48,2 s de video, 6 escenas, concurrency 4) | Tiempo |
|---|---|
| Bundle de Remotion (una vez por corrida) | 5–8 s |
| Las 6 escenas (A) | 47,2 s (≈ un render único de V0-1: partir en escenas no agrega costo) |
| Voz de las 6 escenas (ElevenLabs) | 11,5 s, 502 caracteres |
| **Cambiar la escena 4** (13,6 s → 12,8 s de audio) | voz 2,7 s (123 caracteres) + **1 clip en 12,1 s (26 % del total)** + armado 5,7 s; 10 clips y 5 voces desde la caché |

- **Trampa encontrada:** sin `-t` en el mux, el audio final salía 2 cuadros más largo que el video en la versión editada (AAC va en paquetes de 1024 muestras y el último se completa con silencio). Voz, música y video medían exacto; con `-t` queda en 0. En V1 el mux lleva siempre `-t` con el largo en cuadros.
- **B falla por el códec:** cada clip con AAC arrastra su relleno de inicio y fin; al concatenar sin recodificar, la voz se corre entre 8 y 35 ms en cada escena y el total queda 1,4 cuadros largo. Confirma §4.5: el audio se arma una vez, aparte.
- `loudnorm` en una pasada quedó en −14,9 LUFS (objetivo −14). En V1: dos pasadas (medir y aplicar), unos segundos más de armado.
- Videos en `Descargas\v0-3-escenas`: `1-completo-audio-aparte`, `2-completo-audio-en-clips`, `3-escena4-cambiada-audio-aparte`.

**Repetida en la PC de la fábrica (2026-11-24).** Ryzen 5 4600H, WSL con 5,5 GiB, Debian 13 y `ffmpeg` 7.1.3 (ver `docs/ENVIRONMENTS.md`). Las voces se volvieron a pedir: es otra toma de ElevenLabs, así que el video dura 49,3 s (casa: 48,2 s) y la escena 4 editada, 14,4 s.

| | Fábrica | Casa |
|---|---|---|
| A: desfase final / voz en cada escena / saltos | −0,3 ms (completo), −0,7 ms (editado) / **0 ms** en las 6 / 0 | igual |
| B: desfase final / voz por escena | 45,7 ms (1,37 cuadros) / −37 a +34 ms | igual |
| Las 6 escenas (A) | **59,7 s** (~26 % más lenta) | 47,2 s |
| Bundle de Remotion | 50 s la primera vez (en frío), 7 s después | 5–8 s |
| Cambiar la escena 4 | 1 clip en 16,3 s (26 % del render) + armado 4,4 s | 12,1 s + 5,7 s |
| Armado A | 4,4–4,7 s | 5,7–5,9 s |
| ElevenLabs | 502 + 123 = 625 caracteres | igual |
| Memoria durante el render | mínimo **640 MiB libres** de 5,5 GiB, 17 MiB de swap: alcanza, justo | — |

La primera corrida baja además el Chrome Headless Shell de Remotion (102,5 MB, queda en `node_modules`). Los resultados de sincronía no dependen de la máquina; el tiempo de render sí.

**Velocidad de la voz (fábrica, 2026-11-24).** Fran trae guardado `speed` 0,92. `tts/scenes.py --speed` lee los ajustes guardados de la voz (`GET /v1/voices/{id}/settings`: stability 0,8, similarity 0,7, style 0,5, speaker boost) y cambia solo la velocidad. Mandar `speed` solo podría dejar el resto en los valores por defecto de la API. La velocidad entra en la clave de la caché.

| `speed` | Duración | Render A (6 escenas) | Voz por escena (A) |
|---|---|---|---|
| 0,92 (guardada) | 49,3 s | 59,7 s | 0 ms |
| 1,0 | 46,6 s (−5,5 %) | 51,0 s | 0 ms |
| **1,1** | 42,4 s (−14 %) | 45,6 s | 0 ms |

La duración baja menos de lo que sube la velocidad, porque ElevenLabs genera la voz de nuevo (respeta las pausas) y cada escena conserva 0,25 s de aire. Cada versión gastó 502 caracteres. **Elegida por el operador: 1,1.**

**Resultado (cerrada el 2026-11-24, PC de la fábrica):** criterios medidos cumplidos con la variante A (desfase < 1 cuadro, armado < 15 s, rehacer una escena ≈ un cuarto del render). El operador miró y escuchó los videos y aprobó: **D-D en firme, con el audio armado aparte (variante A)**. Voz de Fran a `speed` 1,1 (ADR 0027).

## V0-5 · Los looks de `packages/slides` en Remotion (PC de la fábrica, 2026-11-24)

**Cómo:** la spike suma `@radev/slides` como dependencia del workspace (`workspace:*`) y lo importa tal como está. Composiciones nuevas en `spikes/video-v0/src/looks/`: `look-still` (1080×1350, un cuadro por slide), `look-scene` (una slide en 9:16) y `looks-clip` (las 6 escenas de V0-3 con la voz de Fran a 1,1 y subtítulos). Script: `pnpm --filter @radev/spike-video-v0 looks compare|scenes|clip`. Paleta de RAdev del seed (`looks/radev-tokens.json`: tinta `#0B0B0B`, acento `#FF7A00`, Inter Tight 900): las tokens reales de producción no se leyeron.

**Compila sin cambios en `slides`.** El bundler de Remotion (webpack) toma el TypeScript, los JSON (métricas de fuentes, íconos), el CSS de `@fontsource-variable` y `lucide-react` sin configuración extra. `slides` no depende de Next ni de `/render`. Lo único que hubo que sumar del lado del video es lo mismo que hacen `preview` y `/render` antes de la captura: esperar las fuentes y correr `fitSlide`. En Remotion va con `delayRender`/`continueRender` (`src/looks/use-fit.ts`). Bundle: 8–19 s.

**¿Se ve igual que en el carrusel?** Los 16 looks × 13 tipos de slide (208 pares), sacados con Remotion y con `preview` (el Playwright de Social), comparados con SSIM de `ffmpeg` (1 = idénticas):

| | SSIM a tamaño real (mín. / prom.) | SSIM a 1/4 (dónde está cada cosa) |
|---|---|---|
| Remotion tal cual | 0,81 / 0,978 | **0,68** / 0,984 (127 de 208 bajo 0,99) |
| Remotion sin `--font-render-hinting=none` | **0,9975** / 0,9998 | 0,996 / 0,9996 (0 bajo 0,99) |

- **La diferencia era una opción de Chrome, no el código.** Remotion abre Chrome con `--font-render-hinting=none`; Playwright no. Sin el *hinting* (el ajuste de las letras a la grilla de píxeles), el mismo texto mide un poco menos, así que los títulos cortan en otro lugar (bauhaus: "realmente tener" en una línea) y `fitSlide` decide otro zoom (recibo con pasos: todo 7 px corrido). Se confirmó con las 4 combinaciones (Chrome 153 de Playwright y 158 de Remotion, con y sin la opción, `scripts/hinting.ts`): la versión de Chrome no cambia nada y la opción lo cambia todo.
- **Arreglo, del lado del video:** `openBrowser("chrome", { chromiumOptions: { flags: { "font-render-hinting": false } } })` (opción documentada de Remotion). Con eso, lo único distinto son los símbolos que la tipografía no tiene y dibuja una fuente del sistema (`❯`, `→`).
- Remotion dibuja las 13 slides de un look en 1,6–3,1 s (concurrency 2). `preview`, los 16 looks en 44–57 s.

**9:16, dos variantes** (hojas por look en `out/v0-5/sheet-<look>.png`):

- **A, la slide 4:5 centrada** con bandas del color de su fondo (cero cambios en `slides`). Anda bien en los looks de color plano. En los que tienen fondo con luces o textura (`atmosfera`, `gradiente`) se ve el corte donde termina la slide. La caja de contenido queda en la zona segura de Shorts, pero no queda lugar propio para los subtítulos: van encima de la slide.
- **B, un marco 9:16 propio** (`src/looks/vertical-slide.tsx`, una copia de `StudioSlide` con otra altura) que reusa fondo, decoración, encabezado, pie y plantillas. La caja de contenido es la misma del carrusel (850×1020), así que las plantillas, los tamaños de título y `fitSlide` funcionan igual. Fondo, decoración y pie se acomodan solos a 1920 (el ticket de `recibo` ocupa todo el alto). Los fondos pensados para 1350 (las luces de `atmosfera`) quedan en la parte de arriba. Abajo queda lugar para los subtítulos. Para V1 hace falta que `slides` **exporte** estas piezas (hoy la spike las importa por ruta relativa) o un marco vertical propio: es un cambio que suma y no toca a Social.

**Movimiento sin tocar `slides`.** Remotion dibuja cada cuadro por separado, así que las animaciones CSS no sirven: se anima desde afuera con estilos puestos en cada cuadro. Se usan `translate` y `opacity`, que son propiedades aparte del `transform` que usan las capas movidas a mano (ADR 0013). Las plantillas ya marcan sus capas (`data-layer="title"`, `"body"`): entra primero el título, después el cuerpo y los ítems de a uno (`stagger`). El fondo, el encabezado y el pie quedan quietos. Funciona en los dos looks probados. Encontrar "los ítems" es una heurística de la spike (el primer contenedor con 2 o más hijos): en V1 conviene que las plantillas marquen sus ítems.

**Clip con voz y subtítulos** (42,4 s, 6 escenas, concurrency 2, audio dentro del render: acá no se prueba el armado):

| Look | A | B |
|---|---|---|
| `editorial` | 71,2 s | 63,7 s |
| `atmosfera` | 78,8 s | 77,0 s |

Con concurrency 2 (por los 5,5 GiB de esta PC) da ~1,5–1,9 s de render por segundo de video. La escena de prueba de V0-3 tardaba 45,6 s con concurrency 4: los looks cuestan más que los fondos lisos, pero siguen lejos del límite de V0-1 (45 s en ≤ 3 min). Memoria: 2 GiB libres al terminar, sin problemas.

**Pendientes para V1:** los subtítulos de la spike (pastilla negra al 55 %) se ven grises sobre las superficies claras: tienen que tomar los colores de la superficie del look. Las imágenes generadas (`ArtLayer`) no entraron en la prueba.

Videos y hojas en `Descargas\v0-5-looks` (fábrica): `clip-<look>-<a|b>-stagger.mp4`.

**Resultado (2026-11-24): técnicamente viable, pero descartado como base del video.** El operador aclaró que las slides "no tienen nada que ver" con el video que busca: video animado como la referencia de @curioarchivo_ (ver V0-6). De V0-5 queda: Remotion espera las fuentes antes de cada cuadro, la opción de Chrome que cambiaba el ancho de las letras y que los colores y las tipografías de una marca se pueden usar en cajas y subtítulos.

## V0-6 (redefinida) · Video animado guionado escena por escena (PC de la fábrica, 2026-11-24)

**Pedido del operador:** "tiene que ser un video animado", con movimiento (una personita que camina, cosas que entran), no fotos ni slides, y "todo tiene que estar guionado, escena por escena". Reemplaza la V0-6 original (personaje SVG) y la idea de V1 de escenas tipo slide: **cambio del plan, a documentar en `RADEV-STUDIO-REVISION.md` §7 cuando el operador apruebe el estilo.**

**La referencia** (TikTok de @curioarchivo_, "el hackeo de la TV de Chicago, 1987", 2:45, 576×1024): se abrió con el Chromium de Playwright y el navegador bajó el video (queda solo en la carpeta temporal de la sesión, no en el repo). Cuadros cada 3 s y de a 4 por segundo:
- Ilustración 2D vectorial plana, personajes geométricos simples, paleta oscura y cálida; objetos que se repiten (el televisor, un calendario, la ciudad de noche, diarios).
- Unos 14 cortes en 2:45 (tomas de 5–20 s), pero **nunca hay un cuadro quieto**: personajes que se balancean o entran en pánico, luz de alarma roja y azul cada ~0,5 s, ventanas y antenas que titilan, objetos y cajas de datos que entran con rebote ("25 SEG.", "90 SEGUNDOS", "CASI 40 AÑOS"), etiquetas ("MÁSCARA DE PLÁSTICO"), cámara que se acerca despacio.
- Subtítulos tipo karaoke arriba (lo dicho en blanco, lo que falta en gris, 1–2 palabras en caja azul) y un titular en mayúsculas abajo con una palabra en rojo, que entra palabra por palabra. Abre con "¿Sabías que…?" y cierra pidiendo comentarios.
- No usa IA de video: son motion graphics, justo lo que hace Remotion.

**La prueba:** escenas 1 y 2 del guion de V0-3 con la voz de Fran (15,2 s). Código en `spikes/video-v0/src/anim/`:
- `guion.ts`: **el guion**. Por escena: narración, escenario, cámara (puntos clave), personajes con acciones (`walk`, `lookWatch`, `scratchHead`, `panic`, `carry`, `pop`), objetos, cajas de datos, palabras resaltadas y titular. **Todos los tiempos se enganchan a palabras de la voz** (`{ word: "seis", offset: 0.25 }`): si cambia la voz, todo se reacomoda solo. Es el formato que en V1 escribiría `claude -p` (V0-8) y validaría Zod.
- `person.tsx`: personita en SVG con piezas separadas (piernas, brazos, cabeza, gorro), ciclo de caminata, parpadeo, respiración y poses. Tres vestuarios: ladrón (gorro y antifaz), guardia, civil.
- `sets.tsx`: aeropuerto de noche (estrellas, luna, ciudad con ventanas, torre con baliza, reflector, avión de carga sin marca, depósito "CARGA 261" con luz en la puerta, balizas de pista) y sala de alarma (luz roja y azul).
- `props.tsx` y `overlays.tsx`: calendario, bolsas de dinero, cronómetro (la aguja gira y la caja cuenta de 0 a 64), signos de pregunta, karaoke, titular y cajas de datos.
- Render: `pnpm --filter @radev/spike-video-v0 anim` (o `--stills 0:1.2,1:4.4` para cuadros sueltos): **15,2 s de video en 35,4 s** con concurrency 2 en la fábrica.

**El operador lo aprobó (2026-11-24): "es tal cual lo quería".** Pidió más ritmo en la voz: de 1,1 a 1,2 o 1,3. ElevenLabs acepta hasta `speed` 1,2, así que 1,3 sale de la toma a 1,2 acelerada con `atempo` de `ffmpeg` (×1,083, sin cambiar el tono; `tts/tempo.py`, que divide los tiempos de cada palabra por el mismo factor). Las 6 escenas: 42,4 s (1,1) → 37,9 s (1,2, 502 caracteres) → 34,9 s (1,3). Las escenas 1 y 2: 15,2 → 13,8 → 12,7 s; render 31 y 26 s. Como todo está enganchado a palabras, el video se reacomodó solo a cada velocidad, sin tocar el guion.

Videos en `Descargas\v0-6-animado\escenas-1-y-2-voz-{1.1,1.2,1.3}.mp4` (fábrica). **Velocidad: 1,3** (al operador le gustó 1,3, "el 1,2 tampoco está mal", y dejó la elección a criterio de Claude). Para el catálogo de voces (ADR 0027): la velocidad de una voz = `speed` de ElevenLabs (hasta 1,2) + un factor de `atempo` para lo que falte.

**Las 6 escenas (2026-11-24): 36,5 s de video en 62,7 s** (concurrency 2, fábrica; 11,9 MB). Escenas nuevas en el guion: 3) plano azul del depósito con la ruta roja que se dibuja hasta la bóveda, el punto del guardia que se va en "cambiaba la guardia", dos cámaras que se tachan en "nadie revisó" y una lista ✓ que se completa; 4) tienda de noche con un cliente que entra, un celular con la tienda, "−23 % de las ventas" contando, la página de pago cargando, "+3 SEG" y el cliente que mira el reloj y se va en "cargar"; 5) el dueño (delantal) señala un calendario "VIERNES 15" y la etiqueta "REVISÁ TU PÁGINA DE PAGO"; 6) el celular cargando, signos de pregunta y "CONTANOS EN LOS COMENTARIOS" con 1,6 s de cola después de la voz. Nuevo en el formato: escenarios `plano` y `tienda`, objetos `route`, `marker`, `securityCam` y `phone`, textos `checklist` y `tag`, pose `point`, vestuario `dueno` y `tail`. Video: `Descargas\v0-6-animado\completo-6-escenas-voz-1.3.mp4`.

**Falta:** que el operador mire el video completo; después, decidir de dónde salen los dibujos (código, como ahora, o una biblioteca libre),

## V0-7 · Licencias y condiciones

*En curso.* Primera lectura (2026-11-21), a confirmar en las páginas oficiales antes de cerrar:

| Herramienta | Licencia | Uso comercial | Nota |
|---|---|---|---|
| Remotion 4.0.545 | Licencia propia | **Gratis** para personas, organizaciones sin fines de lucro y empresas de **hasta 3 personas**; desde 4 se paga la Company License | El tope cuenta la suma de empresas que colaboran. Remotion 5.0 cambia la licencia con el mismo tope: revisar al actualizar |
| Kokoro-82M | Apache 2.0 (pesos), MIT (código) | Sí | Depende de espeak-ng (GPLv3) para idiomas que no son inglés. Datos de entrenamiento mayormente en inglés: el español puede sonar peor (lo decide V0-2) |
| Piper (OHF-Voice/piper1-gpl) | GPL-3.0 | Sí para generar audio; la GPL importa si se distribuye el programa | El repo original (MIT) quedó archivado en octubre de 2025. **Cada voz tiene su licencia**: revisar la ficha de cada una en V0-2 |
