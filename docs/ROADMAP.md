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

**Terminado cuando:** armo un carrusel en la app, lo descargo y lo publico a mano en TikTok. Desde acá el sistema ya ahorra trabajo real.

---

## Fase 3 — Generación con IA

- [ ] `packages/ai`: interfaz `AIProvider`, errores tipados (`validation`, `rate_limited`, `provider_error`)
- [ ] Proveedor `claude-code`: Claude Code CLI en la imagen del worker, `CLAUDE_CODE_OAUTH_TOKEN` (generado con `claude setup-token`), workspace temporal fuera del repo con el CLAUDE.md armado desde la base
- [ ] Proveedor `openrouter` con modelos gratuitos configurables
- [ ] Tabla `ai_routes` + pantalla de ruteo por tarea con respaldo
- [ ] Manejo de `rate_limited`: respaldo o reprogramación con backoff, y aviso
- [ ] Tabla `generation_runs`; topes diarios y mensuales por marca
- [ ] Tabla `brand_documents` y editor de voz, precios, casos y reglas con historial; seed desde `seeds/brands/`
- [ ] Pilares con porcentajes (CRUD) y WhatsApp de la marca
- [ ] Banco de ideas: carga rápida (mobile), listado, descarte
- [ ] Jobs `ideas.generate` (modelo gratuito) e `ideas.research` (Claude con búsqueda web)
- [ ] Series recurrentes, empezando por "¿Cuánto cuesta realmente...?"
- [ ] Job `carousel.generate` → versión nueva → `carousel.render`
- [ ] Rechazo con feedback y regeneración; regeneración automática por QA (máx. 2)
- [ ] Importación del historial de posts → `winners.json`
- [ ] Job `data.refresh` (Bluelytics) → `data.json` para Lumus
- [ ] Documentos de marca completos: `pricing.md` y `cases.md` de RAdev

**Paralelo (no depende del código):** crear la cuenta de TikTok de Lumus; registrar la app de desarrollador de TikTok; definir el número de WhatsApp de RAdev; crear el bot de Telegram.

**Terminado cuando:** toco "generar" y en unos minutos tengo un borrador renderizado que aprobaría con cambios mínimos, para ambas marcas, y veo en el panel qué proveedor y modelo lo generó.

---

## Fase 4 — Producción y piloto automático

- [ ] Servidor de producción: Oracle Always Free → si no hay capacidad, máquina propia con Cloudflare Tunnel → si no, VPS ≤ USD 5
- [ ] Hardening: usuario no-root, SSH con llave, firewall 22/80/443, actualizaciones automáticas
- [ ] DNS: `app.gestorlumus.site` y `media.gestorlumus.site` sin afectar Lumus
- [ ] Docker Compose de producción con Caddy (HTTPS, bloqueo de `/render/*`) y volumen de media
- [ ] Backup diario de Postgres y assets a R2 o B2 (capa gratuita) + prueba de restauración
- [ ] Tabla `schedule_slots` y configuración por marca (arrancar con 1 post/día en la franja 14–21 h)
- [ ] Calendario: arrastrar posts entre slots; programar, des-programar y re-programar
- [ ] Ventana de generación (por defecto 02:00–07:00) y job `slots.fill` respetando la mezcla de pilares
- [ ] Cola de revisión optimizada para celular
- [ ] Bot de Telegram (grammY): revisar, recordatorio de publicación manual, errores, límites de IA
- [ ] Vista de jobs (pendientes, fallidos, reintentos)

**Terminado cuando:** el sistema corre en el servidor, llena la semana solo durante la madrugada, y mi único trabajo es aprobar desde el celular y publicar con el recordatorio.

---

## Fase 5 — Publicación automática en TikTok

- [ ] Verificar `media.gestorlumus.site` en TikTok
- [ ] Tablas `social_accounts` (tokens cifrados) y `publications`
- [ ] Conexión de cuentas de TikTok por OAuth desde el panel
- [ ] Adaptador TikTok (modo foto, `PULL_FROM_URL`, 4:5; si la API no lo acepta, 9:16 derivado según ADR 0011); modo borrador hasta aprobar la auditoría
- [ ] Pantalla de publicación que cumpla las pautas de UX de TikTok (vista previa, edición del texto, consentimiento)
- [ ] Job `post.publish` idempotente con reintentos; `publish_failed` notificado
- [ ] Job `tokens.refresh`
- [ ] Solicitar la auditoría de TikTok con la app funcionando

**Terminado cuando:** un post aprobado sale solo a su horario en TikTok, sin abrir la app.

---

## Fase 6 — Medición y aprendizaje

- [ ] Job `metrics.sync` y tabla `post_metrics`
- [ ] Carga de capturas → extracción con IA → `audience_snapshots` / `post_metrics`
- [ ] Página de links pública por marca (`/l/[brand]`) con seguimiento de clics
- [ ] Botón de WhatsApp con mensaje precargado que incluye el código del post
- [ ] Registro de leads (carga rápida, búsqueda por código de post)
- [ ] Tablero por pilar, tipo de hook, horario y proveedor/modelo de IA
- [ ] Recomendaciones de horarios y de mezcla; `slots.fill` usa la mezcla ajustada

**Terminado cuando:** la app me dice qué contenido me trae clientes (RAdev) y registros (Lumus), y ajusta la mezcla en base a eso.

---

## Después de la v1

- Instagram (el formato ya es 4:5)
- LinkedIn
- Tipo de slide `code`
- Presets de estilo adicionales
- Video
- Múltiples usuarios con permisos por marca
