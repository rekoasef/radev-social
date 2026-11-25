# RAdev Studio — Análisis de arquitectura y roadmap actualizado

> **⚠ Documento histórico (2026-11-25).** Es el análisis del 2026-11-20, previo a V0. Las decisiones que tomó V0 (formato documental, voz de ElevenLabs, render entero) lo reemplazan en esos puntos. Lo vigente de V1 está en `docs/RADEV-STUDIO-REVISION.md` §7, `docs/decisions/0029-video-documental-y-oficinas.md` y `docs/ARCHITECTURE.md` §14.

**Fecha:** 2026-11-20 · **Estado:** propuesta para revisar juntos. No autoriza implementar.
**Entradas:** `docs/RADEV-STUDIO-SPEC.md` v0.1, `docs/AUDIT.md`, `docs/EVOLUTION-PLAN.md` y el estado real del repo (`main` en `7d114e8`, sin otras ramas, con `AUDIT.md` y `EVOLUTION-PLAN.md` sin commitear).
**Verificado en la notebook hoy:** Ryzen 7 7735HS (16 hilos), RTX 4050 Laptop 6 GB **visible desde WSL** (`nvidia-smi` responde), 15 GB de RAM en Windows y **7 GB visibles para WSL** (sin `.wslconfig`: WSL toma la mitad por defecto).

---

## Resumen

1. **La especificación es compatible con el repo.** Ratifica lo central del plan anterior (módulo propio, `videos` separado de `posts`, `video-worker` aparte, Remotion + FFmpeg, migraciones aditivas, dos puertas de aprobación) y cambia el **dónde** y el **con qué**: producción en la notebook y no en Oracle, proveedores locales antes que pagos, YouTube al final.
2. **Hay una contradicción de fondo con Social Studio**: la especificación pide no depender de la suscripción de Claude para producir, y Social Studio en producción depende justamente de `claude -p` con el token de la suscripción (ADR 0005 y 0009). Para Video la resuelvo diseñando sin esa dependencia. Para Social es una decisión aparte que no hay que mezclar con este trabajo (D-A).
3. **Las tres decisiones de arquitectura que más pesan, y que conviene tomar en V1 aunque la funcionalidad llegue después:**
   - El render es **por escena** y el video final se arma con FFmpeg. Si no, "regenerar una escena sin rehacer todo" (§6.3) no se puede cumplir.
   - Cada recurso se identifica por el **hash de sus entradas** (caché por contenido). Es lo que hace posibles la recuperación, la idempotencia y el no regenerar.
   - El video tiene **estados gruesos** y las escenas y los recursos tienen su propio estado. `paused` **no** es un estado: es una marca aparte. Si no, la máquina de estados explota.
4. **Riesgo más concreto del hardware**: no es la GPU, es la **RAM**. WSL tiene 7 GB para Postgres, Next en modo dev, el worker, el `video-worker`, Chrome de Remotion y un TTS. Hay que subirle el límite a WSL antes de medir nada.
5. **Propuesta**: V0 = cinco spikes medidos en la notebook (Remotion, TTS local, render por escena + concat, LLM local opcional, reuso de `packages/slides`). V1 = Shorts de 30–45 s con motion graphics, tipografía animada, personaje 2D propio en SVG, voz local, subtítulos y render MP4, todo en la notebook, sin publicar.

---

## 1. Compatibilidad con el repositorio actual

| Punto de la especificación | Compatible | Comentario |
|---|---|---|
| Monolito modular, una base, pg-boss, sin Redis ni microservicios (§13.1) | Sí | Es lo que hay. |
| `apps/video-worker` independiente (§13.3) | Sí | Respeta la regla 1 (las apps no dependen entre sí). Copia el patrón de arranque, logger y apagado de `apps/worker`. |
| `packages/video` con VideoSpec, Zod y Remotion (§13.2) | Sí | Mismo patrón que `packages/slides`. |
| Máquina de estados propia en `core` (§12) | Sí, con ajustes | Ver §3.4: `paused` como marca aparte y estados por escena. |
| Tablas propias, sin generalizar `posts` (§14) | Sí | Igual que D1 del plan anterior. |
| Reusar `packages/slides` (§13.4) | Probable | Son componentes React con tokens; hay que verificar que no importen nada de Next ni del DOM de `/render` (spike V0-5). |
| No usar `/render` para video | Sí | Remotion renderiza desde su propio bundle. |
| Streaming, `Range` y subidas por partes (§13.5) | **No hoy** | `/media` lee archivos enteros a memoria y solo sirve imágenes; las subidas van por Server Actions (~6 MB). Es trabajo de V1. |
| Proveedores intercambiables (§9) | Parcial | `packages/ai` ya tiene `AIProvider`, router y respaldo para LLM, más imágenes aparte. TTS, render y video no tienen interfaz todavía. |
| Registro de uso (§10) | Parcial | `generation_runs` registra LLM (tokens, duración, modelo). No registra TTS, render ni recursos de la máquina (CPU, RAM, VRAM). |
| Docker multi-arquitectura (regla 12) | Sí, con matiz | El MVP corre en la notebook (amd64). Remotion y la GPU en arm64 recién importan si algún día se renderiza en Oracle. |
| Marcas como datos (regla 6) | Sí, con decisión | La especificación dice "genérico para cualquier nicho" y "marca asociada" como opción. Ver D-B. |
| La IA no inventa cifras (regla 9) | Sí, más difícil | Con temas de historia o ciencia los "hechos" no vienen de una base de precios: hace falta investigación con fuentes. Ver §3.6. |

**Conclusión:** no hace falta reescribir nada de Social Studio. Los únicos cambios a código compartido para el MVP son agregados: el streaming de `/media`, columnas y CHECK nuevos en la base, y la sección Video en el panel.

---

## 2. Qué decisiones del plan anterior hay que actualizar

| Plan anterior (`EVOLUTION-PLAN.md`) | Especificación | Nueva postura |
|---|---|---|
| D1 — tabla `videos` propia | Igual (§14, regla 3) | **Se mantiene.** |
| D2 — ElevenLabs pago + TTS local para borradores | Local-first, pagos apagados (§8, §10.3) | **Cambia**: TTS local (Kokoro o Piper) como principal; ElevenLabs queda como proveedor opcional **apagado** hasta autorizarlo. |
| D3 — licencia de Remotion | Verificar licencias (§8) | **Se mantiene**, como tarea de V0. |
| D4 — render en Oracle, agrandar a 4/24 | Notebook como primer entorno (§15) | **Cambia**: se renderiza en la notebook. Oracle no se toca. La conexión notebook ↔ servidor se decide más adelante (D-E). |
| D5 — YouTube "privado + publicar con un toque" | Publicación no prioritaria (§17) | **Se pospone** a V6. El análisis sigue valiendo. |
| D6 — primer entregable: carrusel → Short | Shorts genéricos de cualquier tema (§18 V1) | **Cambia**: el MVP es un Short genérico. Carrusel → Short queda como caso de prueba barato, no como objetivo. |
| D7 — métricas en `network_posts` | V6 | Se pospone. |
| D8 — no respaldar renders | Igual (§13.5) | **Se mantiene.** |
| D9 — `language` en `brand_documents` | Idioma del contenido (§3.3) | **Se mantiene**, recién en V2 (en V1 el guion lo escribe el operador o se pega). |
| D10 — renombrar solo la interfaz | Regla 14 | **Se mantiene.** |
| D11 — música propia con licencia | §16 | **Se mantiene**, con `media_items` registrando origen y licencia desde V1. |
| D12 — `publishAt` en YouTube | V6 | Se pospone. |
| Estados: guion → voz → escenas → render | Suma investigación, storyboard y `paused` | **Cambia**, ver §3.4. |
| Fases V0–V6 (largos al final) | V0–V7 | **Se adopta la de la especificación**, con los ajustes de §6. |
| "Guion con Claude por defecto" | Claude Pro como herramienta, no como API (§8.2) | **Cambia**: el Director usa el router con proveedores que no dependen de la suscripción (Ollama local u OpenRouter gratuito), y Claude queda opcional. |

**Nuevo, que el plan anterior no tenía:** Director IA como orquestador de tareas, cuatro familias visuales, storyboard, modo automático y colaborativo, personajes persistentes, Cost Manager, medición de recursos locales, licencias por recurso, investigación con fuentes, LLM local.

---

## 3. Riesgos técnicos y contradicciones

### 3.1 Dependencia de la suscripción de Claude (contradicción)
- **Especificación §8.2**: no construir una dependencia obligatoria de la sesión personal de Claude, y verificar las condiciones autorizadas por Anthropic.
- **Repo**: Social Studio genera carruseles, rehace slides e investiga con `claude -p` y `CLAUDE_CODE_OAUTH_TOKEN` en el servidor (ADR 0005, ADR 0009, `ARCHITECTURE.md` §7).
- **Postura**: Video Studio se diseña sin esa dependencia (Ollama u OpenRouter gratuito como principal, Claude como opción). Para Social Studio, que es un cambio en producción, propongo revisarlo aparte. Si al verificar las condiciones de Anthropic hace falta cambiar el proveedor por defecto, el router ya permite hacerlo desde el panel, sin código.

### 3.2 RAM de la notebook, no la GPU
- WSL ve **7 GB**. Una corrida típica de V1 en paralelo: Postgres (~0,3 GB), `next dev` (~1–1,5 GB), worker social (~0,3 GB, más Chromium si renderizó), `video-worker` (~0,3 GB), Chrome de Remotion con 2–4 pestañas (~1–2 GB), TTS (~0,5–1 GB) y Docker Desktop. Queda justo.
- **Mitigación (V0)**: `.wslconfig` con `memory=11GB` (le deja ~4 GB a Windows) y `swap=8GB`. Es un cambio de configuración de la máquina, no del proyecto: lo confirmo con vos antes. Además, Remotion con `concurrency` bajo (2–4) y nada de GPU para el render en el MVP.

### 3.3 Regeneración individual contra un render monolítico
- Remotion renderiza una composición entera. Si el video final es **una** composición, cambiar una escena obliga a rehacer todo el render.
- **Propuesta**: cada escena se renderiza como su propio clip (Remotion `renderMedia` con su rango) con clave `hash(spec de la escena + recursos + versión de la plantilla)`, y el video final se arma con FFmpeg (concat, música con *ducking* bajo la voz y normalización de volumen).
- **Costo**: las transiciones que cruzan escenas se resuelven como entrada y salida dentro de cada clip. Hay que probar en V0 que el concat no deja cortes de audio ni saltos de cuadro (V0-3).

### 3.4 Máquina de estados
- Los 17 estados de la especificación mezclan **etapas** (`researching`, `producing`...) con **condiciones** (`paused`, `failed`).
- Si `paused` es un estado, cada etapa necesita su transición a `paused` y una vuelta que recuerde de dónde venía. Propuesta: `paused_at` y `pause_reason` como campos aparte; el job revisa la marca antes de seguir y, al reanudar, retoma desde la última tarea completa. Lo mismo para `failed`: conservar `failed_stage`.
- **Estados por escena y por recurso** (`pending`, `ready`, `stale`, `failed`): `producing` termina cuando todas las escenas están `ready`. Editar una escena la pasa a `stale` junto con lo que depende de ella (voz, clip, render final), y nada más.
- **Invariantes con test**: no hay voz definitiva sin guion aprobado, no se publica sin el video final aprobado, una edición posterior invalida la aprobación, y una falla no borra resultados.

### 3.5 Sobre-ingeniería de proveedores y costos (§9 y §10)
- La especificación pide capacidades declaradas, router multi-criterio, presupuestos, reservas y precios. Con **todo gratuito y local** en V1, casi nada de eso tiene algo para decidir.
- **Propuesta**: en V1, una sola tabla `usage_events` (categoría, proveedor, modelo, unidades, duración, CPU, RAM, VRAM, tamaño, `cost_usd = 0`, `cost_kind = local|free|paid`) y capacidades como objetos estáticos en código. `project_budgets`, `cost_reservations` y `provider_pricing` llegan con el **primer proveedor pago** (V5), que es cuando hay plata que proteger. La regla "pagos apagados por defecto" se cumple desde el día uno porque no hay ninguno.
- **Redundancia**: `generation_runs` ya registra los LLM. Opciones: (a) los LLM de video van a `generation_runs` con `video_id` y el resto a `usage_events`; (b) `usage_events` para todo lo de video. Recomiendo (a), que no duplica (D-C).

### 3.6 Hechos y fuentes en temas genéricos (regla 9)
- En Social, las cifras salen de documentos de la marca y de Bluelytics. En "historia" o "ciencia", los hechos son el contenido mismo.
- **Propuesta**: la investigación produce `claims` (afirmación + fuentes) validados con Zod; el guion solo puede citar `claims` por id; la revisión del guion muestra cada afirmación con su fuente. Sin búsqueda web el modo automático no puede investigar: un LLM local no busca. Opciones para V2: Claude con WebSearch (opcional, ver §3.1), fuentes pegadas por el operador o una API de búsqueda gratuita (a evaluar). En V1 el guion lo escribe o pega el operador.

### 3.7 Cuatro familias visuales con 6 GB de VRAM
- **Motion graphics y 2D** con Remotion: CPU, sin problema. Es el MVP.
- **3D con Blender**: viable en la notebook (Cycles con CUDA u OptiX en la 4050, o Eevee), como un "motor" que produce un clip que Remotion compone. V4.
- **Imágenes locales** (ComfyUI con SDXL o FLUX cuantizado): entran en 6 GB con modos de poca memoria, lentas. V4.
- **Video con IA local**: modelos chicos (del orden de 1–2 B parámetros) corren en 6–8 GB con baja resolución y minutos por clip de pocos segundos. Experimental, V5. La consistencia de personajes en ese régimen es pobre.
- **Abstracción que lo une todo**: cada escena tiene un `engine` (`remotion`, `blender`, `image`, `ai-video`, `user-clip`) que produce un **clip o una imagen**; Remotion siempre compone. Así sumar un motor no cambia el resto.

### 3.8 Personajes 2D "sencillos" y derechos
- Personajes de terceros (Lottie, Rive, packs) traen licencias a revisar una por una (§16).
- **Propuesta V1**: un muñeco propio en SVG, parametrizado (paleta de la marca, 3–4 poses, boca que se mueve con la amplitud de la voz). Sin licencias de terceros y consistente por definición. Los personajes persistentes generados por IA son de V4 en adelante.

### 3.9 TTS local en español
- **Kokoro**: pesos con licencia Apache 2.0, pocas voces en español (de España o neutras, no rioplatenses; a confirmar), rápido en CPU.
- **Piper**: muchas voces, pero **la licencia cambia según la voz** (algunas son de uso no comercial, a revisar una por una).
- **Tiempos por palabra para los subtítulos**: no está claro que ninguno de los dos los dé en español. Respaldo: alinear el audio con `whisper.cpp` o `faster-whisper` en CPU (V0-2).
- **Riesgo de calidad**: si ninguna voz local suena aceptable, la única salida "buena" es un proveedor pago. Eso lo decide el operador escuchando las muestras de V0.

### 3.10 Topología a futuro (notebook ↔ servidor)
- El MVP corre entero en la notebook, con la base local. Pero el panel de producción y los datos reales de las marcas están en Oracle, y Postgres no está expuesto.
- **Para V3–V6** hay que decidir: (a) Video Studio vive en la notebook con su base local y solo exporta los MP4; (b) `video-worker` en la notebook conectado a la base de producción por un túnel privado (Tailscale o túnel SSH; los dos gratis) y escribiendo la media al servidor; (c) render en Oracle para lo liviano. Nada de esto hace falta para V0–V2 (D-E).

### 3.11 Otros
- **Licencia de Remotion**: gratis para personas y empresas de hasta 3 empleados (a confirmar en remotion.dev/license). Si RAdev crece, hay costo.
- **Rendimiento de Chrome en WSL**: Remotion renderiza con Chrome por CPU; la GPU no ayuda en WSL sin configurar ANGLE o Vulkan. Medir en V0 sin depender de la GPU.
- **Tamaño del alcance**: la especificación describe un producto grande para un solo operador. El control de esto son las fases chicas con criterio de "terminado", y no adelantar infraestructura (Cost Manager, router multi-criterio) antes de que tenga algo que decidir.
- **PRD desactualizado**: la especificación quedó guardada en `docs/RADEV-STUDIO-SPEC.md`, pero el PRD todavía dice que el video está fuera de la v1. Hace falta un ADR que lo saque de ahí.

---

## 4. Qué tecnologías probar primero, por hardware

Orden según lo que pide V1 y lo que la notebook sostiene seguro:

| Prioridad | Tecnología | Por qué primero | Corre en | Medir |
|---|---|---|---|---|
| 1 | **Remotion** (`@remotion/renderer`, `@remotion/player`) | Es el motor de composición de todo lo demás | CPU (Chrome) | Segundos de render por segundo de video a 1080×1920 30 fps con concurrency 2/4/6; RAM pico; tamaño del MP4 |
| 2 | **FFmpeg** (del sistema, apt) | Concat por escena, mezcla, normalización, miniaturas | CPU (NVENC opcional) | Concat sin cortes; tiempo de mezcla; −14 LUFS |
| 3 | **Kokoro** y **Piper** | Voz local, gratis | CPU | Calidad (la escuchás vos), velocidad (RTF), licencia de cada voz, tiempos por palabra |
| 4 | **whisper.cpp / faster-whisper** (solo si el TTS no da tiempos) | Subtítulos palabra por palabra | CPU o GPU | Precisión de la alineación; tiempo |
| 5 | **Ollama** con un modelo de 7–8 B cuantizado (opcional en V0) | Director IA sin suscripción | GPU 6 GB | % de respuestas que pasan el Zod de una escena; calidad en español; tokens/s |
| Después | ComfyUI, Blender, video con IA | V4–V5 | GPU | — |

**No probar en V0**: generación de video con IA, Blender, ComfyUI, ElevenLabs y YouTube.

---

## 5. MVP de producción local (V1)

**Objetivo**: desde el panel, crear un Short de 30–45 s (9:16, español o inglés) de cualquier tema, con escenas de motion graphics, tipografía animada y un personaje 2D simple, voz local, subtítulos y música opcional; verlo, aprobarlo y descargar el MP4. Todo en la notebook y con costo cero.

**Cómo corre:**
```
docker compose up -d postgres                 # base local (como hoy)
pnpm dev                                      # web + worker social (como hoy)
pnpm --filter @radev/video-worker dev         # nuevo; se puede no levantar
```
En Docker, `video-worker` va con `profiles: ["video"]`: `docker compose up -d` no lo levanta salvo que se pida. Producción (Oracle) no cambia.

**Flujo:**
1. **Nuevo video** (Video → Nuevo): marca, formato (9:16 en V1), idioma, duración objetivo y tema.
2. **Guion**: el operador lo escribe o lo pega, en un formulario por escenas validado por Zod. Botón opcional "Proponer con IA" usando el router existente con un proveedor que no dependa de la suscripción (si V0-4 sale bien).
3. **Aprobar guion** (primera puerta). Recién ahí se genera la voz definitiva.
4. **Voz**: `voice.synthesize` por escena, en caché por hash (texto, voz, modelo, ajustes), con duración y tiempos por palabra.
5. **Escenas**: cada una tiene plantilla y datos (`kineticTitle`, `statement`, `list`, `bigNumber` con cifras dadas, `quote`, `character` con el muñeco SVG, `image` con un recurso propio, `cta`). Las duraciones salen del audio.
6. **Render**: `scene.render` por escena (clip con su hash) → `video.assemble` (FFmpeg: concat, música con *ducking*, normalización, miniatura) → QA (duración contra el audio, cuadros negros, volumen, texto dentro de la zona segura en cuadros clave).
7. **Revisar** (segunda puerta): Remotion Player en el panel (vista previa sin render) y el MP4 real, servido con `Range`. Aprobar, rechazar con nota o editar (vuelve a `composing` y solo se rehacen las escenas `stale`).
8. **Descargar** el MP4 y publicarlo a mano.

**Fuera del MVP**: investigación automática, storyboard con imágenes, modo automático completo, editor rico, personajes generados, 3D, imágenes o video con IA, presupuestos, YouTube, formato horizontal, videos largos.

---

## 6. Tareas concretas de V0 y V1

### V0 — Spikes medidos (sin tocar `main` ni producción)

Todo en una rama `spike/video-v0` o en carpetas `.scratch/` (ignoradas por git), descartable. Resultado: un informe con números y las decisiones firmadas.

| # | Tarea | Hecho cuando |
|---|---|---|
| V0-0 | **Preparar la notebook**: proponer `.wslconfig` (RAM y swap de WSL), confirmarlo con vos y aplicarlo; verificar `nvidia-smi` en WSL (ya responde) | WSL ve ~11 GB |
| V0-1 | **Remotion**: composición de 30 s a 1080×1920 30 fps con tipografía animada, una lista, un número grande y transiciones; render con concurrency 2, 4 y 6 | Tiempo, RAM pico, CPU y tamaño anotados |
| V0-2 | **TTS local**: Kokoro y Piper con el mismo texto de 40 s en español y en inglés; anotar la licencia de cada voz; probar si dan tiempos por palabra, y si no, alinear con whisper | Elegís una voz por idioma escuchando las muestras; hay subtítulos sincronizados |
| V0-3 | **Render por escena + FFmpeg**: las 5–6 escenas de V0-1 como clips separados, concat, voz y música con *ducking*, normalización; cambiar el texto de una escena y rehacer solo esa | Sin cortes audibles ni saltos de cuadro; el re-render parcial tarda solo lo de esa escena |
| V0-4 | **LLM local (opcional)**: Ollama con un modelo de 7–8 B cuantizado, pidiendo el guion por escenas con el JSON Schema de Zod; 20 corridas | % que pasa Zod, tokens/s y calidad leída por vos |
| V0-5 | **Reuso de `packages/slides`**: importar un look de `studio` y `SlideFrame` dentro de Remotion | Funciona sin Next, o queda la lista de qué lo ata |
| V0-6 | **Personaje SVG**: muñeco propio con 3 poses y boca sincronizada con la amplitud de la voz | Se ve aceptable para vos |
| V0-7 | **Licencias**: Remotion, voces elegidas, modelo de Ollama, fuente de música; condiciones de Anthropic para uso automatizado con suscripción (para D-A) | Tabla de licencias con enlaces |
| V0-8 | **Informe y ADR**: resultados, ADR "Video Studio en el alcance" (actualiza PRD §8), ADR de motores y TTS, ADR del render por escena | Revisado y aprobado por vos |

**Criterio de "terminado":** sabemos cuánto tarda y cuánto consume un Short de 30–45 s en la notebook, qué voz usamos y si el render por escena funciona.

### V1 — MVP de producción local

| # | Tarea | Notas |
|---|---|---|
| T1 | Docs: actualizar PRD, ARCHITECTURE y ROADMAP con la especificación, y sumar la sección Video a `CLAUDE.md` (comandos) | Con los ADR de V0 |
| T2 | `packages/video`: schemas Zod de `VideoScript`, `Scene` (tipos de V1), `VideoSpec`; límites por duración e idioma; claves de hash | Tests obligatorios (schemas) |
| T3 | `core/videos`: máquina de estados (todos los estados definidos, en V1 se recorre el subconjunto), estados de escena y recurso, `paused_at` y `failed_stage`, reglas de invalidación | Tests de invariantes (regla 3 replicada) |
| T4 | `db`: migración solo aditiva: `videos`, `video_scripts`, `video_scenes`, `voice_tracks`, `media_items` (con origen y licencia), `video_renders`, `usage_events`; `generation_runs.video_id` y tareas nuevas en los CHECK | Revisar antes qué se extiende para no duplicar |
| T5 | Media: `/media` con streaming y `Range` para mp4, webm, mp3, wav y ogg (los videos detrás de la sesión); escritura por streaming; subida por partes para recursos (Route Handler, no Server Action) | Primer cambio a código compartido: con tests y sin tocar cómo se sirven las imágenes |
| T6 | `apps/video-worker`: pg-boss, logger, apagado ordenado, colas `voice.synthesize`, `scene.render`, `video.assemble`; Dockerfile con destino `video-worker` (ffmpeg + Chrome de Remotion) y perfil `video` en Compose | El worker social no cambia |
| T7 | TTS: interfaz `TtsProvider` en `packages/ai/src/tts/`, el proveedor elegido en V0, caché por hash, alineación si hace falta, registro en `usage_events` | Tests de la caché y de los errores |
| T8 | Composiciones Remotion: 7–8 plantillas de escena, subtítulos, zona segura de Shorts, tokens de la marca (y looks de `studio` si V0-5 dio bien), muñeco SVG | Verificación visual con capturas, como DESIGN-SYSTEM §10 |
| T9 | Render y armado: clip por escena con caché, concat + música + normalización + miniatura con FFmpeg, QA del video, medición de tiempo, CPU, RAM y tamaño | Idempotente: rehacer un job no duplica ni vuelve a renderizar lo que ya existe |
| T10 | Panel → Video: listado (en curso, en revisión, terminados), nuevo video, formulario de guion por escenas, aprobar guion, estado de producción, Player, revisión (aprobar, rechazar, editar) y descarga | Server Actions con Zod; la web solo encola (regla 5) |
| T11 | Prueba de punta a punta: un Short en español y otro en inglés, de dos temas sin relación (por ejemplo "cómo funciona la IA" y un tema de historia); `PROGRESS.md` | Criterio de abajo |

**Criterio de "terminado" de V1:** desde el panel, con la notebook, armo un Short de 30–45 s en español y otro en inglés, los veo y los apruebo, descargo un MP4 de calidad aceptable, y cambiar el texto de una escena rehace solo esa escena y el armado final.

**Fuera de V1** (aunque esté en la especificación): el Director IA con investigación y modo automático (V2), el editor rico y los personajes persistentes (V3), Blender e imágenes locales (V4), video con IA (V5), YouTube (V6) y largos (V7).

---

## 7. Roadmap actualizado

Toma el de la especificación con cuatro cambios: (1) la caché por hash y el render por escena se adelantan a **V1** como base, aunque el editor de regeneración siga en V3; (2) la medición de recursos arranca en V1 y el Cost Manager con presupuestos se pasa a V5, con el primer proveedor pago; (3) se suma la decisión de topología antes de V6; (4) YouTube sigue en V6.

| Fase | Entrega | Terminada cuando |
|---|---|---|
| **V0** — Spikes | Remotion, TTS local, render por escena, LLM local (opcional), reuso de slides, muñeco SVG, licencias, ADR | Números reales y decisiones firmadas |
| **V1** — MVP local | Short 9:16 de 30–45 s, guion manual, voz local, subtítulos, motion graphics, muñeco 2D, render por escena + FFmpeg, revisión en el panel, descarga | §6, criterio de V1 |
| **V2** — Director IA básico | Investigación con `claims` y fuentes, guion por escenas con IA (sin depender de la suscripción), storyboard (texto + vista previa con Player), modo automático y colaborativo, documentos por idioma, formato 16:9 | Un tema → video estructurado con intervención mínima |
| **V3** — Editor y regeneración | Editor por escenas (reordenar, duración, reemplazar recursos, voz), regenerar una escena desde el panel, versiones, consistencia básica (paleta y personaje por proyecto) | Cambiar una escena no reconstruye el resto (ya garantizado por V1; acá llega la interfaz) |
| **V4** — Visual avanzado | Motor `blender` (clips 3D), motor `image` local (ComfyUI), personajes persistentes con referencias, biblioteca de recursos | Mejor calidad sin perder estabilidad |
| **V5** — Video con IA y proveedores pagos | Modelos locales de video (experimental), proveedores externos **apagados por defecto**, Cost Manager completo (presupuestos, reservas, aprobación previa, alertas), comparación de calidad y costo | Hay alternativas para las escenas que lo justifiquen, sin gasto no autorizado |
| **Decisión de topología** (antes de V6) | Dónde vive Video Studio en "producción": notebook sola, worker remoto con túnel o un servidor | ADR firmado |
| **V6** — Publicación y analytics | OAuth de Google, subida reanudable, privado + publicar con un toque o `publishAt`, miniaturas, `youtube.sync`, tablero | Un video aprobado llega solo a YouTube |
| **V7** — Videos largos | Capítulos, guion por capítulos, B-roll, narración extensa, render nocturno | Un largo de 8–12 min aprobable con cambios mínimos |

---

## 8. Decisiones para revisar juntos

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D-A | Suscripción de Claude en **Social Studio** (producción actual) | Dejarla como está / verificar condiciones y, si hace falta, pasar a otro proveedor | Verificarlo en V0-7 y tratarlo aparte de Video |
| D-B | ¿Todo video pertenece a una marca? | `brand_id` obligatorio (los nichos nuevos son marcas nuevas, como datos) / opcional | Obligatorio: reusa identidad, voz y topes sin casos especiales |
| D-C | Registro de uso | LLM en `generation_runs` + resto en `usage_events` / todo en `usage_events` | La primera |
| D-D | Render por escena + concat con FFmpeg | Sí / composición única | Sí, si V0-3 confirma que no hay cortes |
| D-E | Topología a futuro | Notebook sola / worker con túnel a producción / servidor | Decidir antes de V6 |
| D-F | `paused` y `failed` como marcas aparte, no como estados | Sí / como en la especificación | Sí |
| D-G | TTS principal | Kokoro / Piper / pago | Según las muestras de V0-2 |
| D-H | LLM del Director | Ollama local / OpenRouter gratuito / Claude opcional | Ollama + OpenRouter como respaldo, según V0-4 |
| D-I | Ajustar `.wslconfig` en la notebook | Sí (11 GB + swap) / no | Sí, en V0-0, con tu confirmación |
| D-J | Muñeco 2D propio en SVG | Propio / packs de terceros con licencia | Propio |
| D-K | Commit de la especificación y estos documentos (ya están en `docs/`, sin commitear) | Commit ahora / junto con los ADR de V0 | Junto con los ADR de V0, una vez aprobados |

---

## 9. Lo que no verifiqué

- Las licencias, cuotas y condiciones de Remotion, Kokoro, Piper, los modelos de Ollama, Anthropic y Google: están marcadas "a confirmar" y son la tarea V0-7.
- El rendimiento real: los consumos de §3.2 son estimaciones, y medirlos es justamente V0.
- Si los componentes de `packages/slides` se pueden importar fuera de Next (V0-5).
