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
# Docker
docker compose up -d postgres      # solo Postgres (127.0.0.1:5433), para desarrollar con pnpm dev
docker compose up -d --build       # todo: postgres, migraciones + seed, web (:3000) y worker
docker compose logs -f web worker  # ver logs en vivo
docker compose stop web worker     # frenar web y worker (Postgres sigue arriba)
docker compose down                # apagar todo; los datos quedan en el volumen
                                   # NUNCA `down -v` sin confirmar: borra la base

# Desarrollo
pnpm dev            # web (http://localhost:3000) + worker, con recarga al guardar
pnpm build          # build de producción de todos los paquetes
pnpm test           # Vitest en todos los paquetes (pnpm test:watch para modo continuo)
pnpm lint           # Biome (pnpm format corrige formato)
pnpm typecheck      # TypeScript en todos los paquetes

# Base de datos
pnpm db:generate    # generar migración Drizzle tras cambiar el schema
pnpm db:migrate     # aplicar migraciones
pnpm db:seed        # cargar marcas iniciales (solo agrega las que faltan)
pnpm db:studio      # ver y editar la base

# IA
pnpm --filter @radev/ai smoke [claude-code|openrouter] [modelo]
                    # generación mínima real (CLAUDE_CODE_OAUTH_TOKEN / OPENROUTER_API_KEY en .env)

# Slides
pnpm --filter @radev/slides icons:sync   # regenerar la lista de íconos tras actualizar lucide-react
pnpm --filter @radev/slides fonts:measure # medir el ancho de las tipografías (tras sumar una)
pnpm --filter @radev/slides preview /tmp/looks --tokens t.json [--looks chat,recibo] [--set examples|extremes] [--carousel c.json]
                    # renderizar los looks de `studio` sin web ni base (Playwright) + ajuste y control
                    # del render; falla si hay problemas. Para diseñar o revisar looks (DESIGN-SYSTEM §10)
pnpm capture "/render/preview/radev/frame?overlay=tiktok" /tmp/x.png
                    # captura de una slide con Playwright (web levantada + RENDER_TOKEN en .env;
                    # el token va por cabecera X-Render-Token, no en la URL)
                    # overlay=safe muestra zonas seguras; overlay=tiktok superpone la UI de TikTok
                    # variant=extreme: textos al límite; qa=1: marca desbordes y zonas invadidas
pnpm capture --check "/render/preview/lumus/flow?variant=extreme" -
                    # control del render (desbordes, zonas seguras); falla si hay problemas.
                    # "-" como salida no guarda captura
```

```
# Producción (servidor; ver infra/server/README.md)
ssh radev-oracle                                              # entrar (Host en ~/.ssh/config)
ssh radev-oracle 'sudo bash -s' < infra/server/harden.sh      # asegurar (una vez; idempotente)
ssh radev-oracle 'sudo bash -s' < infra/server/check.sh       # verificar la seguridad
ssh radev-oracle 'bash -s' < infra/server/setup.sh            # Docker, repo y .env (una vez)
ssh radev-oracle '~/radev-social/infra/server/deploy.sh'      # actualizar producción
ssh radev-oracle '~/radev-social/infra/server/restore.sh --list'  # backups (restaurar: sin --list)
infra/server/move-to-server.sh                                # mudanza: base local + media al servidor (una vez)
                    # en el servidor, compose.yaml + compose.prod.yaml (Caddy en 80/443)
```

Notas del entorno:
- El `.env` vive en la raíz. La web y el worker lo cargan con `scripts/with-root-env.mjs`; los scripts de `packages/db`, con `load-root-env.ts`.
- Archivos subidos: `media/` en la raíz (`MEDIA_DIR`), compartida por `pnpm dev` y Docker; la web los sirve en `/media/...`. No viajan con el repo: el seed recrea los de las marcas iniciales.
- El puerto 5432 lo usa un Postgres nativo de WSL de otros proyectos: el nuestro va por 5433. No tocar el nativo.
- `pnpm dev` y la web de Docker usan el puerto 3000 (lo exige la OAuth App de GitHub): frená uno antes de levantar el otro. `WEB_PORT=3001 docker compose up -d` sirve solo para probar la imagen.
- Imágenes: un solo `Dockerfile` con destinos `web`, `worker` y `migrate`. El servicio `migrate` corre en cada `up` y termina; web y worker esperan a que salga bien.
- En Docker, el worker renderiza a través de la web (`http://web:3000`) con el `RENDER_TOKEN` del `.env` y escribe los PNG en la misma `media/`.
- El worker escribe logs JSON (una línea por evento); `LOG_LEVEL=debug` muestra más. pg-boss guarda su cola en el esquema `pgboss` de la misma base.
- pnpm bloquea scripts de instalación y versiones muy recientes: se autorizan en `pnpm-workspace.yaml`.

## Reglas de arquitectura (no negociables)

1. **Dependencias**: `core` no depende de nada del repo. Los demás paquetes pueden depender de `core`. `web` y `worker` dependen de los paquetes, **nunca entre sí**.
2. **El estado de un post solo cambia a través de la máquina de estados de `packages/core`**. Nunca con un `UPDATE` directo del campo `status`.
3. **Ningún post se publica sin haber pasado por `approved`**. Esto tiene test y no se toca.
4. **Todo contenido generado por IA se valida con Zod** antes de guardarse, sin importar qué proveedor o modelo lo generó.
5. **La web nunca ejecuta IA ni Playwright**. Eso es trabajo exclusivo del worker. La web encola jobs.
6. **Nada de una marca está hardcodeado.** Colores, tipografías, textos, assets, voz, pilares, precios y casos viven en la base y se editan desde el panel. En código solo existen los **presets de estilo** (ver `docs/DESIGN-SYSTEM.md`).
7. **Aislamiento de la generación**: `claude -p` se ejecuta en un directorio temporal FUERA del repo, con las instrucciones de la marca generadas desde la base como prompt de sistema (ADR 0005, modo liviano). Nunca se ejecuta dentro del repo.
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
