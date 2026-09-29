# Arquitectura — RAdev Social

## 1. Estilo general

**Monolito modular + worker.** Un repo, una base de datos, dos procesos:

- **web**: lo que el operador ve y toca (panel, marcas, editor, calendario, revisión) y la ruta interna de render.
- **worker**: lo que trabaja solo (generar con IA, renderizar, publicar, sincronizar métricas).

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

- `web` se construye con `output: "standalone"`.
- `worker` incluye Node, Chromium (Playwright) y Claude Code CLI.
- Postgres **no** publica puertos; solo accesible en la red de Docker.
- Caddy bloquea `/render/*` desde afuera; la ruta además exige `X-Render-Token`.
- El worker llama a la web por la red interna: `http://web:3000/render/...`.
- Seguridad del servidor: SSH solo con llave, firewall 22/80/443, actualizaciones automáticas.

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
    app/l/[brand]/          página de links pública (F6)
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

Cada post tiene un **código público** corto e inmutable (`<prefijo de marca>-<número>`, ej. `RA-0142`, `LU-0031`) usado en el mensaje precargado de WhatsApp y en los links.

## 6. Jobs (pg-boss)

Todos idempotentes (clave `singletonKey` derivada del objetivo), con reintentos y backoff.

| Job | Disparo | Qué hace |
|---|---|---|
| `ideas.generate` | manual / `slots.fill` (banco sin ideas para un pilar) | propone ideas desde pilares, series e historial (modelo gratuito por defecto) |
| `ideas.research` | cron semanal por marca | investiga temas del nicho con búsqueda web (Claude) |
| `carousel.generate` | manual, `slots.fill`, rechazo | idea → JSON validado → nueva versión |
| `carousel.render` | tras generar o editar | Playwright renderiza cada slide en 4:5, QA, guarda assets |
| `review.notify` | post entra a `in_review` (clave única, 5 min después o al terminar la ventana de generación) | un solo aviso por Telegram con los posts nuevos para revisar |
| `notify.send` | cualquier aviso guardado | envía una fila de `notifications` a Telegram (6 reintentos); una enviada no se reenvía |
| `post.publish` | `startAfter = scheduled_at`, clave `publish:<post>` | publica vía adaptador si el post sigue `scheduled` para esa hora (si no, se saltea) |
| `slots.fill` | cron cada 15 min; actúa solo **dentro de la ventana de generación** | llena los slots libres de los próximos 7 días respetando la mezcla (ver §7) |
| `data.refresh` | cron diario (19:00 de Buenos Aires; al arrancar el worker si no hay datos) o "Actualizar ahora" en Ajustes | snapshot de Bluelytics |
| `metrics.sync` | cron (F6) | métricas por publicación |
| `tokens.refresh` | cron | renueva tokens de TikTok |
| `backup.run` | cron diario | lo ejecuta el contenedor de backup |

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

Seed (Fase 3, T6): claude-code con `sonnet` y openrouter con `nvidia/nemotron-3-super-120b-a12b:free` (hasta la T13 era `nex-agi/nex-n2.5-pro:free`, que OpenRouter dio de baja); solo se cargan si la tarea no tiene ruta global. Se editan en **Ajustes → Ruteo de IA** (`/settings`), que por ahora edita solo las rutas globales; la tabla ya admite rutas por marca (`brand_id`), que ganan sobre la global (`resolveAiRoute`).

Reglas de una ruta (`checkAiRoute`, `packages/core/src/ai/routing.ts`; las aplican el panel y el servidor): modelo obligatorio; con openrouter, solo modelos `:free`; las tareas con herramientas (`ideas.research`, `metrics.extract`) solo con claude-code; el respaldo no puede ser igual al principal.

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

"Generar con IA" (Nuevo post) crea el post en `generating` sin versión, con el pedido en `posts.generation_request`, y encola `carousel.generate`. El worker arma el workspace (`CLAUDE.md` de la marca, `task.json`, `slides.md` con la guía de plantillas, `recent-posts.json` con hook, look y secuencia de tipos de los últimos posts), pasa por la ruta de `carousel.generate`, registra cada intento y valida con `aiCarouselSchema` (pilares de la marca; `chart` y `bigNumber` solo si la marca tiene fuentes de datos: el dataset tiene que estar en `data.json` y la cifra, en sus `figures`; para una marca `studio`, `look` tiene que ser uno de los permitidos por `lookChoices`: los activos menos los de los 2 últimos posts). OK → versión `ai` con su `generation_run_id`, `generationDone` y render. Respuesta mal armada → un reintento con los problemas como feedback. Límite → reprogramación con backoff (`generation_retry_at`). Error reintentable → reintento de pg-boss (2). Lo demás → `generationFailed`; el panel muestra los errores y "Reintentar generación".

Desde el **banco de ideas** (`/ideas`, T9), "Generar" abre Nuevo post con `?idea=<id>`: el formulario viene con el título y el ángulo (`ideaPrompt`) y el pilar de la idea. Al crear el post, la idea pasa a `used` en la misma transacción (`createGeneratingPost` con `ideaId`, que queda en `posts.idea_id`); si ya no estaba `new`, no se crea nada. Estados de una idea: `new` → `used` | `discarded`, y `discarded` → `new` (`packages/core/src/ideas/ideas.ts`); las descartadas no se borran.

### Ideas con IA y series (Fase 3, T10)

- **Pedidos**: en `/ideas`, "Proponer ideas" (`ideas.generate`, modelo gratuito) e "Investigar temas" (`ideas.research`, Claude con `WebSearch` y `WebFetch`, hasta 30 turnos y 10 min). La web crea una fila en `idea_requests` (`queued`) con los parámetros (cantidad 3–8, pilar, serie, foco) y encola el job con `singletonKey` `ideas:<id>`; no acepta otro pedido de la misma tarea mientras haya uno abierto. Se disparan **a mano**; la investigación semanal automática llega en la Fase 4. No cuentan para los topes.
- **Job** (`apps/worker/src/jobs/ideas-request.ts`): pasa el pedido a `running`, arma el workspace (`CLAUDE.md` de la marca, `task.json`, `series.md`, `recent-posts.json`, `existing-ideas.json` con las ideas del banco, también las descartadas) y valida con `ideaProposalsSchema` (`packages/ai/src/ideas.ts`): pilares y series de la marca (uno solo si el pedido lo fija), sin porcentajes ni montos en título o ángulo (`hasFigures`, regla 9), y en la investigación de 1 a 3 fuentes http(s) por idea. Descarta repetidas (`dropRepeatedIdeas`) y guarda las ideas (`source` `ai`, `series` o `research`, `sources`, `request_id`) **en la misma transacción que cierra el pedido** (`completeIdeaRequest`): un job repetido no agrega nada (regla 8). Respuesta mal armada → un reintento con los problemas; límite del proveedor → falla con aviso (es un pedido manual, no espera horas); error reintentable → reintento de pg-boss; si el último intento se rompe, el pedido queda `failed`. Cada intento va a `generation_runs` con `post_id` null.
- **Series** (`content_series`, Marcas → Series): nombre, clave fija, pilar y hook de sus posts, estructura (Markdown para la IA) y hasta 4 tipos de slide obligatorios. Una idea o un post de una serie llevan `series_key` (`posts.generation_request.seriesKey`); "Generar con IA" toma el pilar y el hook de la serie si se dejan a elección de la IA, `task.json` trae la estructura y `aiCarouselSchema` exige las slides obligatorias. El seed crea "¿Cuánto cuesta realmente…?" para RAdev desde `seeds/brands/radev/series/real-cost.md` (exige `costBreakdown`). Una serie con ideas se archiva, no se borra.
- **Rangos de precios**: en `carousel.generate`, cada rango de un `costBreakdown` (ítems y total) tiene que estar escrito en el documento de Precios de la marca (se compara sin mayúsculas, espacios ni tipo de guion). Si no, la respuesta se rechaza; con Precios vacío, ningún `costBreakdown` pasa (regla 9).

### Regeneración (Fase 3, T8)

- **Rechazo con feedback**: en la página de un post de IA en `in_review`, "Rechazar" pide qué cambiar (10 a 1.000 caracteres) y, en una transacción (`rejectAndRegenerate`), hace `reject` → `regenerate`, guarda `posts.rejection_feedback`, pone `posts.qa_regenerations` en 0 y encola `carousel.generate`. Mismo control de topes que "Generar con IA". Los posts armados a mano no se rechazan: se editan.
- **QA del render**: al terminar un render, `renderOutcome` (`packages/core/src/posts/regeneration.ts`) decide. Sin problemas → `renderDone`. Error de página o versión del editor con problemas → `renderFailed`. Versión de IA con problemas de QA y menos de 2 regeneraciones → evento `qaRegenerate` (rendering → generating), `qa_regenerations + 1` y `carousel.generate`. Con 2 → `renderDone`: queda `in_review` con los problemas marcados.
- **Qué recibe la IA**: si el post ya tiene versión, el workspace suma `previous.json` (la versión actual) y `task.json` trae `revision` con el feedback del último rechazo (mientras exista, vale para todas las regeneraciones del post) y los problemas del render de esa versión, descriptos por slide (`describeRenderProblems`). `recent-posts.json` excluye al propio post.

### Registro
Cada ejecución queda en `generation_runs` con proveedor, modelo, uso, duración, turnos, estado y error. Cada `post_version` referencia su `generation_run`, para comparar rendimiento por modelo en el tablero.

## 8. Render

1. El worker abre `http://web:3000/render/<postVersionId>/<slideIndex>?format=4x5` con el token interno (hoy el único formato, ADR 0011).
2. La página carga el preset y los tokens de la marca desde la base, renderiza el `SlideFrame` y la plantilla al tamaño exacto, sin UI del panel.
3. Expone `window.__renderReady = true` cuando cargaron fuentes y assets.
4. **QA** en la página: desborde de texto (`data-qa="text"`), contenido fuera de la zona segura (`data-qa="content"`), fuentes cargadas. Devuelve violaciones.
5. Violaciones: si la versión vino de IA → regeneración con las violaciones como feedback (máx. 2); si vino de edición manual → error visible en el editor.
6. OK: PNG en `MEDIA_DIR/<brand>/<postId>/<versionId>/<format>/<index>.png`, registrado en `assets`.

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

## 10. Modelo de datos

Todas las tablas de contenido cuelgan de `brands`. Timestamps en UTC (`timestamptz`).

| Tabla | Campos principales |
|---|---|
| `brands` | id, slug, name, code_prefix (ej. `RA`), style_preset, theme_tokens (jsonb), timezone, posts_per_day_target (sin uso desde la F4: la cantidad sale de los horarios), ai_daily_limit, ai_monthly_limit, whatsapp_number, whatsapp_message_template, data_sources (text[]: fuentes de datos que usa su contenido, ej. `bluelytics`), archived_at |
| `brand_assets` | id, brand_id, role (`logo` \| `hero` \| `decoration` \| `other`), path (relativo a `MEDIA_DIR`), mime, width, height (null en un SVG sin tamaño), size_bytes, created_at, updated_at |
| `brand_documents` | id, brand_id, kind (`voice` \| `pricing` \| `cases` \| `rules`), content (markdown), version, created_at — la versión vigente es la más alta |
| `content_pillars` | id, brand_id, key, name, description, target_share (0–1), archived_at |
| `ideas` | id, brand_id, pillar_id (null: elige la IA), title, angle, source (`manual` \| `ai` \| `research` \| `recycled` \| `series`), series_key, status (`new` \| `used` \| `discarded`), sources (jsonb: `{ title, url }[]`), request_id, created_at, updated_at |
| `idea_requests` | id, brand_id, task (`ideas.generate` \| `ideas.research`), params (jsonb: count, pillarKey, seriesKey, focus), status (`queued` \| `running` \| `succeeded` \| `failed`), error, idea_count, created_at, finished_at |
| `content_series` | id, brand_id, key, name, pillar_id, hook_type, brief (Markdown), required_slides (jsonb), archived_at, created_at, updated_at |
| `posts` | id, brand_id, public_code, idea_id, pillar_id, hook_type, status, current_version_id, scheduled_at (hora planeada), slot_id (horario de la marca del que salió; null si se eligió a mano), rejection_feedback, created_at, updated_at |
| `post_versions` | id, post_id, number, content (jsonb `Carousel`), schema_version, origin (`ai` \| `manual`), generation_run_id, review_notified_at (ya avisada por Telegram), datasets (jsonb: puntos de sus `chart` por `datasetRef`, congelados al guardarla), created_at |
| `assets` | id, post_version_id, format (`4x5`; enum ampliable), slide_index, path, width, height, checksum |
| `schedule_slots` | id, brand_id, weekday (0 = domingo … 6), local_time (`time`, hora de pared en la zona de la marca), active, created_at. Única por marca, día y hora |
| `social_accounts` | id, brand_id, network, external_id, handle, access_token_enc, refresh_token_enc, expires_at, status |
| `publications` | id, post_id, social_account_id, network, status, external_id, url, error, attempts, published_at |
| `ai_routes` | id, task, brand_id (nullable = global), provider, model, fallback_provider, fallback_model. Única por tarea y marca, con una sola global por tarea (`NULLS NOT DISTINCT`) |
| `generation_runs` | id, brand_id, post_id (null en pedidos de ideas), task, role (`primary` \| `fallback`), provider, model, status (`succeeded` \| `failed`), error_kind, error, input_tokens, output_tokens, cost_usd (nullable), duration_ms, num_turns, session_id, created_at. Una fila por intento |
| `notifications` | id, key (única: nunca se guarda ni se envía dos veces la misma), kind (`review` \| `publish` \| `failure` \| `limit` \| `cap` \| `test`), text, silent, created_at, sent_at, error |
| `settings` | clave/valor global: `generation_window`, `slots_fill_last` (resultado de la última pasada del llenado) |
| `data_snapshots` | id, source (`bluelytics`), as_of (fecha del dato), fetched_at, payload (jsonb, validado al bajarlo). Uno por fuente y día: otro refresh el mismo día lo reemplaza |
| `post_metrics` (F6) | id, publication_id, captured_at, views, likes, comments, shares, saves, source (`api` \| `screenshot` \| `manual`) |
| `audience_snapshots` (F6) | id, brand_id, network, captured_at, data (jsonb), source |
| `links`, `link_clicks` (F6) | slug, destination, brand_id, post_id / link_id, clicked_at, referrer |
| `leads` (F6) | id, brand_id, name, contact, channel, post_code, source_post_id, status, notes, created_at |
| Better Auth | `user`, `session`, `account`, `verification` |

`hook_type`: `cost`, `warning`, `myth`, `comparison`, `question`, `data`, `story`, `howto`.

## 11. Seguridad

- Better Auth con GitHub + lista blanca `ALLOWED_EMAILS`.
- Tokens de redes cifrados con AES-256-GCM (`TOKEN_ENCRYPTION_KEY`).
- `/render` bloqueado en Caddy y protegido con token interno.
- Postgres sin puertos expuestos. Firewall: 22 (llave), 80, 443.
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
RENDER_INTERNAL_TOKEN, WEB_INTERNAL_URL=http://web:3000
MEDIA_DIR, MEDIA_BASE_URL        # MEDIA_DIR vacío = <repo>/media (local)
TOKEN_ENCRYPTION_KEY
TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET   (F5)
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
