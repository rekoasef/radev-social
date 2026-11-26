# Imágenes de RAdev Social. Un solo Dockerfile con tres destinos:
#   docker build --target web     → panel Next.js (servidor standalone)
#   docker build --target worker  → worker de pg-boss
#   docker build --target migrate → aplica migraciones y seed, y termina
#   docker build --target video-worker → RAdev Studio: las oficinas del video (perfil `video`)
# La base es node:24 slim (Debian), publicada para amd64 y arm64: el mismo Dockerfile sirve
# para la compu local y para un servidor ARM (CLAUDE.md, regla 12).

ARG NODE_VERSION=24

# --- base: Node + pnpm -------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@12.5.1 && npm cache clean --force
WORKDIR /repo

# --- deps: todas las dependencias del monorepo, desde el lockfile ------------------------
# Se copian solo los manifiestos para que Docker reuse esta capa mientras no cambien.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY apps/video-worker/package.json apps/video-worker/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/slides/package.json packages/slides/
COPY packages/ai/package.json packages/ai/
COPY packages/publishers/package.json packages/publishers/
COPY packages/video/package.json packages/video/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile

# --- source: dependencias + código --------------------------------------------------------
FROM deps AS source
COPY . .
# pnpm escribe estos dos archivos con permiso 600; el usuario `node` del contenedor tiene que leerlos.
RUN chmod a+r pnpm-lock.yaml pnpm-workspace.yaml

# --- migrate: migraciones + seed (solo agrega marcas que falten) --------------------------
FROM source AS migrate
# tsx directo (no `pnpm run`, que intenta reinstalar dependencias antes de cada script).
WORKDIR /repo/packages/db
# Punto de montaje de la media (./media en local; en producción, un volumen, que Docker crea
# con el dueño de esta carpeta).
RUN mkdir -p /data/media && chown node:node /data/media
USER node
CMD ["sh", "-c", "node --import tsx src/migrate.ts && node --import tsx src/seed/index.ts"]

# --- web-build: compila el panel ----------------------------------------------------------
FROM source AS web-build
# El build importa los módulos del servidor, que exigen estas variables al cargarse. Van
# valores de relleno solo para este comando: no son secretos, no quedan en la imagen final
# y las reales llegan al arrancar el contenedor (compose.yaml).
RUN DATABASE_URL=postgres://build:build@localhost:5432/build \
    BETTER_AUTH_SECRET=build-time-placeholder-only-not-a-real-secret \
    BETTER_AUTH_URL=http://localhost:3000 \
    GITHUB_CLIENT_ID=build \
    GITHUB_CLIENT_SECRET=build \
    pnpm --filter @radev/web build

# --- web: solo el servidor standalone, sin el monorepo -----------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS web
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=web-build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
RUN mkdir -p /data/media && chown node:node /data/media
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# --- worker-deploy: el worker con solo sus dependencias de producción --------------------
FROM source AS worker-deploy
RUN pnpm --filter @radev/worker deploy --prod /out

# --- worker ------------------------------------------------------------------------------
# Incluye Chromium para renderizar slides (Playwright). Pesa ~400 MB más; hay versiones para
# amd64 y arm64. Los navegadores van a /ms-playwright, legible por el usuario `node`.
# Claude Code (`claude -p`) viene con las dependencias: @anthropic-ai/claude-code, fijado en
# packages/ai, instala el binario nativo de la plataforma (amd64 o arm64) al hacer el deploy.
FROM node:${NODE_VERSION}-bookworm-slim AS worker
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY --from=worker-deploy --chown=node:node /out ./
# --with-deps instala las librerías del sistema que Chromium necesita (apt, como root).
RUN node node_modules/playwright/cli.js install --with-deps --only-shell chromium \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/media && chown node:node /data/media
USER node
# node directo (no pnpm/npm) para que las señales de apagado lleguen al proceso.
CMD ["node", "--import", "tsx", "src/index.ts"]

# --- video-worker-deploy: las oficinas del video con solo sus dependencias de producción -------
FROM source AS video-worker-deploy
RUN pnpm --filter @radev/video-worker deploy --prod /out

# --- video-worker (T13) --------------------------------------------------------------------
# RAdev Studio (ADR 0029): Claude Code (viene con las dependencias, como en el worker), ffmpeg (la
# voz, las copias chicas de las imágenes, ffprobe) y el Chrome de Remotion para el render, bajado
# al construir la imagen (no en el primer video). Las librerías de apt son las que Remotion pide
# para Chrome en Debian. Sin Playwright: Remotion trae su propio navegador.
FROM node:${NODE_VERSION}-bookworm-slim AS video-worker
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates fonts-liberation \
       libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxrandr2 \
       libxkbcommon0 libxfixes3 libxcomposite1 libxdamage1 libpango-1.0-0 libcairo2 libcups2 \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/media && chown node:node /data/media /app
COPY --from=video-worker-deploy --chown=node:node /out ./
USER node
RUN node -e "import('@remotion/renderer').then((r) => r.ensureBrowser())"
# node directo (no pnpm/npm) para que las señales de apagado lleguen al proceso.
CMD ["node", "--import", "tsx", "src/index.ts"]

# --- backup: pg_dump + rclone (fase 4, T12) -----------------------------------------------
# Backup diario de Postgres (cifrado) y de media/ a un almacenamiento compatible con S3 (B2, R2
# o MinIO para probar). Misma versión mayor de Postgres que la base (17). Ver infra/backup/.
FROM postgres:17-bookworm AS backup
RUN apt-get update \
    && apt-get install -y --no-install-recommends rclone curl ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
COPY --chmod=755 infra/backup/*.sh /usr/local/bin/
# Como el usuario `node` de web y worker (uid 1000): lo que restaure en media/ lo pueden escribir.
ENV HOME=/tmp
USER 1000:1000
WORKDIR /tmp
CMD ["backup-loop.sh"]
