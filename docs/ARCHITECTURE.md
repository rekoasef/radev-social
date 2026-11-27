# Arquitectura — RAdev Social

## 1. Estilo general

**Monolito modular + workers.** Un repo, una base de datos, tres procesos:

- **web**: lo que el operador ve y toca (panel, marcas, editor, calendario, revisión) y la ruta interna de render.
- **worker**: lo que trabaja solo en los carruseles (generar con IA, renderizar, publicar, sincronizar métricas).
- **video-worker** (RAdev Studio, ADR 0029): una cola por oficina del video. Corre en la notebook, no en el servidor (§14).

Postgres es la única fuente de verdad **y** el canal de comunicación: la web encola jobs (pg-boss), el worker los ejecuta. Sin llamadas HTTP de la web al worker, sin Redis, sin microservicios.

## 2. Entornos e infraestructura

Restricción de diseño: **costo cero**.

### Desarrollo (fases 0 a 3)
Todo local: Windows + WSL2 + Docker Desktop, con Docker Compose (`postgres`, `web`, `worker`). Se publica a mano con el adaptador `manual`. El repo vive en el filesystem de Linux de WSL.

### Producción (desde la Fase 4)
Opciones, en orden de preferencia:

1. **Oracle Cloud Always Free** — Ampere A1 (ARM), 2 OCPUs y 12 GB de RAM (límite vigente desde junio 2026). Capacidad no garantizada: puede requerir reintentos para crear la instancia.
2. **Máquina propia** (PC o notebook encendida) expuesta con **Cloudflare Tunnel** (gratis, sin abrir puertos). Requiere gestionar el DNS en Cloudflare (evaluar el impacto en Lumus, hoy en Vercel).
3. **VPS de hasta USD 5/mes**, priorizando la mayor RAM posible (idealmente ARM de 4 GB).

Requisitos: mínimo 2 vCPU y 4 GB de RAM para web + worker (Chromium) + Postgres. Todas las imágenes deben ser **multi-arquitectura** (`amd64` y `arm64`).

### Dominios
Subdominios de `gestorlumus.site` (dominio ya pago, comprado en Hostinger; Lumus corre en Vercel):
- `app.gestorlumus.site` → panel.
- `media.gestorlumus.site` → imágenes públicas (dominio a verificar en TikTok).

Los registros DNS se crean donde estén los nameservers del dominio (Hostinger o Vercel), sin tocar los registros de Lumus.

### Topología de producción

```
                         internet
                            │
                        ┌───▼───┐
                        │ Caddy │  HTTPS automático (Let's Encrypt)
                        └─┬───┬─┘
   app.gestorlumus.site   │   │   media.gestorlumus.site
                  ┌───────▼┐ ┌▼──────────────┐
                  │  web   │ │ volumen media │  PNG y assets públicos
                  └──┬───▲─┘ └───────▲───────┘
                     │   │ /render   │ escribe PNG
                     │   │ (interno) │
                  ┌──▼───┴───────────┴──┐
                  │       worker        │──► claude -p (suscripción Pro)
                  └──────────┬──────────┘──► OpenRouter (modelos gratuitos)
                             │                ──► TikTok, Telegram, Bluelytics
                  ┌──────────▼──────────┐
                  │ Postgres (+pg-boss) │
                  └─────────────────────┘
       + contenedor de backup: pg_dump + assets a R2/B2 (capa gratuita)
```

- El `video-worker` **no** está en esta topología: corre en la notebook del operador (V1, ADR 0029); el servidor sigue solo con los carruseles. El backup de un video es el paquete que el operador descarga y sube a Drive.
- `web` se construye con `output: "standalone"`.
- `worker` incluye Node, Chromium (Playwright) y Claude Code CLI.
- Postgres **no** publica puertos; solo accesible en la red de Docker.
- Caddy bloquea `/render/*` desde afuera; la ruta además exige `X-Render-Token`.
- El worker llama a la web por la red interna: `http://web:3000/render/...`.
- Seguridad del servidor: SSH con llave o contraseña y fail2ban (ADR 0019), firewall 22/80/443, actualizaciones automáticas.

## 3. Monorepo

```
apps/
  web/
    app/(panel)/brands/     CRUD de marcas: identidad, assets, documentos, pilares, slots, IA
    app/(panel)/posts/      listado, editor, versiones
    app/(panel)/calendar/   calendario (F4)
    app/(panel)/ideas/      banco de ideas
    app/(panel)/settings/   ruteo de IA, límites, integraciones
    app/render/             páginas de render (solo red interna)
  worker/
    src/jobs/               un archivo por job
    src/render/             Playwright + QA
packages/
  core/                     dominio puro (sin I/O)
    state-machine.ts        estados y transiciones de posts
    scheduling/             slots (`upcomingSlots`), zonas horarias (`zonedToUtc`), mezcla de pilares
  db/                       schema Drizzle, migraciones, queries, seed (lee seeds/brands)
  slides/
    schema/                 Zod: Slide, Carousel, ThemeTokens por preset
    frame/                  SlideFrame y zonas seguras
    presets/bold/           preset "bold" (estilo RAdev)
    presets/soft/           preset "soft" (estilo Lumus)
    templates/              un componente por tipo de slide (consumen el preset)
  ai/
    providers/claude-code/  ejecución aislada de claude -p
    providers/openrouter/   cliente HTTP
    router.ts               ruteo por tarea, respaldo, límites
    workspace.ts            arma el directorio temporal (prompt de sistema de la marca y prompt)
  publishers/
    types.ts                interfaz PublisherAdapter
    manual/ tiktok/
  video/                    (V1 de video, §14) schemas de las oficinas, controles, prompts, Commons, Remotion
apps/video-worker/          (V1 de video, §14) un job por oficina; corre en la notebook
seeds/brands/<slug>/        voice.md, pricing.md, cases.md, assets/ — datos iniciales
```

**Reglas de dependencia**: `core` no importa nada del repo. Los demás paquetes pueden importar `core`. `web` y `worker` importan paquetes, nunca entre sí.

## 4. Marcas como datos

Nada de una marca está en el código. Una marca es:

- **Identidad visual**: un `style_preset` (`bold` | `soft`) + `theme_tokens` (JSON validado con el schema Zod del preset).
- **Assets**: archivos subidos (logo, orbe, etc.), guardados en `MEDIA_DIR` y registrados en `brand_assets`. Los tokens los referencian por id; no se puede borrar uno en uso. Detalle en el ADR 0012.
- **Documentos**: voz, precios, casos y reglas, en Markdown, versionados en `brand_documents`.
- **Configuración**: pilares, slots, zona horaria, contacto (WhatsApp), topes de IA, objetivo de posts por día.

El **seed** (`pnpm db:seed`) crea RAdev y Lumus a partir de `seeds/brands/`. Después de eso, la base es la fuente de verdad y todo se edita desde el panel.

**Archivar vs. borrar**: marcas y pilares con posts se archivan (`archived_at`); desaparecen del panel y dejan de generar, pero conservan historial y métricas. El borrado definitivo solo se permite sin posts asociados.

**Pilares** (Marcas → Pilares, Fase 3, T9): el panel edita porcentajes enteros y la base guarda `target_share` de 0 a 1. **Los pilares activos suman siempre 100 %** (`checkPillarMix`, `packages/core/src/brands/pillars.ts`): la mezcla se guarda entera de una vez; un pilar nuevo entra con 0 %; un pilar sale (archivado o borrado) solo con 0 % y vuelve con 0 %. La `key` sale del nombre al crearlo y no cambia (la usan el contenido de los posts y la IA).

**Contacto** (Marcas → General, T9): `whatsapp_number` en formato internacional sin `+` (solo dígitos, 8 a 15, como lo toma `wa.me`) y `whatsapp_message_template`, que si existe tiene que llevar `{code}` (el código del post, para atribuir leads, RF-41) y ninguna otra variable. Reglas y armado del enlace en `packages/core/src/brands/contact.ts`.

## 5. Ciclo de vida de un post

La máquina de estados vive en `packages/core/state-machine.ts` y es la **única** forma de cambiar `posts.status`.

```
            ┌────────────── rejected (con feedback) ◄──────────┐
            ▼                                                  │
 [idea] → generating → rendering → in_review ──(approve)──► approved ──(schedule)──► scheduled
               │            │          │  ▲                                              │
               ▼            ▼          │  └── edición manual (nueva versión + re-render)  ▼
             failed      failed        └──(reject)─────────────────────────────────  publishing
               │                                                                        │   │
               └── retry ──► generating                                        published   publish_failed
                                                                                            │
                                                                            retry ──► publishing
```

Además, `rendering → generating` (`qaRegenerate`): una versión de IA que no pasa el QA del render vuelve a la IA (máx. 2, §7). Rechazar hace `reject` y `regenerate` en el mismo paso: `rejected` no se ve en el panel.

| Estado | Significado |
|---|---|
| `generating` | job de IA en curso (o esperando que se renueve un límite) |
| `rendering` | render + QA en curso |
| `in_review` | listo para revisar |
| `rejected` | rechazado con feedback; dispara regeneración |
| `approved` | aprobado, sin horario asignado |
| `scheduled` | aprobado y con horario; job de publicación encolado |
| `publishing` | publicación en curso |
| `published` | publicado |
| `publish_failed` | falló la publicación; reintentable |
| `failed` | falló generación o render (tras reintentos) |
| `archived` | descartado |

Invariantes con test obligatorio:
- No se llega a `scheduled`, `publishing` ni `published` sin haber pasado por `approved`.
- Editar un post `approved` o `scheduled` lo devuelve a `rendering` → `in_review`.
- Des-programar un post `scheduled` cancela su job de publicación.

**Programación (F4, T2)**: `posts.scheduled_at` es la **hora planeada** y `scheduled` quiere decir que el job `post.publish` está encolado. Editar un post programado le cancela el job pero conserva la hora; al aprobarlo de nuevo, si la hora no pasó, se programa solo (si pasó, se olvida y queda `approved`). Una hora por marca: índice único `(brand_id, scheduled_at)` sin contar archivados. El job, antes de publicar, confirma que el post siga `scheduled` para esa misma hora (`isPublishJobCurrent`), así un job viejo nunca publica. Reglas en `packages/core/src/scheduling/publish.ts`. El calendario (F4, T3) también mueve la hora planeada de posts que todavía se generan o revisan (`PLANNABLE_STATUSES`): no cambian de estado ni tienen job hasta que se aprueban.

Cada post tiene un **código público** corto e inmutable (`<prefijo de marca>-<número>`, ej. `RA-0142`, `LU-0031`) con el que se anotan los leads (Métricas → Leads).

## 6. Jobs (pg-boss)

Todos idempotentes (clave `singletonKey` derivada del objetivo), con reintentos y backoff.

| Job | Disparo | Qué hace |
|---|---|---|
| `ideas.generate` | manual / `slots.fill` (banco sin ideas para un pilar) | propone ideas desde pilares e historial (modelo gratuito por defecto) |
| `ideas.research` | cron semanal por marca | investiga temas del nicho con búsqueda web (Claude) |
| `carousel.generate` | manual, `slots.fill`, rechazo | idea → JSON validado → nueva versión |
| `slide.rewrite` | "Rehacer con IA" en el editor (clave `rewrite:<pedido>`) | reescribe una slide con la instrucción del operador, validada dentro del carrusel completo; deja una propuesta en `slide_rewrites` (el editor la consulta y el operador la usa o la descarta) |
| `art.generate` | tras generar o editar una versión cuyo look lleva imagen (clave `art:<versión>`) | genera las imágenes de portada y cierre con Cloudflare (ADR 0016), controla el fondo, las guarda y encola el render; nunca falla: sin imagen, el post sale con el diseño del look |
| `carousel.render` | tras generar o editar (o tras `art.generate`) | Playwright renderiza cada slide en 4:5, QA, guarda assets |
| `review.notify` | post entra a `in_review` (clave única, 5 min después o al terminar la ventana de generación) | un solo aviso por Telegram con los posts nuevos para revisar |
| `notify.send` | cualquier aviso guardado | envía una fila de `notifications` a Telegram (6 reintentos); una enviada no se reenvía |
| `post.publish` | `startAfter = scheduled_at`, clave `publish:<post>` | si el post sigue `scheduled` para esa hora (si no, se saltea) lo pasa a `publishing`: con TikTok conectado (activo y con `video.upload`) encola `tiktok.publish`; si no, queda para publicar a mano con aviso por Telegram |
| `tiktok.publish` | lo encola `post.publish`, clave `tiktok:<post>`; 4 reintentos desde 30 s | manda los JPEG a TikTok como borrador (`MEDIA_UPLOAD`), guarda el `publish_id` y consulta el estado hasta la bandeja (aviso por Telegram), publicado o fallido (ver §9) |
| `tiktok.confirm` | cron cada 5 min, clave `tiktok-confirm` | por cada borrador en la bandeja (publicación `inbox` con `publish_id`) consulta `status/fetch`: cuando trae el id público (el operador ya lo publicó desde la app) marca el post publicado con el link (de la primera página de `video.list`; sin `video.list` o si no aparece, sin link) y avisa por Telegram. A los 7 días sin publicar: `publish_failed` con el motivo y aviso. Sin borradores no llama a TikTok (ver §9) |
| `slots.fill` | cron cada 15 min; actúa solo **dentro de la ventana de generación** | llena los slots libres de los próximos 7 días respetando la mezcla (ver §7) |
| `data.refresh` | cron diario (19:00 de Buenos Aires; al arrancar el worker si no hay datos) o "Actualizar ahora" en Ajustes | snapshot de Bluelytics |
| `metrics.sync` | cron cada 4 h (Buenos Aires; al arrancar el worker si no hay métricas) o "Actualizar ahora" en Métricas, clave `metrics-sync` | por cada cuenta de TikTok conectada (con `video.list`): totales del día (`user.info.stats`), todos los posts con sus conteos (`network_posts` + fila del día en `post_metrics`), portadas descargadas a `media/metrics/tiktok/`, y vincula nuestros posts de los últimos 60 días con el suyo (id público que devuelve `status/fetch` para el borrador, o el link pegado al marcarlo publicado). Todo por upsert: correrlo dos veces no duplica (ADR 0018) |
| `tokens.refresh` | cron diario 04:30 (Buenos Aires) | renueva los tokens de cada cuenta `active`; si TikTok la rechaza, `reauth_required` + aviso "reconectá" (una vez por día); avisa 14 días antes de que venza el permiso (el refresh token dura un año); TikTok caído → sigue con las demás y reintenta |
| `backup.run` | cron diario | lo ejecuta el contenedor de backup |

**Jobs del video** (`video-worker`, §14; una cola por oficina, un video a la vez por cola): `video.research`, `video.sources`, `video.images`, `video.script`, `video.review` (hechos; T7) y `video.voice`, `video.render`, `video.package` (T8); `video.sweep` (cron cada 10 min) vuelve a encolar los videos trabados. Payload `{ videoId, stage, limitAttempt }`; un job de una etapa que el video ya dejó no hace nada (regla 8).

## 7. IA

### Proveedores

```ts
interface AIProvider {
  id: "claude-code" | "openrouter";
  generate<T>(task: GenerationTask<T>): Promise<GenerationResult<T>>;
}
// GenerationTask: tipo de tarea, marca, prompt, archivos de contexto, schema Zod, modelo, límites
// GenerationResult: data validada | error tipado (validation, rate_limited, provider_error), uso, duración
```

**Claude Code** (`claude-code`): ejecuta Claude Code headless con la suscripción Pro del operador.

```bash
claude -p \
  --output-format json \
  --json-schema '<JSON Schema derivado de Zod>' \
  --max-turns 3 \
  --system-prompt-file system-prompt.md \
  --tools "" \
  --model <modelo configurado para la tarea> \
  --no-session-persistence \
  --setting-sources project \
  --strict-mcp-config \
  < prompt.md
# ideas.research: --tools y --allowedTools "WebSearch,WebFetch", hasta 30 turnos
# con capturas (ADR 0024): --input-format stream-json --output-format stream-json --verbose
```

**Modo liviano (2026-09-29).** Las instrucciones de la marca **reemplazan** el prompt de sistema de Claude Code (`--system-prompt-file`) y el contexto de la tarea (`task.json`, `slides.md`, `recent-posts.json`…) va **dentro del prompt**, con el mismo formato que en OpenRouter (`packages/ai/src/inline.ts`). Sin herramientas (`--tools ""`), el modelo solo responde: 2 turnos, porque la salida estructurada usa una herramienta propia. El prompt entra por stdin (Linux corta cada argumento en 128 KB). Antes, el prompt de sistema y las herramientas de Claude Code pesaban ~27.000 tokens y se reenviaban en cada turno (4–8 turnos para leer los archivos): ~128.000 tokens de entrada por carrusel. Medido con el smoke: 982 tokens de entrada, 2 turnos, 1,9 s (antes, una tarea igual de chica: ~55.000 tokens, 3 turnos).

Verificado el 2026-09-24 con Claude Code 2.1.282 (Fase 3, T0):
- Se ejecuta con una lista de argumentos (sin shell): el JSON Schema va tal cual.
- `--max-turns` funciona aunque no aparece en `--help`: al pasarse devuelve `subtype: "error_max_turns"`.
- `--bare` **no sirve**: saltea el CLAUDE.md automático, pero en ese modo solo acepta `ANTHROPIC_API_KEY` (nunca lee el token OAuth de la suscripción). El aislamiento sale de ejecutar en la carpeta temporal; `--setting-sources project` y `--strict-mcp-config` evitan cargar ajustes, hooks y MCP del usuario.
- Sobre de salida (stdout, JSON): `is_error`, `structured_output` (objeto ya validado contra el schema), `result` (texto), `session_id`, `num_turns`, `duration_ms`, `usage`, `modelUsage` (nombre canónico del modelo), `total_cost_usd` (precio de lista; con la suscripción no se cobra), `terminal_reason`, `api_error_status`.
- **Errores**: salida con código 1 y el mismo sobre con `is_error: true`. Clasificar por `terminal_reason` y `api_error_status`, **no** por `subtype` (con un error de API queda en `"success"`). Ejemplos: modelo inválido → `terminal_reason: "api_error"`, `api_error_status: 404`; tope de turnos → `terminal_reason: "max_turns"`. El límite de uso de la suscripción se espera como `api_error_status: 429` (sin verificar: no se pudo provocar).

- **Autenticación**: `CLAUDE_CODE_OAUTH_TOKEN`, generado una vez con `claude setup-token` (consume de la suscripción Pro, sin costo extra). Alternativa: `ANTHROPIC_API_KEY` (pago por uso). **Nunca ambas definidas a la vez.**
- **Aislamiento**: por ejecución, `packages/ai/workspace.ts` crea `/tmp/radev-social/runs/<runId>/` (fuera del repo) y escribe:
  - `system-prompt.md` — las instrucciones de la marca armadas desde la base (voz + reglas + precios + casos): el `CLAUDE.md` de la tarea, pasado como prompt de sistema.
  - `prompt.md` — el prompt con los archivos de contexto adentro: `task.json` (idea, pilar, tipo de hook sugerido, feedback de rechazo, violaciones de QA), `recent-posts.json`, `winners.json`, `data.json` (según la tarea). `data.json` (`BrandData` de `packages/core/src/data`): `asOf`, `datasets` (series para `chart`) y `figures` (cifras ya escritas para `bigNumber`), armados desde el último snapshot de cada fuente de la marca.
  Claude Code se ejecuta con ese `cwd`, fuera de todo proyecto: no carga el CLAUDE.md de desarrollo. **Nunca se escribe un `CLAUDE.md` en el workspace**: se sumaría al prompt de sistema. El directorio se borra al terminar (se conserva si falló, para depurar).
- **Salida**: sobre JSON (`is_error`, `structured_output`, `session_id`, uso). Se valida otra vez con Zod.
- **Imágenes** (ADR 0024): una tarea con `images` manda por stdin **un mensaje** `stream-json` (cada imagen en base64 después de la línea "Captura `<id>`: <frase>", el prompt al final) y lee la respuesta como eventos: el sobre es el evento `type: "result"`, buscado parseando cada línea (el CLI no pone `type` primero). Mismos campos y errores que el sobre JSON. `prompt.md` del workspace guarda solo el texto.
- **Binario** (Fase 3, T4): `@anthropic-ai/claude-code` fijado (versión exacta) como dependencia de `packages/ai`; su script de instalación copia el binario nativo de la plataforma. Misma versión en desarrollo y en Docker, sin instalación global ni actualizaciones automáticas (`DISABLE_AUTOUPDATER=1`). Para cambiar de versión: subir el número en `packages/ai/package.json` y en las excepciones de `pnpm-workspace.yaml`.
- **Entorno del proceso**: `claude` recibe solo `PATH`, idioma, zona horaria, proxies y la credencial; nunca `DATABASE_URL`, `RENDER_TOKEN` ni otros secretos del worker. `HOME` y `CLAUDE_CONFIG_DIR` apuntan a `/tmp/radev-social/claude-home`, así en desarrollo no lee el `~/.claude` del operador (CLAUDE.md personal, skills, plugins).
- **Tiempo máximo**: 5 minutos por ejecución por defecto (`timeoutMs` de la tarea); al vencer, SIGTERM y a los 5 s SIGKILL. Un job cancelado (`signal`) corta igual.
- **Clasificación** (`packages/ai/src/claude-code.ts`): 429 o el texto "usage limit reached" → `rate_limited` (con el horario de reinicio si viene); `max_turns`, tiempo agotado, 5xx o salida ilegible → `provider_error` reintentable; 401/403 (credencial) y otros 4xx (modelo inválido) → `provider_error` no reintentable. Sin credencial, falla sin ejecutar; con las dos definidas, el proveedor no se crea.

**OpenRouter** (`openrouter`): API HTTP compatible con OpenAI, con modelos gratuitos.
- Sin herramientas: el contenido de los archivos de contexto se incluye en el prompt.
- Salida estructurada con el mismo JSON Schema; validación con Zod igual.
- **Nunca** se le envían datos privados (tokens, datos de clientes no publicables). Solo contenido destinado a ser público.
- La oferta de modelos gratuitos rota: los modelos se configuran desde el panel, nunca en código.
- **Solo modelos `:free`** (Fase 3, T5): el proveedor rechaza, sin llamar a OpenRouter, cualquier modelo cuyo id no termine en `:free` (regla 13). Un modelo pago solo se habilita a propósito (`allowPaidModels`). Además la cuenta no tiene saldo cargado: un modelo pago daría 402, nunca un cobro.
- **Pedido** (`packages/ai/src/openrouter.ts`): `POST /api/v1/chat/completions`. El `CLAUDE.md` de la marca va como mensaje de sistema; los demás archivos, con su nombre, en el mensaje del usuario junto con el JSON Schema en texto. Se pide `response_format: json_schema` (no estricto: el modo estricto no admite campos opcionales) con `provider.require_parameters: true`; si el modelo no lo soporta (404/400), se reintenta una vez sin él. El resultado siempre pasa por Zod. Tareas con herramientas (`ideas.research`) se rechazan. Tiempo máximo: 2 minutos.
- **Errores**: 429 → `rate_limited` (con `Retry-After` / `X-RateLimit-Reset`); 401 (key), 402 (saldo), 400/403/404 → no reintentables; 408, 5xx, errores dentro de una respuesta 200, respuesta cortada (`finish_reason: length`) o falla de red → reintentables.
- **Límites de la cuenta gratuita** (sin créditos comprados): 20 pedidos por minuto y **50 por día**. Además, cada modelo gratuito puede estar saturado: OpenRouter devuelve 429 "Provider returned error" aunque la cuenta tenga cupo. Conviene tener más de un modelo gratuito en el ruteo.

### Ruteo por tarea

Tabla `ai_routes` editable desde el panel. Valores iniciales:

| Tarea | Principal | Respaldo |
|---|---|---|
| `carousel.generate` | claude-code (modelo intermedio) | openrouter (modelo gratuito) |
| `ideas.generate` | openrouter (modelo gratuito) | claude-code |
| `ideas.research` | claude-code (con búsqueda web) | — |
| `caption.variants` | openrouter | claude-code |
| `metrics.extract` (capturas) | claude-code | — |
| `video.research`, `video.images`, `video.script`, `video.review`, `video.package` (ADR 0029) | claude-code (`sonnet`; el código fija el esfuerzo por oficina) | — |

Seed (Fase 3, T6): claude-code con `sonnet` y openrouter con `nvidia/nemotron-3-super-120b-a12b:free` (hasta la T13 era `nex-agi/nex-n2.5-pro:free`, que OpenRouter dio de baja); solo se cargan si la tarea no tiene ruta global. Se editan en **Ajustes → Ruteo de IA** (`/settings`), que por ahora edita solo las rutas globales; la tabla ya admite rutas por marca (`brand_id`), que ganan sobre la global (`resolveAiRoute`).

Reglas de una ruta (`checkAiRoute`, `packages/core/src/ai/routing.ts`; las aplican el panel y el servidor): modelo obligatorio; con openrouter, solo modelos `:free`; las tareas con herramientas o imágenes (`ideas.research`, `metrics.extract` y las cinco `video.*`) solo con claude-code; el respaldo no puede ser igual al principal.

Router (`packages/ai/src/router.ts`): prueba el principal y pasa al respaldo ante `rate_limited` o `provider_error` (cualquiera, también una credencial faltante), **nunca ante `validation`** (la respuesta llegó mal: se regenera con el mismo proveedor, T8), ni si el job se canceló. Devuelve todos los intentos para registrarlos. Si fallan los dos, decide el fallo más útil para el job: `rate_limited` (esperar y reintentar) antes que un error reintentable, y este antes que el resto; en empate, el del principal.

### Límites de uso

- **Límite del proveedor** (ej. ventana de Claude Pro agotada): el proveedor devuelve `rate_limited`. El router intenta el respaldo; si no hay respaldo, el job se reprograma con backoff creciente (15 min, 30, 60, 120 y después 240; `rateLimitDelayMs`, que espera al menos hasta el reinicio que informe el proveedor) y el post queda en `generating`. Si eso pone en riesgo un post programado en menos de N horas, avisa por Telegram.
- **Topes propios por marca**: máximo de generaciones por día y por mes (`brands.ai_daily_limit`, `brands.ai_monthly_limit`). Al alcanzarse, la generación automática se pausa y avisa; la manual pide confirmación. Cuentan solo las generaciones **exitosas de carruseles** (`carousel.generate`; los pedidos de ideas no, desde la T10), con el día y el mes en la zona horaria de la marca (`zonedPeriodStart`, `checkBrandAiQuota`). Vacío = sin tope; 0 pausa la generación. Se editan en Marcas → General.
- **Ventana de generación**: la generación automática (`slots.fill`) solo corre dentro de `settings.generation_window` (`{ enabled, start, end, timeZone }`, por defecto 02:00–07:00 de Buenos Aires y **apagada** hasta que el operador la active en Ajustes), para no competir con el uso del operador. Puede cruzar la medianoche.
- **Llenado (`slots.fill`, F4 T4)**: por marca activa, los horarios libres de los próximos 7 días con al menos 2 h de margen. Cada uno toma el pilar con más déficit (posts creados en los últimos 28 días más los planeados, contra el porcentaje objetivo; `pillarsByNeed`) que tenga una idea `new` en el banco (la suya o una sin pilar; la más vieja), y crea el post `generating` **planeado en ese horario** (`scheduled_at` + `slot_id`) desde la idea (la idea pasa a `used`); al aprobarlo se programa (§5). Si a algún pilar le faltan ideas, crea un pedido `ideas.generate` para el de más déficit (uno abierto por marca) y la pasada siguiente las usa. Topes: lo generado hoy y en el mes más lo que está `generating` (`fillBudget`). **Investigación semanal (F4 T5)**: en la misma pasada, cada marca a la que le toca (`researchDue`: ninguna `ideas.research` que haya funcionado o siga abierta en 7 días, y ningún intento en las últimas 24 h) recibe un pedido `ideas.research` (5 ideas, sin pilar ni foco). Resultado de la última pasada en `settings.slots_fill_last`, visible en Ajustes. Lógica pura en `packages/core/src/scheduling/fill.ts`.
- **Reintentos por QA**: máximo 2 regeneraciones automáticas; después queda `in_review` con las violaciones marcadas.
- Contexto mínimo: solo últimos posts y ganadores relevantes; `carousel.generate` sin búsqueda web.

### Vista de jobs (Fase 4, T8)

Ajustes → Cola de trabajos (`/settings/jobs`) lee `pgboss.job` con consultas propias de solo lectura (`packages/db/src/queries/jobs.ts`) y muestra pendientes, en curso, fallidos y recientes, cada uno con sobre qué trabaja y el motivo de la falla. "Reintentar" usa la API de pg-boss y solo aparece si repetir el job haría algo (`canRetryJob`, `packages/core/src/jobs-view.ts`); los de un post o un pedido de ideas ya marcado como fallido se reintentan desde el post o desde Ideas. No hay "Cancelar".

### Generación de un carrusel (Fase 3, T7)

"Generar con IA" (Nuevo post) crea el post en `generating` sin versión, con el pedido en `posts.generation_request`, y encola `carousel.generate`. El worker arma el workspace (`CLAUDE.md` de la marca, `task.json`, `slides.md` con la guía de plantillas, `recent-posts.json` con hook, look y secuencia de tipos de los últimos posts), pasa por la ruta de `carousel.generate`, registra cada intento y valida con `aiCarouselSchema` (pilares de la marca; `chart` y `bigNumber` solo si la marca tiene fuentes de datos: el dataset tiene que estar en `data.json` y la cifra, en sus `figures`; para una marca `studio`, `look` tiene que ser uno de los permitidos por `lookChoices`: los activos menos los de los 2 últimos posts; en una revisión, cualquiera de los activos: la IA mantiene el actual salvo que el feedback pida otro). OK → versión `ai` con su `generation_run_id`, `generationDone` y render. Respuesta mal armada → un reintento con los problemas como feedback. Límite → reprogramación con backoff (`generation_retry_at`). Error reintentable → reintento de pg-boss (2). Lo demás → `generationFailed`; el panel muestra los errores y "Reintentar generación".

Desde el **banco de ideas** (`/ideas`, T9), "Generar" abre Nuevo post con `?idea=<id>`: el formulario viene con el título y el ángulo (`ideaPrompt`) y el pilar de la idea. Al crear el post, la idea pasa a `used` en la misma transacción (`createGeneratingPost` con `ideaId`, que queda en `posts.idea_id`); si ya no estaba `new`, no se crea nada. Estados de una idea: `new` → `used` | `discarded`, y `discarded` → `new` (`packages/core/src/ideas/ideas.ts`); las descartadas no se borran.

### Capturas (ADR 0024)

- **Subida**: "Generar con IA" acepta hasta 4 capturas con su frase (solo marcas `studio`); `createGeneratingPost` las escribe en `media/<marca>/screens/` y las registra en `post_screenshots` en la misma operación (si el post no se crea, borra los archivos).
- **Generación**: `carousel.generate` y `slide.rewrite` las cargan (`loadScreenshots`; un archivo que falta se saltea con un aviso en el log), suman `screenshots.json` (id, frase, `device`), la sección Capturas de `slides.md` y una línea al prompt, y pasan las imágenes en `images` (las ve `claude-code`; OpenRouter, no). `aiCarouselSchema({ screenshots })` exige al menos una slide `screen` con ids del post (dos: un celular y una notebook).
- **Render**: `brandRenderContext(brand, postId)` suma las capturas del post a los assets (id → URL y tamaño): las usan el render del worker, la ficha y el editor. `screenComposition` elige el dispositivo por la proporción.
- **Medido** (Lumus, dos capturas, Claude): carrusel ~25.000 tokens de entrada y 45–64 s; rehacer una slide ~24.000 tokens y 4 s.

### Ideas con IA (Fase 3, T10)

- **Pedidos**: en `/ideas`, "Proponer ideas" (`ideas.generate`, modelo gratuito) e "Investigar temas" (`ideas.research`, Claude con `WebSearch` y `WebFetch`, hasta 30 turnos y 10 min). La web crea una fila en `idea_requests` (`queued`) con los parámetros (cantidad 3–8, pilar, foco) y encola el job con `singletonKey` `ideas:<id>`; no acepta otro pedido de la misma tarea mientras haya uno abierto. Se disparan **a mano**; la investigación semanal automática llega en la Fase 4. No cuentan para los topes.
- **Job** (`apps/worker/src/jobs/ideas-request.ts`): pasa el pedido a `running`, arma el workspace (`CLAUDE.md` de la marca, `task.json`, `recent-posts.json`, `existing-ideas.json` con las ideas del banco, también las descartadas) y valida con `ideaProposalsSchema` (`packages/ai/src/ideas.ts`): pilares de la marca (uno solo si el pedido lo fija), sin porcentajes ni montos en título o ángulo (`hasFigures`, regla 9), y en la investigación de 1 a 3 fuentes http(s) por idea. Descarta repetidas (`dropRepeatedIdeas`) y guarda las ideas (`source` `ai` o `research`, `sources`, `request_id`) **en la misma transacción que cierra el pedido** (`completeIdeaRequest`): un job repetido no agrega nada (regla 8). Respuesta mal armada → un reintento con los problemas; límite del proveedor → falla con aviso (es un pedido manual, no espera horas); error reintentable → reintento de pg-boss; si el último intento se rompe, el pedido queda `failed`. Cada intento va a `generation_runs` con `post_id` null.
- **Series**: quitadas (ADR 0020).
- **Rangos de precios**: en `carousel.generate`, cada rango de un `costBreakdown` (ítems y total) tiene que estar escrito en el documento de Precios de la marca (se compara sin mayúsculas, espacios ni tipo de guion). Si no, la respuesta se rechaza; con Precios vacío, ningún `costBreakdown` pasa (regla 9).

### Regeneración (Fase 3, T8)

- **Rechazo con feedback**: en la página de un post de IA en `in_review`, "Rechazar" pide qué cambiar (10 a 1.000 caracteres) y, en una transacción (`rejectAndRegenerate`), hace `reject` → `regenerate`, guarda `posts.rejection_feedback`, pone `posts.qa_regenerations` en 0 y encola `carousel.generate`. Mismo control de topes que "Generar con IA". Los posts armados a mano no se rechazan: se editan.
- **QA del render**: al terminar un render, `renderOutcome` (`packages/core/src/posts/regeneration.ts`) decide. Sin problemas → `renderDone`. Error de página o versión del editor con problemas → `renderFailed`. Versión de IA con problemas de QA y menos de 2 regeneraciones → evento `qaRegenerate` (rendering → generating), `qa_regenerations + 1` y `carousel.generate`. Con 2 → `renderDone`: queda `in_review` con los problemas marcados.
- **Qué recibe la IA**: si el post ya tiene versión, el workspace suma `previous.json` (la versión actual) y `task.json` trae `revision` con el feedback del último rechazo (mientras exista, vale para todas las regeneraciones del post) y los problemas del render de esa versión, descriptos por slide (`describeRenderProblems`). `recent-posts.json` excluye al propio post.

### Rehacer una slide (2026-09-29)

- En el editor, "Rehacer con IA" sobre la slide elegida, con una instrucción opcional (≤ 200 caracteres). La web crea una fila en `slide_rewrites` con el carrusel tal como está en el editor (aunque no esté guardado) y encola `slide.rewrite` (regla 5).
- El worker usa la ruta `slide.rewrite` (por defecto Claude, con el gratuito de respaldo), con el `CLAUDE.md` de la marca, `task.json` (slide, instrucción, reglas), `carousel.json` (sin los ajustes a mano) y `slides.md`. El cambio tiene que notarse: puede mantener el tipo, pero si la instrucción pide otro formato o más contenido del que el tipo admite, pasa al que corresponde. En marcas `studio`, `slides.md` suma la guía de composiciones del look del post (sin las que piden una imagen nueva, salvo que la slide ya la tenga), para que "se ve mal" cambie la estructura y no solo los textos. Portada y cierre siguen siéndolo.
- Si la respuesta es válida pero casi igual a la slide actual (`rewriteTooSimilar`: mismo tipo y composición, ≥ 75 % de las palabras en común), el worker pide **una** vez más con esa respuesta en `task.json` (`previousAnswer`); si ese segundo intento falla, guarda la primera.
- `aiSlideRewriteSchema` valida la slide **dentro del carrusel completo** con las reglas de `aiCarouselSchema` (límites, énfasis, precios, cifras reales) y devuelve como propios solo los problemas que causa la slide nueva. Un reintento con el feedback; al límite del proveedor falla con mensaje (es un pedido manual).
- El editor consulta el pedido cada 2,5 s y muestra la propuesta al lado: **Usar** (reemplaza la slide en el editor, sin sus ajustes a mano), **Otra vez** o **Descartar**. Nada cambia en el post hasta guardar. Probado con Claude: 9–12 s y ~12.000 tokens de entrada por pedido.

### Imágenes (ADR 0016, 0025, 0026)

- **Proveedor** (ADR 0025): Cloudflare Workers AI, `@cf/black-forest-labs/flux-2-klein-4b` (`packages/ai/src/images/cloudflare.ts`), 1024×1024, pedido como multipart. Tarda 15–36 s por imagen (espera máxima 90 s; `art.generate` vence a los 8 minutos). Gratis dentro del cupo diario (10.000 neuronas, ~105 por imagen). Tope propio: `ART_DAILY_CAP` = 60 por día.
- **Prompt**: la IA escribe en `art.cover` y `art.cta` un objeto en inglés (sin personas ni cosas con texto: lo controla Zod). `artPrompt` agrega siempre la dirección de foto editorial (objeto grande y entero, detalle de material), el fondo de la superficie de esa slide (`LOOK_ART`), el acento de la marca como color dominante del objeto y las reglas (sin texto ni personas).
- **Lugares** (ADR 0026): `artSlotsOf(look, slides)` dice qué imágenes pide el carrusel: portada y cierre siempre, `middle` si una afirmación tiene `photo` (con el fondo de la superficie de esa slide, `surfaces.ts`), y cuáles son escenas (`bleed`: `scenePrompt`, 1024×1280, sin control de fondo). `art.middle` es la descripción de la tercera imagen.
- **Flujo**: una versión cuyo look lleva imagen se guarda con `art.status = pending` (IA, editor, edición rápida, restaurar) y pasa por `art.generate` antes del render. Por cada lugar: reutiliza la imagen de otra versión del post si el prompt es idéntico (salvo "Generar imágenes nuevas"), si no genera, mide el brillo de los bordes en Chromium (oscuro ≤ 45, claro ≥ 210) y reintenta una vez si el fondo salió mal. Guarda en `media/<marca>/<post>/<versión>/art/<cover|cta|middle>.jpg` y deja el estado final (`ready`, `partial`, `skipped`, `failed`, con `note`). Siempre encola el render.
- **Render**: el render lee `post_versions.art` y pasa las URLs a la slide; el look la dibuja arriba (mezcla `screen` en oscuro, `multiply` con brillo en claro, grises en monocromo) en la capa "elemento gráfico" (ADR 0013).

### Registro
Cada ejecución queda en `generation_runs` con proveedor, modelo, uso, duración, turnos, estado y error. Cada `post_version` referencia su `generation_run`, para comparar rendimiento por modelo en el tablero.

## 8. Render

1. El worker abre `http://web:3000/render/<postVersionId>/<slideIndex>?format=4x5` con el token interno (hoy el único formato, ADR 0011).
2. La página carga el preset y los tokens de la marca desde la base, renderiza el `SlideFrame` y la plantilla al tamaño exacto, sin UI del panel.
3. Expone `window.__renderReady = true` cuando cargaron fuentes y assets.
4. **QA** en la página: desborde de texto (`data-qa="text"`), contenido fuera de la zona segura (`data-qa="content"`), fuentes cargadas. Devuelve violaciones.
5. Violaciones: si la versión vino de IA → regeneración con las violaciones como feedback (máx. 2); si vino de edición manual → error visible en el editor.
6. OK: PNG en `MEDIA_DIR/<brand>/<postId>/<versionId>/<format>/<index>.png` y, de la misma página, un JPEG (calidad 90, 1080×1350) en `<index>.jpg` para TikTok (el modo foto no acepta PNG), registrados en la misma fila de `assets`.

Render determinista: las decoraciones variables usan una semilla derivada del id del post.

## 9. Publicación

```ts
interface PublisherAdapter {
  network: "manual" | "tiktok";
  publish(input: PublishInput): Promise<PublishResult>;    // idempotente por (postId, network)
  checkStatus(externalId: string): Promise<PublishStatus>;
  refreshToken?(account: SocialAccount): Promise<SocialAccount>;
}
```

- `manual`: a la hora programada el post pasa a `publishing` con la publicación `pending` y espera; el operador lo publica a mano y marca "publicado" (el aviso por Telegram con link de descarga llega en la F4, T6).
- `tiktok`: Content Posting API, modo foto, `PULL_FROM_URL` desde `media.gestorlumus.site` (formato 4:5; verificar que la API lo acepte, ver ADR 0011). Antes de la auditoría: modo borrador a la bandeja.
- Instagram queda fuera de la v1; la interfaz ya lo contempla.

**Publicar en TikTok (F5 T6).** A la hora, `post.publish` elige TikTok si la marca tiene la cuenta `active` con `video.upload`; si no (sin cuenta, o hay que reconectarla), a mano como antes. `tiktok.publish` (`apps/worker/src/jobs/tiktok-publish.ts`): solo actúa si el post está `publishing` con la publicación de TikTok `pending`. Renueva el access token si vence en menos de 10 min (y una vez más si TikTok lo rechaza), arma las URLs `https://<MEDIA_DOMAIN>/<jpeg_path>` (si falta el JPEG de una versión vieja, lo hace del PNG con Chromium), manda título (hook, ≤ 90) y descripción (caption + hashtags, ≤ 4000) en modo `MEDIA_UPLOAD`, **guarda el `publish_id` antes de seguir** (un reintento sigue ese post, no manda otro) y consulta el estado cada 5 s (~2 min por corrida). `SEND_TO_USER_INBOX` → publicación `inbox`, el post sigue `publishing` y llega un aviso: el operador lo publica desde la app y `tiktok.confirm` (cada 5 min) lo marca publicado solo: el estado sigue diciendo `SEND_TO_USER_INBOX` pero trae `publicaly_available_post_id`, y con eso busca el link en `video.list` (`settleTiktokPublication`, idempotente; aviso con clave por post). "Marcar como publicado" queda como respaldo (publica la misma fila de TikTok). Un borrador que no se publica en 7 días pasa a `publish_failed` ("si lo publicaste, marcalo a mano"). `PUBLISH_COMPLETE` → `published`. Errores que reintentar no arregla (dominio sin verificar, límites de la cuenta, parámetros) → `publish_failed` con el motivo y aviso; los de permiso además dejan la cuenta `reauth_required`. Límite de TikTok, caída o fallo `internal` → reintento (con `internal` se olvida el `publish_id` y se manda de nuevo); sin reintentos, `publish_failed`. Un post `publish_failed` se puede publicar a mano (`retryPublish` → `publishDone`). Queda una ventana mínima de envío doble: morir entre la respuesta de TikTok y guardar el id. La renovación de tokens (acá y en `tokens.refresh`) pasa por `renewSocialAccountTokens`, que **bloquea la fila de la cuenta** mientras renueva: dos renovaciones a la vez no gastan el mismo refresh token (TikTok puede rotarlo); la segunda espera y usa el nuevo.

**Conectar la cuenta de TikTok (Login Kit, F5 T4).** Marcas → Canales → "Conectar TikTok": una Server Action guarda una cookie `tiktok_oauth` (httpOnly, `SameSite=Lax`, 10 min, solo `/api/tiktok`) con un `state` al azar y la marca, y redirige a TikTok con los scopes de `TIKTOK_SCOPES`. TikTok vuelve a `/api/tiktok/callback` (pide sesión del operador): se compara el `state`, se canjea el `code` por tokens (`packages/publishers/src/tiktok/oauth.ts`), se lee el nombre de la cuenta (`user.info.basic`; `username` pediría `user.info.profile`) y se guarda con `saveSocialAccount` (cifrado). El resultado vuelve como `?tiktok=` a Canales. Desconectar revoca el acceso en TikTok (si falla, igual borra) y borra la fila. La Redirect URI es `<BETTER_AUTH_URL>/api/tiktok/callback`: tiene que ser https, así que solo se prueba en producción. Esto corre en la web (solo llamadas HTTP; nada de IA ni Playwright).

## 10. Modelo de datos

Todas las tablas de contenido cuelgan de `brands`. Timestamps en UTC (`timestamptz`).

| Tabla | Campos principales |
|---|---|
| `brands` | id, slug, name, code_prefix (ej. `RA`), style_preset, theme_tokens (jsonb), timezone, posts_per_day_target (sin uso desde la F4: la cantidad sale de los horarios), ai_daily_limit, ai_monthly_limit, website (destino del cierre; gana sobre WhatsApp, ADR 0023), whatsapp_number, whatsapp_message_template, data_sources (text[]: fuentes de datos que usa su contenido, ej. `bluelytics`), archived_at |
| `brand_assets` | id, brand_id, role (`logo` \| `hero` \| `decoration` \| `other`), path (relativo a `MEDIA_DIR`), mime, width, height (null en un SVG sin tamaño), size_bytes, created_at, updated_at |
| `brand_documents` | id, brand_id, kind (`voice` \| `pricing` \| `cases` \| `rules`), content (markdown), version, created_at — la versión vigente es la más alta |
| `content_pillars` | id, brand_id, key, name, description, target_share (0–1), goal (`reach` \| `trust` \| `sales`, null), hook_types (jsonb), guide, closing, avoid (ADR 0021), archived_at |
| `ideas` | id, brand_id, pillar_id (null: elige la IA), title, angle, source (`manual` \| `ai` \| `research` \| `recycled`), status (`new` \| `used` \| `discarded`), sources (jsonb: `{ title, url }[]`), request_id, created_at, updated_at |
| `idea_requests` | id, brand_id, task (`ideas.generate` \| `ideas.research`), params (jsonb: count, pillarKey, focus), status (`queued` \| `running` \| `succeeded` \| `failed`), error, idea_count, created_at, finished_at |
| `posts` | id, brand_id, public_code, idea_id, pillar_id, hook_type, status, current_version_id, scheduled_at (hora planeada), slot_id (horario de la marca del que salió; null si se eligió a mano), rejection_feedback, created_at, updated_at |
| `post_versions` | id, post_id, number, content (jsonb `Carousel`), schema_version, origin (`ai` \| `manual`), generation_run_id, review_notified_at (ya avisada por Telegram), datasets (jsonb: puntos de sus `chart` por `datasetRef`, congelados al guardarla), created_at |
| `post_screenshots` (ADR 0024) | id, post_id (cascade), position (0–3, única por post), path (`<marca>/screens/<archivo>`), mime, width, height, size_bytes, note (qué muestra, para la IA), created_at |
| `assets` | id, post_version_id, format (`4x5`; enum ampliable), slide_index, path (PNG), width, height, checksum, jpeg_path, jpeg_checksum (el mismo slide en JPEG para TikTok; null en versiones renderizadas antes de la F5 T5) |
| `schedule_slots` | id, brand_id, weekday (0 = domingo … 6), local_time (`time`, hora de pared en la zona de la marca), active, created_at. Única por marca, día y hora |
| `social_accounts` | id, brand_id, network (`tiktok`), external_id (TikTok: `open_id`), handle, display_name, scopes (text[]: los otorgados), access_token_enc, access_expires_at, refresh_token_enc, refresh_expires_at, status (`active` \| `reauth_required`), last_error, created_at, updated_at. Única por marca y red, y por red y cuenta (una cuenta no puede estar en dos marcas). Desconectar borra la fila |
| `publications` | id, post_id, network, status (`pending` \| `inbox` \| `published` \| `failed`; `inbox`: borrador en la bandeja de TikTok), external_id (TikTok: `publish_id`), url, error, attempts, published_at. Una por post y red |
| `ai_routes` | id, task, brand_id (nullable = global), provider, model, fallback_provider, fallback_model. Única por tarea y marca, con una sola global por tarea (`NULLS NOT DISTINCT`) |
| `generation_runs` | id, brand_id (null en un video sin marca), post_id (null en pedidos de ideas), video_id (CASCADE; `brand_id` o `video_id` tiene que estar), task, role (`primary` \| `fallback`), provider, model, status (`succeeded` \| `failed`), error_kind, error, input_tokens, output_tokens, cost_usd (nullable), duration_ms, num_turns, session_id, created_at. Una fila por intento |
| `notifications` | id, key (única: nunca se guarda ni se envía dos veces la misma), kind (`review` \| `publish` \| `failure` \| `limit` \| `cap` \| `test`), text, silent, created_at, sent_at, error |
| `settings` | clave/valor global: `generation_window`, `slots_fill_last` (resultado de la última pasada del llenado) |
| `data_snapshots` | id, source (`bluelytics`), as_of (fecha del dato), fetched_at, payload (jsonb, validado al bajarlo). Uno por fuente y día: otro refresh el mismo día lo reemplaza |
| `network_posts` (F6, ADR 0018) | id, brand_id, network, external_id (id del post en la red, texto), post_id (nuestro post, si es uno), caption, url, kind (`photo` \| `video`), cover_path, published_at, views, likes, comments, shares (últimos), metrics_at. Única por red y external_id; un post nuestro tiene a lo sumo uno por red |
| `post_metrics` (F6) | id, network_post_id, captured_on (día en la zona de la marca), captured_at, views, likes, comments, shares, saves (solo capturas o a mano), source (`api` \| `screenshot` \| `manual`). Única por post, fuente y día: la última lectura del día gana |
| `audience_snapshots` (F6) | id, brand_id, network, captured_on, captured_at, data (jsonb: `followers`, `following`, `likes`, `videos`; las capturas pueden sumar más), source. Única por marca, red, fuente y día |
| `leads` (F6) | id, brand_id, name, contact, channel, post_ref, network_post_id, status (`new` \| `talking` \| `client` \| `lost`), notes, created_at, updated_at |
| `leads` (F6) | id, brand_id, name, contact, channel, post_code, source_post_id, status, notes, created_at |
| Better Auth | `user`, `session`, `account`, `verification` |
| `videos` (RAdev Studio, ADR 0029) | id, brand_id (nullable), topic, title, language, voice_id, form (la forma de contar que fijó el operador; null = automática, ADR 0030), contribution («tu aporte», la opinión del operador; null = sin aporte, ADR 0031), stage (una etapa por oficina), paused_at, pause_reason, resume_at, failure (jsonb), rejection_note, approved_at. La etapa solo cambia con `transitionVideo` (regla 2) |
| `video_documents` | id, video_id, kind (`dossier` \| `sources` \| `images` \| `script` \| `review` \| `voice` \| `render` \| `package`), version, data (jsonb validado con Zod), schema_version, origin (`office` \| `operator`), generation_run_id. Versionados: una versión nueva nunca pisa la anterior |
| `video_idea_requests` (migración `0032`) | id, brand_id (nullable), mode (`generate` \| `research`), focus, status (`queued` \| `running` \| `succeeded` \| `failed`), error, ideas (jsonb: tema, gancho, fuentes), model, input_tokens, output_tokens, cost_usd (equivalente por API, migración `0034`), duration_ms, created_at, finished_at. Aparte de `ideas` (Social): un video puede no tener marca y no tiene pilar |
| `voices` | id, provider (`elevenlabs` \| `kokoro`), external_id, name, use, language, speed, is_default, active |
| `usage_events` | id, video_id, office, kind (`tts` \| `render` \| `download`), quantity, unit, duration_ms, data |

`hook_type`: `cost`, `warning`, `myth`, `comparison`, `question`, `data`, `story`, `howto`.

## 11. Seguridad

- Better Auth con GitHub + lista blanca `ALLOWED_EMAILS`.
- Tokens de redes cifrados con AES-256-GCM (`TOKEN_ENCRYPTION_KEY`, 32 bytes en base64): `packages/db/src/token-crypto.ts`, formato `v1.<iv|tag|cifrado>` con la red, la cuenta y el tipo de token como datos autenticados (un token no se puede cambiar por otro). Solo `queries/social-accounts.ts` los lee o escribe; el resto recibe `SocialAccount`, sin tokens. La clave no viaja en los backups: sin ella hay que volver a conectar las cuentas.
- `/render` bloqueado en Caddy y protegido con token interno.
- Postgres sin puertos expuestos. Firewall: 22 (llave o contraseña, con fail2ban), 80, 443.
- Uploads de assets: tipo detectado por el contenido y hasta 5 MB; solo PNG, JPEG, WebP y SVG. Los SVG se sirven con `Content-Security-Policy: sandbox` y se cargan con `<img>`, así que sus scripts no corren (ADR 0012).
- `/media` es público y de solo lectura: nombres imposibles de adivinar y nada fuera de `MEDIA_DIR`.
- Nunca loguear secretos, tokens ni `.env`.

## 12. Variables de entorno

```
DATABASE_URL
BETTER_AUTH_SECRET, BETTER_AUTH_URL, ALLOWED_EMAILS
GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
CLAUDE_CODE_OAUTH_TOKEN          # o ANTHROPIC_API_KEY, nunca ambas
OPENROUTER_API_KEY
CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN   # imágenes (ADR 0016); sin ellas, posts sin imagen
RENDER_INTERNAL_TOKEN, WEB_INTERNAL_URL=http://web:3000
MEDIA_DIR, MEDIA_BASE_URL        # MEDIA_DIR vacío = <repo>/media (local)
TOKEN_ENCRYPTION_KEY
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET   (F5)
ELEVENLABS_API_KEY               # voz del video (ADR 0027); solo la usa el video-worker, en la notebook
BACKUP_S3_ENDPOINT, BACKUP_S3_REGION, BACKUP_S3_BUCKET, BACKUP_S3_KEY, BACKUP_S3_SECRET, BACKUP_PASSPHRASE (cifra los volcados; ver infra/backup/README.md)
```

## 13. Stack y por qué

| Capa | Herramienta | Por qué |
|---|---|---|
| Lenguaje | TypeScript strict | Tipos compartidos entre web, worker y plantillas |
| Web | Next.js App Router | Panel, editor y `/render` en un solo lugar |
| Estilos | Tailwind | Mismo CSS en preview y render; tokens como CSS variables |
| UI | shadcn/ui | Componentes con Tailwind, copiados al código |
| Formularios | React Hook Form + Zod | Reutiliza los schemas del contenido y de los temas |
| Base de datos | Postgres | Datos y cola en un solo lugar |
| ORM | Drizzle | TypeScript puro, liviano, migraciones legibles |
| Cola | pg-boss | Jobs programados y reintentos sobre Postgres, sin Redis |
| Auth | Better Auth (GitHub) | Sucesor recomendado de NextAuth; sesiones en Postgres |
| Validación | Zod 4 | Valida la salida de cualquier IA; genera el JSON Schema |
| Render | Playwright | Chromium real: resultado idéntico al preview |
| IA principal | Claude Code headless | Suscripción Pro existente, sin costo extra |
| IA secundaria | OpenRouter | Acceso a modelos gratuitos con una sola API |
| Fechas | date-fns + date-fns-tz | Zona horaria explícita |
| Calendario | FullCalendar o propio con shadcn | Arrastrar posts entre slots |
| Notificaciones | grammY (Telegram) | Gratis, moderno y tipado |
| Íconos | Lucide | Trazo fino, coherente con las marcas |
| Tests | Vitest + Playwright Test | Dominio y flujos del panel |
| Lint/formato | Biome | Una sola herramienta, rápida |
| Monorepo | pnpm + Turborepo | Builds y tests ordenados con caché |
| Infra | Docker Compose + Caddy | Portable entre local, Oracle, máquina propia o VPS |
| DNS/HTTPS | Registros en el DNS de gestorlumus.site + Let's Encrypt | Sin costo |
| Backups | R2 o B2 (capa gratuita) | Fuera del servidor, sin costo |

Decisiones razonadas en `docs/decisions/`.

## 14. Video (RAdev Studio, V1)

Alcance, tareas y criterio de aceptación: `docs/RADEV-STUDIO-REVISION.md` §7. Por qué este diseño: ADR 0029.

- **Formato documental**: imágenes de archivo de Wikimedia Commons con licencia libre, zoom lento, gráficos animados, subtítulos karaoke y voz de ElevenLabs (ADR 0027). Cada video dura 1,5–2,5 min y sale en **dos formatos**: Short (9:16) y normal (16:9).
- **Oficinas**: una línea de montaje fija. Cada oficina es una cola de pg-boss del `video-worker` que lee el documento vigente de la anterior y guarda el suyo en `video_documents`, validado con Zod (regla 4):
  ```
  Investigación → Fuentes → Imágenes → Guion → Verificación de hechos → [operador: guion]
    → Locución → Render → Publicación → [operador: video] → Descarga (ZIP)
  ```
- **Etapas**: máquina de estados en `packages/core/src/videos`; solo `transitionVideo` escribe la etapa (regla 2). Pausa y falla van como condición aparte, no como etapas.
- **Dónde corre**: en la notebook (`video-worker` + web local + Postgres local). El servidor no hace video. El backup es el paquete que el operador descarga y sube a Drive.
- **IA**:
  - `video.research` usa WebSearch y WebFetch, la misma excepción que `ideas.research` (ADR 0005).
  - `video.script` y `video.review` reciben las imágenes como visión (ADR 0024).
  - Todo número que se ve o se dice tiene que estar en el dossier (regla 9, controlado en código).
  - Corre un solo `claude -p` a la vez dentro del `video-worker`.
- **Render**: Remotion renderiza el video entero (sin clips por escena) con un Chrome propio, en las dos medidas. Lo usa solo el `video-worker`; la web nunca renderiza (regla 5).
- **Archivos**: en `media/videos/<id>/`. La web sirve los MP4 con `Range` (`/media/videos/…`, con `ETag` porque un re-render pisa el archivo) y arma el ZIP del paquete por streaming (`/videos/<id>/download`, solo aprobado), más `creditos.txt`:
  ```
  <slug>/short/video.mp4 · miniatura.png · descripcion.txt
  <slug>/normal/video.mp4 · miniatura.png · descripcion.txt
  ```
- **Tablas nuevas**: `videos`, `video_documents`, `voices` y `usage_events`. Además, `generation_runs.video_id`. Detalle en REVISION §7.3.
- **Lo que el estudio muestra además de la etapa** (T12, migración `0030`). Es solo información: nada decide a partir de esto y un error al guardarlo no frena la oficina.
  - `videos.progress`: lo que hace la oficina ahora (inicio, intento, porcentaje del render, problemas del intento anterior). Se limpia al cambiar de etapa.
  - `generation_runs.check_problems`: por qué una respuesta bien formada no pasó los controles.
  - `usage_events` con `kind = office`: cuánto tardó cada corrida de una oficina y cómo terminó.
  - `usage_events` con `kind = return` (migración `0031`): cada rechazo del operador, en la oficina que tiene que rehacer, con su nota. Lo escribe `transitionVideo` en la misma transacción.
  - `usage_events.data.quota` en cada locución: los créditos de ElevenLabs que quedan a ese momento (la web no tiene la credencial).
  - `voices.preview_url`: la muestra de cada voz, que el worker guarda al arrancar (no gasta créditos).

### 14.1 `video-worker` por dentro (T7, diseño del 2026-11-25)

**Una cola por oficina.** Los nombres van en `core` (`VIDEO_JOBS`), igual que `JOBS`: `video.research`, `video.sources`, `video.images`, `video.script`, `video.review` (T7) y `video.voice`, `video.render`, `video.package` (T8). Payload: `{ videoId, stage, limitAttempt }`. Cada cola tiene su propia tarjeta en el estudio, con lo que tiene en cola, lo que está haciendo y lo que falló (los datos salen de pg-boss).

**El "corredor" de oficinas** (`src/runner.ts`) es lo único que conoce la línea de montaje. Cada oficina es una función `run(ctx, video) → { document, extra? }` que no sabe de colas ni de etapas. El corredor:
1. **Guarda la regla 8.** Lee el video. Si su etapa ya no es la del job (un job repetido o viejo) o `canRunOffice` dice que no (pausado, con falla), termina sin hacer nada. Una pausa por límite que ya venció se levanta acá.
2. **Corre la oficina.** Las que usan IA pasan por el **candado de IA** (`src/ai-lock.ts`): un semáforo en memoria que deja un solo `claude -p` a la vez en todo el proceso, sin importar cuántas colas trabajen. Commons, la descarga de fuentes y el render no lo usan.
3. **Guarda y avanza en una sola transacción:** `addVideoDocument` + `transitionVideo(officeDone)`. Si el proceso se corta en el medio, no queda un documento sin avanzar ni un avance sin documento.
4. **Encola la oficina siguiente** después del commit, si la nueva etapa es de trabajo. Si ese envío se pierde, el **barrido** (`video.sweep`, cron cada 10 min) vuelve a encolar los videos en etapa de trabajo sin job activo. Los duplicados no hacen daño: cada cola trabaja de a uno y el paso 1 frena al segundo.
5. **Límite de Claude** (`rate_limited`): `pauseVideoById(provider_limit, resumeAt)` con la espera de `rateLimitDelayMs(limitAttempt)` (15 min → 4 h). Encola el mismo job con `startAfter = resumeAt` y `limitAttempt + 1`, y termina **sin error**: no gasta reintentos de pg-boss.
6. **Otras fallas.** Una excepción la reintenta pg-boss (`retryLimit` por cola). En el último intento, `recordVideoFailure(stage, mensaje, retryable)`. Una salida de la IA que no pasa los controles después de los intentos internos de la oficina cuenta como falla: "Reintentar" la vuelve a correr.

**Cada intento de IA** va a `generation_runs`, con `video_id`, `brand_id` (el del video o null) y la tarea `video.*`. El documento guarda el id de la corrida que salió bien. Las rutas (`ai_routes`) dicen modelo y proveedor; el esfuerzo lo fija el código por oficina:

| Oficina | Esfuerzo | Turnos | Tiempo máx. | Intentos internos |
|---|---|---|---|---|
| Investigación | low | 40 (WebSearch + WebFetch) | 15 min | 2 (un dossier con datos de prueba se pide de nuevo) |
| Imágenes (consultas y curaduría) | low | 2 | 5 min | 1 cada paso |
| Guion | low | 3 | 10 min | 3 (con los errores de `checkScript`; las imágenes solo en el primero) |
| Verificación de hechos | medium | 5 | 8 min | 1 |

Para eso, `GenerationTask` suma `effort?: "low" | "medium" | "high"`, que `claude-code` pasa como `--effort`. Medido en V0-8: con `low` un guion tarda 28–88 s; sin él, ~181 s.

**Las oficinas de T7:**
- **Investigación:** `RESEARCH_RULES` (pasa a `packages/video/prompts.ts`) + `task.json` con el tema y para qué es (video de 1,5–2,5 min, 20–30 hechos). El resultado pasa por `dossierSchema` y `checkDossier`.
- **Fuentes:** solo código. Baja cada URL del dossier (20 s de tiempo máximo, User-Agent genérico), saca el texto y mide cuánto del `excerpt` está en la página (grupos de 5 palabras) y si están los números. Deja `sources`: por hecho, `textual`, `casi`, `no está` o `sin página`. **En V1 es informativo:** el operador lo ve en su escritorio. Después de 5 videos se decide si los hechos no verificados dejan de pasar al guion. Las funciones puras van en `packages/video/sources.ts`.
- **Imágenes:**
  1. La IA propone las consultas.
  2. `buildPool` arma el conjunto.
  3. La IA elige (`curatedHits`).
  4. Se baja cada imagen a `media/videos/<id>/images/iNN.jpg`, con una copia de 640 px (`.small.jpg`, ffmpeg) para que la IA las mire sin gastar de más.
  5. Queda el documento `images` con `{ candidates }`.
- **Guion:** el dossier compacto, las candidatas (texto e imágenes chicas) y, si hubo un rechazo, la nota del operador (`rejection_note`) con el guion anterior. Pasa por `scriptSchema` y `checkScript`, con hasta 3 intentos. Las palabras de `highlight` se normalizan. Queda el documento `script` y se pone el `title` del video.
- **Formas de contar (ADR 0030):** el guion declara `form` (`cronologia`, `misterio`, `contraste`, `despues`) y cada escena su `beat`. La oficina usa `videos.form`; sin ella, una devolución conserva la forma del guion rechazado (sin forma = `cronologia`) y un guion nuevo no repite las de los 2 últimos videos con guion (`recentScriptForms`). Los controles están en `packages/video/src/forms.ts`; los que dependen de la elección o de los carteles `nombre` corren solo en Guion, para que la Verificación pueda sacar un cartel engañoso.
- **«Tu aporte» (ADR 0031):** el operador lo escribe en el escritorio del guion y viaja con la devolución (`videos.contribution`). El guion lo pone en 1 o 2 escenas con `beat: "aporte"` (ni la primera ni la última, en primera persona, sin datos fuera del dossier), que no cuentan en las proporciones de la forma. La Verificación las recibe marcadas como opinión y una corrección que les saque la primera persona se descarta. El código dibuja el cartel «Opinión» en el video y en el cuadro (arriba a la izquierda en 9:16, abajo a la izquierda en 16:9).
- **Verificación de hechos:** `reviewSchema` y `applyFixes`. Deja el documento `review` (lo aplicado y lo rechazado) y una versión nueva de `script` si algo cambió.

**Sumar una imagen de Commons (T12).** Desde el escritorio del guion, el operador pega la dirección o el nombre de un archivo. La web lo valida (`commonsTitle`) y encola `video.pin` `{ videoId, title }`; el worker (`pin.ts`) lo busca, controla licencia y tamaño, lo baja, hace la copia chica y guarda una versión nueva de `images` (`origin: operator`). No es una oficina: no toca la etapa, y solo corre si el video está en `script_review`. Repetido, no duplica (regla 8). El resultado queda como salida del job, que la pantalla consulta cada 2 s.

**Escritorio del guion (T12).** Cada cambio viaja con la versión del guion que el operador estaba mirando (`saveOperatorScript` y `decideScript` bloquean el video y la comparan): una pestaña vieja no pisa ni aprueba nada. Una edición pasa por `editScene` (`packages/video`), que la acepta solo si no suma errores de `checkScript`. La voz se encola únicamente después de que la etapa cambió.

**Escritorio del video (T12).** La decisión viaja con la versión del documento `package` que el operador miró (`decideVideo`). Se puede volver al escritorio del guion (`returnToScriptDesk`: sin IA; Locución reutiliza la toma si la narración no cambió), devolver a Render (rehace Render y Publicación con lo mismo), a Locución (graba otra toma aunque el texto no haya cambiado: en la etapa `voicing`, una nota de rechazo significa eso) o a Guion. Un video aprobado se puede reabrir, y la descarga se cierra hasta aprobarlo de nuevo.

**Controles de imagen (2026-11-26, `docs/VIDEO-CALIDAD.md`).** Guion declara `exact` en cada escena (si es `false`, el pie es obligatorio); el código saca los carteles `nombre` que el título o la descripción de la imagen no respaldan (Guion, Verificación y al cambiar la imagen en el escritorio); la miniatura no puede usar una imagen que no es el hecho. Locución normaliza la voz a −14 LUFS.

**Fuentes con la página real (2026-11-26).** Fuentes baja cada página del dossier (hechos y citas). Lo que no aparece textual lo busca una IA sin herramientas (`video.sources`, `SOURCES_RULES`) en el texto real, de a partes de 30.000 caracteres (`pageChunks`); devuelve de 1 a 3 frases y lo que la página no dice (`foundQuotesSchema`), y el código comprueba cada frase (`quoteOnPage`). El documento `sources` guarda `quote`, `differs` y `checked`. Guion y Verificación reciben `usableDossier`: la frase real en `excerpt`, la aclaración en los respaldados a medias y sin los que su página no dice (si quedan al menos el 60 % y 8). Migración `0033`: la tarea `video.sources`.

**Imágenes del artículo del caso (2026-11-26).** Antes de las búsquedas, la oficina de Imágenes lee las imágenes de los artículos de Wikipedia más citados por el dossier (`dossierArticles`, API de Wikipedia `prop=images`, después Commons por título con el mismo filtro de licencias y 400 px de mínimo). Entran siempre y primero (`article` en la candidata); la curaduría suma el resto, hasta 46.

**Cuadros de cada escena (2026-11-26).** La Verificación tiene dos miradas: la de texto y la de cuadros. Para la segunda, el `video-worker` dibuja con Remotion la composición `frame` (un cuadro fijo por escena y formato, JPEG a media resolución, en `media/videos/<id>/frames/<clave>-<formato>.jpg`; la clave es un hash de lo que se ve, `frameKey`) y una IA con visión los revisa con `FRAME_RULES`. Sus correcciones pasan por `applyFixes` sin narración ni cita. El escritorio del guion muestra esos cuadros; editar una escena encola `video.frames` `{ videoId }` (una por video a la vez), que dibuja los que faltan. Una escena con `whole: true` muestra la foto entera sobre una copia desenfocada (`showsWhole`, `render/framing.ts`).

**Ideas para un video nuevo (2026-11-26).** "Proponer ideas" (`video.ideas`, sin herramientas) e "Investigar temas" (`video.ideas.research`, `WebSearch` y `WebFetch`, hasta 30 turnos y 10 min). La web crea la fila en `video_idea_requests` (uno abierto por botón; uno de más de una hora se da por perdido) y encola `video.ideas` `{ requestId }`; el worker (`ideas.ts`) suma las notas de la marca si la hay, le pasa los temas ya hechos o propuestos para que no repita, valida con `videoIdeasSchema` (un reintento si viene mal), comparte el candado de IA con las oficinas y cierra el pedido en un solo update (regla 8). El consumo queda en la fila y suma al total del día del estudio (no va a `generation_runs`, que exige marca o video). Cada botón tiene su ruta en Ajustes → Ruteo de IA. Medido: proponer, 3.000 a 10.000 tokens y 10–25 s; investigar, ~53.000 tokens y 70 s.

**Lo que no está en el proceso:**
- Avisos por Telegram: fuera de V1.
- El candado entre procesos: el worker social corre en el servidor y este en la notebook; comparten la suscripción, pero no la base. Si `pnpm dev` levanta los dos en local, pueden coincidir dos `claude -p`, y está aceptado.
- El logger es una copia del de `apps/worker`: los apps no se importan entre sí (regla 1). Si aparece un tercer uso, pasa a un paquete.

**Tests.** El corredor recibe sus dependencias (el almacén de videos, el ruteo, el envío de jobs y el reloj), así se prueba con dobles en memoria: regla 8, pausa por límite, falla en el último intento, encolado de la siguiente oficina y candado de IA. Cada oficina se prueba con un `router` falso y respuestas guardadas. La prueba de punta a punta con Claude de verdad es T9.
