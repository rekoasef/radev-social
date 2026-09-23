# RAdev Social

Gestor de redes sociales que genera, renderiza, programa y publica carruseles para múltiples marcas (hoy: RAdev y Lumus). La IA escribe el contenido; las imágenes se dibujan con plantillas en código. Uso personal de un solo operador (Renzo). Objetivo de costo: **USD 0 extra por mes**.

## Antes de trabajar, leé lo que corresponda

| Si vas a tocar... | Leé |
|---|---|
| Qué hace el sistema, requerimientos, alcance | `docs/PRD.md` |
| Estructura, servicios, datos, jobs, estados, IA, infraestructura | `docs/ARCHITECTURE.md` |
| Plantillas, presets, temas, tokens, render | `docs/DESIGN-SYSTEM.md` |
| **Siempre, al empezar**: en qué tarea estamos, decisiones tomadas, cómo trabajamos | `docs/PROGRESS.md` |
| Qué incluye cada fase | `docs/ROADMAP.md` |
| Por qué se tomó una decisión | `docs/decisions/` |

Trabajamos **una fase del roadmap a la vez**. No implementes cosas de fases futuras salvo que se pida explícitamente.

## Sobre el operador (importante)

Renzo desarrolla con IA y tiene **poca experiencia en infraestructura** (Docker, Postgres, servidores, DNS). Por eso:

- **Antes de ejecutar cualquier comando de infraestructura, explicá en una o dos frases qué hace y por qué.**
- **Pedí confirmación explícita antes de cualquier acción destructiva o difícil de revertir**: borrar datos o volúmenes, migraciones que eliminan columnas, cambios en el servidor, DNS, firewall o credenciales.
- Preferí siempre la solución más simple que cumpla la documentación.
- Si algo falla, explicá la causa probable antes de probar arreglos.

## Entorno de desarrollo

- Windows + **WSL2** + Docker Desktop. Todo se ejecuta dentro de WSL.
- El repo vive en el sistema de archivos de Linux (ej. `~/proyectos/radev-social`), **nunca en `/mnt/c/...`** (Docker y Next.js andan mucho más lento ahí).
- Fases 0 a 3 corren 100% en local. El servidor de producción llega en la Fase 4.

## Stack

TypeScript (strict) · Next.js App Router · Tailwind · shadcn/ui · Postgres + Drizzle · pg-boss · Better Auth (GitHub) · Zod · Playwright (render y tests) · Vitest · Biome · pnpm + Turborepo · Docker Compose + Caddy · Claude Code headless (`claude -p`) con la suscripción del operador · OpenRouter (modelos gratuitos) como proveedor secundario de IA.

## Estructura del monorepo

```
apps/web            Next.js: panel, gestión de marcas, editor, calendario, /render (interno), auth
apps/worker         Jobs de pg-boss: generación, render, publicación, métricas
packages/core       Dominio puro: tipos, máquina de estados, reglas. Sin dependencias de infra
packages/db         Schema Drizzle, migraciones, queries, seed
packages/slides     SlideFrame, presets de estilo, plantillas, schemas Zod del contenido y de los temas
packages/ai         Proveedores de IA (claude-code, openrouter), ruteo por tarea, límites de uso
packages/publishers Adaptadores de publicación (manual, tiktok)
seeds/brands/       Datos iniciales de cada marca (voz, precios, casos, assets). Se cargan a la base con el seed
docs/               Documentación del proyecto
```

## Comandos

Mantené esta sección actualizada. Antes de cualquier comando: `nvm use` (Node 24, ver `.nvmrc`).

```
docker compose up -d postgres   # Postgres local (puerto 5433 en 127.0.0.1)
pnpm dev            # modo desarrollo (hoy: web en http://localhost:3000)
pnpm test           # Vitest en todos los paquetes
pnpm lint           # Biome (pnpm format corrige formato)
pnpm typecheck      # TypeScript en todos los paquetes
pnpm db:generate    # generar migración Drizzle tras cambiar el schema
pnpm db:migrate     # aplicar migraciones
pnpm db:seed        # cargar marcas iniciales (solo agrega las que faltan)
pnpm db:studio      # ver y editar la base
```

Notas del entorno:
- El `.env` vive en la raíz. La web lo carga con `scripts/with-root-env.mjs`; los scripts de `packages/db`, con `load-root-env.ts`.
- El puerto 5432 lo usa un Postgres nativo de WSL de otros proyectos: el nuestro va por 5433. No tocar el nativo.
- pnpm bloquea scripts de instalación y versiones muy recientes: se autorizan en `pnpm-workspace.yaml`.

## Reglas de arquitectura (no negociables)

1. **Dependencias**: `core` no depende de nada del repo. Los demás paquetes pueden depender de `core`. `web` y `worker` dependen de los paquetes, **nunca entre sí**.
2. **El estado de un post solo cambia a través de la máquina de estados de `packages/core`**. Nunca con un `UPDATE` directo del campo `status`.
3. **Ningún post se publica sin haber pasado por `approved`**. Esto tiene test y no se toca.
4. **Todo contenido generado por IA se valida con Zod** antes de guardarse, sin importar qué proveedor o modelo lo generó.
5. **La web nunca ejecuta IA ni Playwright**. Eso es trabajo exclusivo del worker. La web encola jobs.
6. **Nada de una marca está hardcodeado.** Colores, tipografías, textos, assets, voz, pilares, precios y casos viven en la base y se editan desde el panel. En código solo existen los **presets de estilo** (ver `docs/DESIGN-SYSTEM.md`).
7. **Aislamiento de la generación**: `claude -p` se ejecuta en un directorio temporal FUERA del repo, donde el worker escribe el CLAUDE.md de la marca generado desde la base. Nunca se ejecuta dentro del repo.
8. **Los jobs son idempotentes**: ejecutarlos dos veces no puede publicar doble ni duplicar datos.
9. **Los números en el contenido nunca los inventa la IA**: vienen de datos provistos por el código (precios y casos de la marca, datos de Bluelytics, métricas).
10. **Secretos**: tokens cifrados en la base (AES-256-GCM). Nunca se loguean secretos. Solo una credencial de Claude a la vez (`CLAUDE_CODE_OAUTH_TOKEN` **o** `ANTHROPIC_API_KEY`, nunca las dos).
11. **Fechas**: se guardan en UTC. Se muestran y se programan en la zona horaria de la marca. Toda función de fechas recibe la zona explícita.
12. **Multi-arquitectura**: toda imagen de Docker y dependencia nativa tiene que funcionar en `amd64` y `arm64` (producción puede ser ARM).
13. **Costo cero**: no agregues servicios pagos. Si algo parece requerir uno, frená y preguntá.

## Convenciones de código

- Código, identificadores, tablas y commits en **inglés**. Textos visibles y documentación en **español rioplatense** (voseo).
- TypeScript strict, sin `any`. Tipos derivados de Zod (`z.infer`) y de Drizzle, no duplicados a mano.
- Server Components por defecto; `"use client"` solo cuando haga falta interactividad.
- Server Actions para mutaciones del panel, validadas con Zod.
- Commits con Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`...).
- Tests obligatorios para: máquina de estados, schemas de contenido y de temas, ruteo de proveedores de IA, adaptadores de publicación y lógica de horarios.

## Forma de trabajo

- Empezá cada tarea no trivial proponiendo un plan corto antes de codear.
- Al terminar una tarea, actualizá `docs/PROGRESS.md` (estado, tarea, decisiones nuevas) en el mismo commit, y marcá en `docs/ROADMAP.md` los ítems que cierre.
- Si tomás una decisión que contradice o amplía la documentación, frená y preguntá. Si se aprueba, actualizá el doc o agregá un ADR en `docs/decisions/`.
- Si una tarea toca plantillas o presets, verificá el render real con Playwright contra `docs/references/`.
