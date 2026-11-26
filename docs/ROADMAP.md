# Roadmap

Regla: **cada fase termina en algo usable** y tiene un criterio de "terminado" verificable. No se empieza una fase sin cumplir el criterio de la anterior. Sin fechas: al terminar la Fase 0 se usa su duración real como referencia para estimar el resto.

Fases 0 a 3: **100% local** (WSL + Docker Desktop). Servidor recién en la Fase 4. Costo: USD 0.

---

## Fase 0 — Cimientos (local)

- [x] Monorepo con pnpm workspaces + Turborepo (`apps/web`, `apps/worker`, `packages/core`, `packages/db`, `packages/slides`, `packages/ai`, `packages/publishers`)
- [x] TypeScript strict compartido, Biome, Vitest
- [x] Next.js App Router + Tailwind + shadcn/ui en `apps/web`
- [x] Docker Compose local: `postgres`, `web`, `worker` (esqueleto), con imágenes multi-arquitectura
- [x] Drizzle: tablas `brands`, `settings`; seed inicial de RAdev y Lumus desde `seeds/brands/` (sin assets todavía)
- [x] Better Auth con GitHub + lista blanca `ALLOWED_EMAILS`
- [x] Layout base del panel (navegación, selector de marca)
- [x] Sección "Comandos" del CLAUDE.md actualizada

**Terminado cuando:** levanto todo con un comando en WSL, entro con mi cuenta de GitHub, cualquier otra cuenta es rechazada, y veo RAdev y Lumus en el selector.

---

## Fase 1 — Design system, presets y gestión de marcas

- [x] Schemas Zod de `Slide` y `Carousel`, límites de caracteres y parser de énfasis
- [x] Tipografías curadas auto-hospedadas
- [x] Preset `bold` y preset `soft`, cada uno con su schema Zod de tokens
- [x] `SlideFrame` en formato `4x5` (único, ADR 0011), zonas seguras con la interfaz de TikTok, indicador de página
- [x] Plantillas v1: `cover`, `statement`, `question`, `cardGrid`, `flow`, `hubDiagram`, `comparison`, `costBreakdown`, `steps`, `bigNumber`, `chart`, `cta`
- [x] CRUD de marcas: crear, editar, archivar, borrar (solo sin posts)
- [x] Editor de identidad visual: elegir preset, formulario de tokens generado desde el schema, vista previa en vivo con slides de ejemplo
- [x] Tabla `brand_assets` y subida de assets (validación de tipo y tamaño); seed con los assets de Lumus
- [x] Página de preview de todos los tipos de slide por marca
- [x] Confirmar las zonas seguras superponiendo un render real sobre la captura de TikTok
- [x] Calibrar límites de caracteres con casos extremos
- [x] Tests de schemas de contenido y de tokens

**Terminada el 2026-09-24.**

**Terminado cuando:** la app reproduce fielmente las cuatro referencias de RAdev (con las reglas unificadas del preset), apruebo las slides sin referencia y un carrusel de ejemplo de Lumus, y puedo crear una tercera marca de prueba desde el panel, cambiarle colores, tipografías y logo, y ver el resultado sin tocar código.

---

## Fase 2 — Editor, render y exportación

- [x] Tablas `posts` (con `public_code`), `post_versions`, `assets`, `content_pillars`
- [x] Máquina de estados en `packages/core` con tests de invariantes
- [x] Listado de posts por marca con filtros por estado
- [x] Editor de carrusel: formulario por tipo de slide, reordenar, vista previa en vivo
- [x] Versionado: ver y restaurar versiones
- [x] Ruta interna `/render/[versionId]/[index]` con token y señal `__renderReady`
- [x] Worker con pg-boss y job `carousel.render` (Playwright, 4:5)
- [x] QA de render (desborde, zona segura, fuentes y assets)
- [x] Exportar: ZIP con PNGs 4:5 + copy, y copiar el copy con un toque
- [x] Adaptador `manual`: marcar como publicado
- [x] Ajustes a mano por arrastre (título, contenido, elemento gráfico) con guías y límites (ADR 0013)

**Terminado cuando:** armo un carrusel en la app, lo descargo y lo publico a mano en TikTok. Desde acá el sistema ya ahorra trabajo real.

> Cerrada el 2026-09-24 con todo lo de arriba hecho, pero **sin la publicación real**: queda pendiente para el primer post de verdad (ver `PROGRESS.md`).

---

## Fase 3 — Generación con IA

- [x] `packages/ai`: interfaz `AIProvider`, errores tipados (`validation`, `rate_limited`, `provider_error`)
- [x] Proveedor `claude-code`: Claude Code CLI en la imagen del worker, `CLAUDE_CODE_OAUTH_TOKEN` (generado con `claude setup-token`), workspace temporal fuera del repo con el CLAUDE.md armado desde la base
- [x] Proveedor `openrouter` con modelos gratuitos configurables
- [x] Tabla `ai_routes` + pantalla de ruteo por tarea con respaldo
- [x] Manejo de `rate_limited`: respaldo o reprogramación con backoff, y aviso (en el panel; el aviso por Telegram es de la Fase 4)
- [x] Tabla `generation_runs`; topes diarios y mensuales por marca
- [x] Tabla `brand_documents` y editor de voz, precios, casos y reglas con historial; seed desde `seeds/brands/`
- [x] Pilares con porcentajes (CRUD) y WhatsApp de la marca
- [x] Banco de ideas: carga rápida (mobile), listado, descarte
- [x] Jobs `ideas.generate` (modelo gratuito) e `ideas.research` (Claude con búsqueda web)
- [x] ~~Series recurrentes, empezando por "¿Cuánto cuesta realmente...?"~~ (quitadas en la Fase 6, ADR 0020)
- [x] Job `carousel.generate` → versión nueva → `carousel.render`
- [x] Rechazo con feedback y regeneración; regeneración automática por QA (máx. 2)
- [ ] ~~Importación del historial de posts → `winners.json`~~ → pospuesta a la Fase 6 (no hay historial con métricas)
- [x] Job `data.refresh` (Bluelytics) → `data.json` para Lumus
- [ ] Documentos de marca completos: `pricing.md` y `cases.md` de RAdev (lo completa el operador desde Marcas → Documentos; no bloquea: sin rangos la IA no muestra precios)

**Paralelo (no depende del código):** crear la cuenta de TikTok de Lumus; registrar la app de desarrollador de TikTok; definir el número de WhatsApp de RAdev; crear el bot de Telegram.

**Terminado cuando:** toco "generar" y en unos minutos tengo un borrador renderizado que aprobaría con cambios mínimos, para ambas marcas, y veo en el panel qué proveedor y modelo lo generó.

---

## Fase 4 — Producción y piloto automático

- [x] Servidor de producción: Oracle Always Free → si no hay capacidad, máquina propia con Cloudflare Tunnel → si no, VPS ≤ USD 5
- [x] Hardening: usuario no-root, SSH con llave, firewall 22/80/443, actualizaciones automáticas
- [x] DNS: `app.gestorlumus.site` y `media.gestorlumus.site` sin afectar Lumus
- [x] Docker Compose de producción con Caddy (HTTPS, bloqueo de `/render/*`) y volumen de media
- [x] Backup diario de Postgres y assets a R2 o B2 (capa gratuita) + prueba de restauración
- [x] Tabla `schedule_slots` y configuración por marca (arrancar con 1 post/día en la franja 14–21 h)
- [x] Calendario: arrastrar posts entre slots; programar, des-programar y re-programar
- [x] Ventana de generación (por defecto 02:00–07:00) y job `slots.fill` respetando la mezcla de pilares
- [x] `ideas.research` semanal automática (viene de la Fase 3: hoy es a mano desde /ideas)
- [x] Cola de revisión optimizada para celular
- [x] Bot de Telegram (grammY): revisar, recordatorio de publicación manual, errores, límites de IA
- [x] Vista de jobs (pendientes, fallidos, reintentos)

**Terminado cuando:** el sistema corre en el servidor, llena la semana solo durante la madrugada, y mi único trabajo es aprobar desde el celular y publicar con el recordatorio.

---

## Fase 5 — Publicación automática en TikTok

- [x] Verificar `media.gestorlumus.site` en TikTok (dominio raíz `gestorlumus.site`, en el sandbox)
- [x] Tablas `social_accounts` (tokens cifrados) y `publications`
- [x] Conexión de cuentas de TikTok por OAuth desde el panel
- [x] Adaptador TikTok (modo foto, `PULL_FROM_URL`, 4:5 aceptado en 1080×1350); modo borrador en la bandeja (definitivo, ADR 0017)
- [x] Job `post.publish` idempotente con reintentos; `publish_failed` notificado (y "Reintentar en TikTok")
- [x] Job `tokens.refresh`

**Terminado cuando:** un post aprobado llega solo a su horario a la bandeja de TikTok de la marca, listo para publicar con un toque, y los permisos se renuevan solos (ADR 0017).

---

## Fase 6 — Medición y aprendizaje

- [x] Job `metrics.sync` y tabla `post_metrics` (toda la cuenta: `network_posts` y `audience_snapshots`, ADR 0018)
- [ ] Carga de capturas → extracción con IA → `audience_snapshots` / `post_metrics`
- [x] ~~Página de links pública por marca (`/l/[brand]`) con seguimiento de clics~~ (quitada, ADR 0022)
- [x] ~~Botón de WhatsApp con mensaje precargado que incluye el código del post~~ (quitado con la página, ADR 0022)
- [x] Registro de leads (carga rápida, búsqueda por código de post)
- [ ] Tablero por pilar, tipo de hook, horario y proveedor/modelo de IA (sección Métricas hecha; falta proveedor y lo que traigan los leads)
- [ ] Recomendaciones de horarios y de mezcla; `slots.fill` usa la mezcla ajustada
- [ ] `winners.json` para la generación y reciclado de posts con buen rendimiento (RF-13): los dos necesitan métricas (vienen de la Fase 3). Opcional: importar como ejemplos de estilo las imágenes de posts viejos de RAdev desde Google Drive

**Terminado cuando:** la app me dice qué contenido me trae clientes (RAdev) y registros (Lumus), y ajusta la mezcla en base a eso.

---

## Video — V1 (RAdev Studio, formato documental)

Rama `feat/video-v1`. Detalle de cada tarea: `docs/RADEV-STUDIO-REVISION.md` §7.6; decisión: ADR 0029. Corre en la notebook.

**A. Las oficinas como sistema**
- [x] T1 Docs (ADR 0029, REVISION §7, ARCHITECTURE §14, PRD, PROGRESS)
- [x] T2 `packages/video`: schemas, controles, prompts, descripciones
- [x] T3 `core/videos`: etapas y eventos con tests de invariantes
- [x] T4 `db`: tablas de video, `transitionVideo`, seed de voces (migraciones `0028` y `0029`, aplicadas y probadas contra Postgres local)
- [x] T5 Voz de ElevenLabs en una toma (`packages/ai/src/tts`) — probada con `fetch` falso y con la toma real de la Mona Lisa; falta una llamada real (≈400 créditos) cuando se arme la oficina de Locución
- [x] T6 Cliente de Wikimedia Commons con filtro de licencias (probado con respuestas guardadas; falta una búsqueda real cuando se arme la oficina de Imágenes)
- [x] T7 `apps/video-worker` + oficinas 1 a 5 (hasta el guion) — corredor probado contra la base real con oficinas falsas; las oficinas con Claude y Commons de verdad se prueban en T9
- [x] T8 Oficinas 6 a 8 (voz, render 9:16 y 16:9, publicación) — probadas con fakes; el render probado de verdad con 3 escenas de la Mona Lisa; la voz, la publicación y las imágenes con servicios reales se prueban en T9
- [ ] T9 Comando de punta a punta: un video completo sin pantallas — **hecho y probado con servicios reales** (Betty y Barney Hill: 7 corridas de Claude, 1.917 créditos de voz, los dos formatos de 149 s, paquete completo); falta que el operador lo mire y lo apruebe para tildarla

**B. Tu escritorio en la web**
- [x] T10 Diseño visual del estudio y del escritorio (capturas aprobadas el 2026-11-26: el plano del piso, `docs/references/studio/`)
- [ ] T11 `/media` con `Range` y ZIP del paquete por streaming
- [ ] T12 Panel `/videos`: estudio, nuevo video, aprobar guion y video, descarga del paquete, informes
- [ ] T13 Docker: destino `video-worker` y perfil `video`
- [ ] T14 Punta a punta

**Terminado cuando:** dos videos de temas distintos salen desde el panel, los apruebo y descargo cada uno como una carpeta con el Short y el normal (video, miniatura y descripción), listos para subir a YouTube y guardar en Drive.

---

## Después de la v1

- Instagram (el formato ya es 4:5)
- LinkedIn
- Tipo de slide `code`
- Presets de estilo adicionales
- Video: **convertir nuestros carruseles en video** para TikTok (idea del 2026-09-28, a evaluar después de la Fase 5). Las slides ya renderizadas, con una narración por TTS, subtítulos sincronizados y música, armado con ffmpeg en el worker. Mantiene la identidad de marca (nada de clips de stock genéricos) y el costo bajo. Referencia: MoneyPrinterTurbo (guion → voz → subtítulos → clips → música → render). Antes de decidir: el costo de ffmpeg en el servidor gratuito (2 OCPU), un TTS gratuito y estable en español (Edge TTS no es una API oficial) y la licencia si se reusa código
- Múltiples usuarios con permisos por marca
- TikTok con publicación directa, sin pasar por la bandeja (ADR 0017: hoy se prefiere revisar antes de publicar): pantalla de publicación según las pautas de UX de TikTok (cuenta, privacidad sin valor por defecto, comentarios/dúo/stitch, contenido comercial, vista previa, consentimiento de música) y revisión + auditoría de la app con video de demo. Solo si el sandbox deja de alcanzar o se quiere publicar sin abrir la app
