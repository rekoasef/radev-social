# Progreso

Bitácora viva del proyecto: en qué tarea estamos, qué falta, qué se decidió y cómo trabajamos. Es la "memoria" compartida entre máquinas y sesiones de Claude: **se lee al empezar y se actualiza al terminar cada tarea**, en el mismo commit que la tarea.

`docs/ROADMAP.md` dice *qué* tiene cada fase; este archivo dice *dónde estamos* dentro de ella.

---

## Estado actual

- **Fase:** 1 — Design system, presets y gestión de marcas (empezada 2026-09-23). Fase 0 terminada el 2026-09-23 en 1 día.
- **Próximo paso:** T2 — schemas Zod de tokens de `bold` y `soft`.
- **Última actualización:** 2026-09-23, al cerrar la T1 de la Fase 1

## Fase 1 — tareas

Plan aprobado el 2026-09-23. 👁 = termina con capturas para que el operador apruebe el diseño.

| Tarea | Qué | Estado |
|---|---|---|
| T0 | Tipografías curadas auto-hospedadas (`@fontsource-variable`) y registro en `packages/slides` | ✅ |
| T1 | Schemas Zod de contenido: 12 tipos de slide (con `flow`), `Carousel`, límites, parser de énfasis. Tests | ✅ |
| T2 | Schemas Zod de tokens de `bold` y `soft` con valores por defecto, registro de presets. Migración de datos que reescribe los tokens de RAdev y Lumus al formato nuevo. Reemplaza `apps/web/lib/brand-tokens.ts`. Tests | |
| T3 | `SlideFrame` 4:5 (encabezado, pie, número de página, decoraciones deterministas, zonas seguras). Ruta `/render/preview/...` protegida con `RENDER_TOKEN` (sin login). Capa de zonas seguras y superposición de la captura de TikTok. Playwright como dependencia de desarrollo para capturas. 👁 | |
| T4 | Plantillas `bold` con referencia: `cardGrid`, `flow`, `hubDiagram`. 👁 contra las refs | |
| T5 | Plantillas `bold` sin referencia: `cover`, `statement`, `question`, `cta`. 👁 | |
| T6 | Plantillas `bold` de datos: `comparison`, `costBreakdown`, `steps`, `bigNumber`, `chart` (datos de ejemplo). 👁 | |
| T7 | `brand_assets`: tabla, subida con validación de tipo y tamaño, `media/`. El seed carga y enlaza los assets de Lumus | |
| T8 | Preset `soft` con las 12 plantillas + carrusel de ejemplo de Lumus. 👁 | |
| T9 | CRUD de marcas (borrar solo sin posts) | |
| T10 | Editor de identidad visual: preset, formulario desde el schema, vista previa en vivo, aviso de contraste | |
| T11 | Calibración de límites de caracteres con casos extremos; la preview marca desbordes | |
| T12 | Cierre: criterio de terminado, docs, comandos | |

Decisiones aprobadas con el plan: (1) ruta `/render/preview/...` con token interno en vez de login, para poder capturarla; (2) Playwright como dependencia de desarrollo desde la Fase 1 (el job de render sigue siendo de la Fase 2); (3) migración de datos para los tokens de las marcas existentes.

## Fase 0 — tareas

Plan aprobado el 2026-09-23. Terminada.

| Tarea | Qué | Estado |
|---|---|---|
| T0 | Entorno (WSL, nvm, Docker) y git | ✅ |
| T1 | Monorepo pnpm + Turborepo, TypeScript strict, Biome | ✅ |
| T2 | Vitest | ✅ |
| T3 | Postgres en Docker Compose | ✅ |
| T4 | Drizzle: tablas `brands` y `settings` | ✅ |
| T5 | Seed de RAdev y Lumus | ✅ |
| T6 | Web Next.js con la home de canales | ✅ |
| T7 | Better Auth con GitHub + lista blanca (probado de punta a punta) | ✅ |
| T8 | Layout del panel: navegación, selector de marca en cookie, menú de usuario, `apps/web/DESIGN.md` | ✅ |
| T9 | Worker: `apps/worker/src/index.ts` conecta a la base, arranca pg-boss (crea su esquema), logs estructurados, apagado limpio. Sin jobs todavía | ✅ |
| T10 | Docker: Dockerfile de web (`output: "standalone"`) y worker, imágenes multi-arquitectura, compose con web + worker + postgres, migraciones al arrancar, probar `docker buildx build --platform linux/arm64`. La web necesita las variables de Better Auth en compose | ✅ |
| T11 | Cierre: sección Comandos del CLAUDE.md completa, ROADMAP marcado, README "cómo levantar", recorrer el criterio de terminado de la fase (probado desde un clon limpio con base vacía) | ✅ |

## Decisiones tomadas (no re-discutir)

- Node 24 con nvm (`.nvmrc`); pnpm 12.5.1 (`packageManager`).
- TypeScript 6.0.3 (no 7). Tailwind v4.
- Postgres 17 en el puerto **5433** (el 5432 es de un Postgres nativo de otros proyectos). Driver `pg`.
- Drizzle 0.45 estable. Paquetes internos sin compilar (`transpilePackages`).
- Tokens de marca sin validar hasta la Fase 1 (lectura defensiva en `apps/web/lib/brand-tokens.ts`).
- Better Auth 1.7.5 con `user.validateUserInfo` (lista blanca) y `account.encryptOAuthTokens`. Sin CLI de Better Auth: schema escrito a mano en `packages/db/src/auth-schema.ts`.
- Panel: grupo de rutas `app/(panel)/` cuyo layout llama a `requireOperator()`. Marca activa en la cookie `active-brand` (Server Action validada con Zod); la regla vive en `packages/core` (`pickActiveBrand`).
- Worker: pg-boss 12 en el esquema `pgboss` de la misma base; logger JSON propio (`apps/worker/src/logger.ts`, sin dependencias); apagado con `stop({ graceful: true })` y 30 s de margen. Corre con `tsx` (sin compilar). Todavía no depende de `@radev/db`: se agrega cuando llegue el primer job.
- Docker: un `Dockerfile` en la raíz con destinos `web` (Next `output: "standalone"`, `outputFileTracingRoot` en la raíz del monorepo), `worker` (`pnpm deploy --prod`, corre con `node --import tsx`) y `migrate` (migraciones + seed con tsx directo: `pnpm run` intenta reinstalar y falla sin root). Base `node:24-bookworm-slim` (amd64 + arm64), todo como usuario `node`. El build de la web usa variables de relleno solo en ese `RUN`. En compose, web y worker leen `DATABASE_URL` apuntando a `postgres:5432` (pisa la del `.env`); la web usa `env_file: .env`.
- Estilo del panel: "Sala de control", documentado en `apps/web/DESIGN.md`. Las secciones de fases futuras se ven apagadas con su fase, sin páginas vacías.
- **Formato único 4:5** (1080×1350) para TikTok e Instagram (ADR 0011). Zonas seguras medidas sobre una captura real de TikTok: márgenes 80/80/80/100 y exclusión abajo a la derecha (`x ≥ 930`, `y ≥ 650`) por la columna de botones. Detalle en `DESIGN-SYSTEM.md` §3.
- **Tipo de slide nuevo `flow`**: tarjetas en orden con conectores (refs `flow-1/2`); `cardGrid` queda para tarjetas sin orden.
- **Preset `bold`, dos contenedores**: *tarjeta* (ícono blanco en un cuadradito oscuro y texto en oración debajo; el énfasis da los dos tonos) y *chip* (ícono y texto en una línea, para `hubDiagram`). Se descartan las etiquetas en MAYÚSCULAS espaciadas dentro de las tarjetas (`flow-2`). Cuando una referencia contradice las reglas, mandan las reglas.
- **Tipografías**: paquetes `@fontsource-variable/*` 5.3.0 (fuentes variables, versión fija) en `packages/slides`. Registro en `src/fonts/registry.ts` (`FONT_FAMILIES`, `fontStack`, `supportsWeight`); `@radev/slides/fonts` registra los `@font-face` y se importa una vez en `apps/web/app/layout.tsx`. El nombre curado ("Geist Sans") es distinto del nombre CSS ("Geist Variable"): siempre pasar por `fontStack`. Un test verifica que el registro, `load.ts` y el CSS de cada paquete coincidan. El panel sigue con su propia Geist vía `next/font`.
- **Contenido** (`packages/slides/src/content/`): Zod 4. Campos `richText(max)` / `plainText(max)` / `iconName` en `fields.ts`; límites en `limits.ts` (cuentan caracteres visibles); `slideSchema` es una unión por `type` con máx. 2 énfasis por slide; `carouselSchema` exige `cover` primera y `cta` última (y en ningún otro lugar). Mensajes de error en español porque llegan al editor y a la IA. Sin transformaciones en los schemas de slides, para que `z.toJSONSchema` funcione (lo usa la Fase 3). Íconos validados contra `iconNames` de `lucide-react/dynamic` (no se incluyen en el JSON Schema como enum: son ~1600).
- **Tarjetas sin énfasis**: `cardGrid.cards` tiene `lead?` (línea liviana) + `label` (700). Las etiquetas de tarjetas, chips y nodos son texto plano. Así `ref-cardgrid` entra en el límite de 2 énfasis (se descarta su tarjeta resaltada en naranja).
- **Ejemplos** en `content/examples.ts`: una slide por tipo con los textos de las referencias y un carrusel. Las cifras son de relleno a propósito (`USD 0–00`, `0.000`). Los usan la preview (T3) y los tests.
- **Slides sin referencia** (`statement`, `question`, `cta`, etc.): no se esperan imágenes del operador. Se diseñan en código con las reglas del preset y el operador aprueba mirando capturas del render.

## Anotado para más adelante

**Fase 1:**
- Captura de TikTok para calibrar: `docs/references/tiktok-4x5.jpeg` (post "¿Cuánto cuesta tener una APP?"). Superponer un render real para confirmar las zonas seguras.
- Ese post usa una tipografía condensada en el título, distinta de Inter Tight de las referencias. Por ahora se sigue con Inter Tight; si el operador la quiere, se suma a la lista curada.
- `heroAsset` / `logoAsset` de Lumus son nombres de archivo sin enlazar a `brand_assets`.

## Cómo trabajamos

- **Una tarea por vez.** Antes de codear, plan corto. Al terminar: resumen con archivos, "cómo lo verificás" con comandos concretos y decisiones tomadas. Después preguntar si se commitea y se sigue.
- **Commits solo con OK del operador**, en Conventional Commits en inglés. Cada commit de tarea actualiza este archivo.
- **Infraestructura:** explicar cada comando en 1–2 frases antes de correrlo, sin dar nada por sabido.
- **Decisiones visuales:** mostrar ejemplos o capturas; una página de texto con colores no alcanza para elegir.
- **Capturas de la web:** Edge headless de Windows (`/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe --headless=new --screenshot=...`). Para ancho de celular, meter la página en un iframe de 390px (Edge no baja de ~500px). Las páginas con login no se pueden capturar así: pedirle al operador que las mire.
- **Tokens:** el operador limpia el contexto entre tareas; este archivo tiene que alcanzar para retomar sin re-derivar nada.

## Retomar en otra máquina

Seguir "Cómo levantarlo" del `README.md`. Lo que no viaja con el repo: el `.env` (copiarlo por un canal privado) y los datos de la base (cada máquina tiene la suya; el seed recrea las marcas).
