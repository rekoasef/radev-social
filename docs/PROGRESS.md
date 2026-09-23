# Progreso

Bitácora viva del proyecto: en qué tarea estamos, qué falta, qué se decidió y cómo trabajamos. Es la "memoria" compartida entre máquinas y sesiones de Claude: **se lee al empezar y se actualiza al terminar cada tarea**, en el mismo commit que la tarea.

`docs/ROADMAP.md` dice *qué* tiene cada fase; este archivo dice *dónde estamos* dentro de ella.

---

## Estado actual

- **Fase:** 0 — Cimientos
- **Próxima tarea:** T11 (cierre de la Fase 0)
- **Última actualización:** 2026-09-23, al cerrar la T10

## Fase 0 — tareas

Plan aprobado el 2026-09-23.

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
| T11 | Cierre: sección Comandos del CLAUDE.md completa, ROADMAP marcado, README "cómo levantar", recorrer el criterio de terminado de la fase | ⏳ próxima |

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

## Anotado para más adelante

**Fase 1:**
- Faltan las referencias `ref-statement.png`, `ref-question.png`, `ref-cta.png` y una captura real de TikTok para calibrar zonas seguras.
- `ref-flow-1/2.png` sugieren un tipo de slide nuevo `flow` (recomendado) en vez de un `cardGrid` conectado: decidir con el operador.
- Las 4 referencias actuales son inconsistentes entre sí: fijar reglas y mostrárselas al operador antes de implementar.
- `heroAsset` / `logoAsset` de Lumus son nombres de archivo sin enlazar a `brand_assets`.

## Cómo trabajamos

- **Una tarea por vez.** Antes de codear, plan corto. Al terminar: resumen con archivos, "cómo lo verificás" con comandos concretos y decisiones tomadas. Después preguntar si se commitea y se sigue.
- **Commits solo con OK del operador**, en Conventional Commits en inglés. Cada commit de tarea actualiza este archivo.
- **Infraestructura:** explicar cada comando en 1–2 frases antes de correrlo, sin dar nada por sabido.
- **Decisiones visuales:** mostrar ejemplos o capturas; una página de texto con colores no alcanza para elegir.
- **Capturas de la web:** Edge headless de Windows (`/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe --headless=new --screenshot=...`). Para ancho de celular, meter la página en un iframe de 390px (Edge no baja de ~500px). Las páginas con login no se pueden capturar así: pedirle al operador que las mire.
- **Tokens:** el operador limpia el contexto entre tareas; este archivo tiene que alcanzar para retomar sin re-derivar nada.

## Retomar en otra máquina

Requisitos: WSL2, Docker Desktop con integración WSL, git, nvm, `gh` logueado, Claude Code. El repo va en el disco de Linux (ej. `~/Proyectos/radev-social`), nunca en `/mnt/c`.

```
git clone https://github.com/rekoasef/radev-social.git && cd radev-social
nvm install && nvm use
npm i -g pnpm@12.5.1        # si no está
pnpm install
# .env: NO está en el repo; copiarlo por un canal privado (plantilla: .env.example)
docker compose up -d postgres
pnpm db:migrate && pnpm db:seed
pnpm dev                    # http://localhost:3000
```

La base de cada máquina es independiente: el seed recrea las marcas.
