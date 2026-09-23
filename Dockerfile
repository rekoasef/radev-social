# Imágenes de RAdev Social. Un solo Dockerfile con tres destinos:
#   docker build --target web     → panel Next.js (servidor standalone)
#   docker build --target worker  → worker de pg-boss
#   docker build --target migrate → aplica migraciones y seed, y termina
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
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/slides/package.json packages/slides/
COPY packages/ai/package.json packages/ai/
COPY packages/publishers/package.json packages/publishers/
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
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]

# --- worker-deploy: el worker con solo sus dependencias de producción --------------------
FROM source AS worker-deploy
RUN pnpm --filter @radev/worker deploy --prod /out

# --- worker ------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --from=worker-deploy --chown=node:node /out ./
USER node
# node directo (no pnpm/npm) para que las señales de apagado lleguen al proceso.
CMD ["node", "--import", "tsx", "src/index.ts"]
