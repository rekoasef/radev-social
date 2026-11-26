# RAdev Social

Gestor de redes sociales con IA para múltiples marcas (hoy RAdev y Lumus): genera, diseña, programa y publica carruseles en TikTok. Costo objetivo: USD 0 extra por mes.

En la rama `feat/video-v1` crece **RAdev Studio**: videos documentales para YouTube (imágenes de archivo, gráficos y voz), en dos formatos. Única excepción al costo cero: la voz de ElevenLabs.

- Guía para Claude Code: `CLAUDE.md`
- En qué estamos y qué sigue: `docs/PROGRESS.md`
- Producto y alcance: `docs/PRD.md`
- Arquitectura: `docs/ARCHITECTURE.md`
- Design system: `docs/DESIGN-SYSTEM.md`
- Roadmap: `docs/ROADMAP.md`
- Decisiones: `docs/decisions/`
- Datos iniciales de marcas: `seeds/`

## Cómo levantarlo

### 1. Requisitos (una sola vez por máquina)

- Windows con **WSL2** (Ubuntu) y **Docker Desktop** con la integración de WSL activada (Settings → Resources → WSL Integration).
- Dentro de WSL: `git`, [nvm](https://github.com/nvm-sh/nvm) y, para clonar el repo privado, `gh` logueado (`gh auth login`).
- El repo va en el disco de Linux (ej. `~/Proyectos/radev-social`), **nunca en `/mnt/c/...`**: ahí Docker y Next.js andan mucho más lento.

### 2. Código y dependencias

```bash
git clone https://github.com/rekoasef/radev-social.git ~/Proyectos/radev-social
cd ~/Proyectos/radev-social
nvm install && nvm use       # Node 24 (lee .nvmrc)
npm i -g pnpm@12.5.1         # si no lo tenés
pnpm install
```

### 3. Variables de entorno (`.env`)

El `.env` tiene claves y **nunca se sube a git**. Si ya tenés uno de otra máquina, copialo a la raíz del repo y saltá al paso 4. Si no:

```bash
cp .env.example .env
openssl rand -hex 24         # → POSTGRES_PASSWORD (y reemplazalo también dentro de DATABASE_URL)
openssl rand -base64 32      # → BETTER_AUTH_SECRET
openssl rand -hex 24         # → RENDER_TOKEN
```

- `ALLOWED_EMAILS`: tu email verificado de GitHub (los que no estén en la lista no pueden entrar).
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: de una OAuth App en github.com/settings/developers → *New OAuth App*, con homepage `http://localhost:3000` y callback `http://localhost:3000/api/auth/callback/github`.
- `RENDER_TOKEN`: clave de las páginas internas `/render` (preview y capturas de slides). Cada máquina puede tener la suya.
- `MEDIA_DIR`: dejalo vacío. Los archivos subidos (logos, orbe) van a `media/` en la raíz del repo, compartida por `pnpm dev` y Docker. No viajan con git: el seed recrea los de RAdev y Lumus.

### 4. Levantar

**Opción A: todo en Docker** (un comando; lo más parecido a producción):

```bash
docker compose up -d --build
```

Levanta Postgres, aplica migraciones, carga RAdev y Lumus, y arranca la web y el worker. Entrá a http://localhost:3000.

**Opción B: para desarrollar** (recarga al guardar):

```bash
docker compose up -d postgres
pnpm db:migrate && pnpm db:seed
pnpm dev                     # web en http://localhost:3000 + worker
```

Las dos opciones usan el puerto 3000: frená una antes de usar la otra (`docker compose stop web worker` o Ctrl+C en `pnpm dev`). La base es la misma.

### 5. Apagar

```bash
docker compose down          # los datos quedan guardados en el volumen de Docker
```

`docker compose down -v` **borra la base de datos**: no lo uses salvo que quieras empezar de cero.

### Hacer un video (rama `feat/video-v1`)

Necesita en el `.env` `CLAUDE_CODE_OAUTH_TOKEN` y `ELEVENLABS_API_KEY`, y `ffmpeg` instalado.

```bash
docker compose up -d postgres
pnpm db:migrate && pnpm db:seed
pnpm --filter @radev/web dev                 # terminal 1: el panel
pnpm --filter @radev/video-worker start      # terminal 2: las oficinas (acá se gasta)
```

En http://localhost:3000/videos: **Nuevo video** → aprobar el guion → aprobar el video → **Descargar paquete**. En qué estamos: `docs/PROGRESS.md`.

### 6. Ver las slides

- En el panel: **Marcas** → una marca → **Slides** muestra los 12 tipos con su identidad y el carrusel de ejemplo; **Identidad visual** edita colores, tipografías y archivos con vista previa en vivo.
- Capturas con Playwright (la primera vez: `pnpm exec playwright install chromium`):

```bash
pnpm capture "/render/preview/lumus/cover" /tmp/cover.png
pnpm capture --check "/render/preview/lumus/flow?variant=extreme" -   # control de desbordes
```

Todos los comandos están en la sección "Comandos" de `CLAUDE.md`.
