# Entornos de trabajo

El proyecto se trabaja desde dos computadoras. **Cada una se configura y se documenta por separado.** Lo que se instala, configura o mide en una no vale para la otra hasta verificarlo ahí.

## Reglas

1. **Antes de cualquier cambio de sistema**, como instalar paquetes, tocar `.wslconfig` o `/etc/wsl.conf`, cambiar swap o Docker, identificar la máquina con `hostname` en Windows y `wsl -l -v`, y confirmarlo con el operador.
2. **Las mediciones (V0 y siguientes) indican en qué máquina se hicieron.** Los resultados de la PC de casa (Ubuntu) no se extrapolan a la de la fábrica (Debian).
3. **El código no depende de la máquina.** Las dependencias del proyecto se fijan con pnpm (`pnpm-lock.yaml`), Node con `.nvmrc` y los servicios con Docker. Las herramientas nativas que use el sistema (por ejemplo `ffmpeg` para el Video Studio) van **dentro de la imagen de Docker**. Lo instalado en el sistema sirve solo para pruebas y desarrollo.
4. **Cada cambio de sistema se anota acá**, en la sección de la máquina: qué, cuándo, versión y cómo deshacerlo.

## PC de casa: entorno principal

Verificado el 2026-11-20.

| Dato | Valor |
|---|---|
| Windows | Windows 11 Home (10.0.26200), equipo `RENZO`, usuario `rekoa` |
| WSL | **Ubuntu-24.04**, usuario `rekoasef`, más la distro `docker-desktop` |
| CPU / GPU | AMD Ryzen 7 7735HS · NVIDIA RTX 4050 Laptop 6 GB (visible en WSL, driver 610.88) |
| RAM | 15,2 GB en Windows; WSL ve **~7,4 GB + 2 GB de swap** (valores por defecto, sin `.wslconfig`) |
| Docker | Docker Desktop con integración WSL activada para Ubuntu-24.04 |
| Node | Node 24 con nvm (`.nvmrc`); en shells no interactivos hace falta `source ~/.nvm/nvm.sh` |
| Postgres | El del proyecto, en Docker, en `127.0.0.1:5433`. Hay un Postgres nativo de otros proyectos en 5432: no tocarlo |
| `ffmpeg` | 6.1.1-3ubuntu5 (apt, solo para pruebas; desde el 2026-11-21) |
| Python | 3.12.3 del sistema; `python3.12-venv` y `espeak-ng` 1.51 con apt (solo para V0-2, desde el 2026-11-23). El entorno virtual de las voces vive en `spikes/video-v0/out/tts/.venv` (1,7 GB, fuera de git) |
| SSH a producción | **No**: no hay llave ni `Host radev-oracle` en `~/.ssh` |
| `/etc/wsl.conf` | Mal formado: falta un salto de línea antes de `[boot]`, por eso **systemd no arranca** (PID 1 es `init`). Pendiente de decisión aparte: no tocar sin aprobar |

### V0-0 de RAdev Studio (hecho el 2026-11-21)

V0-0 de RAdev Studio, ver `docs/RADEV-STUDIO-REVISION.md` (D-I):

- [x] Crear `C:\Users\rekoa\.wslconfig` (2026-11-21, WSL 2.6.3.0):
  ```ini
  [wsl2]
  memory=10GB
  swap=8GB

  [experimental]
  autoMemoryReclaim=dropCache
  ```
  `autoMemoryReclaim` sigue en `[experimental]` y su valor por defecto es `dropCache` (documentación de Microsoft, actualizada el 2026-10-16). Se dejó `dropCache` en vez de `gradual`: es la variante conservadora con Docker y ya es la que usa WSL.
- [x] Aplicarlo con `wsl --shutdown` desde PowerShell, que **apaga WSL y Docker** (se vuelven a levantar al abrirlos). Verificado el 2026-11-21 con `free -h`: WSL ve **9,7 GiB + 8 GiB de swap**. Para deshacerlo: borrar el archivo y hacer `wsl --shutdown`.
- [x] Instalar `ffmpeg` solo para las pruebas: `sudo apt install -y ffmpeg` (2026-11-21): **6.1.1-3ubuntu5** en `/usr/bin/ffmpeg`. Para deshacerlo: `sudo apt remove ffmpeg`.

### Historial de cambios

| Fecha | Cambio | Versión | Cómo deshacerlo |
|---|---|---|---|
| 2026-11-21 | `.wslconfig` creado y aplicado con `wsl --shutdown`: 10 GB de RAM (WSL ve 9,7 GiB), 8 GB de swap, `autoMemoryReclaim=dropCache` | WSL 2.6.3.0 | Borrar `C:\Users\rekoa\.wslconfig` y `wsl --shutdown` |
| 2026-11-21 | `ffmpeg` instalado con apt (solo para pruebas) | 6.1.1-3ubuntu5 | `sudo apt remove ffmpeg` |
| 2026-11-23 | `python3.12-venv` y `espeak-ng` instalados con apt por el operador (V0-2: entornos virtuales de Python y fonemas para Kokoro) | 3.12.3-1ubuntu0.17 · 1.51+dfsg-12build1 | `sudo apt remove python3.12-venv espeak-ng` |

## PC de la fábrica (Crucianelli)

Relevada el 2026-11-24 (solo lectura, sin cambios).

| Dato | Valor |
|---|---|
| Windows (equipo, usuario) | Windows 11 Pro, equipo `RASEFNOTE`, usuario `rasef` |
| WSL (distro, versión, usuario) | **Debian 13 (trixie)**, usuario `renzoasef`, más la distro `docker-desktop` · WSL 2.6.1.0, kernel 6.6.87.2-1 |
| CPU / GPU | AMD Ryzen 5 4600H (6 núcleos / 12 hilos) · AMD Radeon RX 5600M + Radeon integrada. Sin GPU NVIDIA: nada de `nvidia-smi` en WSL |
| RAM total / RAM que ve WSL | 11,4 GB en Windows; WSL ve **7,8 GiB + 4 GiB de swap** desde el `.wslconfig` (antes, por defecto, ~5,5 GiB + 2 GiB) |
| `.wslconfig` | `C:\Users\rasef\.wslconfig` (2026-11-24): 8 GB de RAM, 4 GB de swap, `autoMemoryReclaim=dropCache`. Aplicado y verificado con `free -h` el mismo día |
| Docker | Docker Desktop instalado. **No arranca solo**: hay que abrirlo, y la integración WSL con **Debian** tiene que estar activada (Settings → Resources → WSL integration); sin eso `docker` existe pero no llega al servicio. Confirmado el 2026-11-25: con la integración activa, `docker compose up -d postgres` levanta el Postgres del proyecto en 5433 |
| Node / nvm | nvm en `~/.nvm` con Node 18.20.8, 20.19.6 y 24.21.0. **El de por defecto es el 20**: hace falta `nvm use` (`.nvmrc` pide 24). pnpm 12.5.1 en el Node 24 |
| Postgres nativo en 5432 | Sí, escucha en `127.0.0.1:5432` (otros proyectos: no tocarlo) |
| `ffmpeg` | **7.1.3-0+deb13u1** (apt; ya estaba instalado). La de casa es 6.1.1 |
| SSH a producción (`radev-oracle`) | **Sí**: `Host radev-oracle` en `~/.ssh/config`, llave `id_ed25519_radev_oracle` |
| `/etc/wsl.conf` / systemd | Bien formado: `[boot] systemd=true`, `[user] default=renzoasef`. PID 1 = `systemd` |

**Para el video (2026-11-26):** el `.env` tiene `CLAUDE_CODE_OAUTH_TOKEN` y `ELEVENLABS_API_KEY`, Remotion ya bajó su Chrome (en `apps/video-worker/node_modules/.remotion`) y las ideas de la IA se probaron con el `video-worker`. **Falta medir el render de un video entero en esta PC.**

Sin `.wslconfig`, WSL veía 5,5 GiB (casi la mitad que la de casa) y el 2026-11-24 hubo un corte por falta de memoria (ver `docs/PROGRESS.md`). Por eso se creó uno con **8 GB** (Windows se queda con ~3,4 GB) y **4 GB de swap** (no 8: el disco `C:` está al 93 %, 35 GB libres). **El operador no tiene permisos de administrador en esta PC:** nada que se haga acá puede pedirlos (`.wslconfig` y `wsl --shutdown` no los piden).

Comandos para relevarla (solo leen, no cambian nada):

```bash
hostname; cat /etc/os-release | head -3; nproc; free -h
nvidia-smi 2>/dev/null | head -12      # GPU, si hay
cat /etc/wsl.conf; ps -p 1 -o comm=    # systemd o init
docker version --format '{{.Server.Version}}'
which ffmpeg node pnpm; ls ~/.ssh
```

En PowerShell: `wsl -l -v`, `$env:COMPUTERNAME` y `Test-Path $env:USERPROFILE\.wslconfig`.

### Historial de cambios

| Fecha | Cambio | Versión | Cómo deshacerlo |
|---|---|---|---|
| 2026-11-24 | `.wslconfig` creado: 8 GB de RAM, 4 GB de swap, `autoMemoryReclaim=dropCache`. Se aplica con `wsl --shutdown` desde PowerShell (apaga WSL y Docker); verificar con `free -h` | WSL 2.6.1.0 | Borrar `C:\Users\rasef\.wslconfig` y `wsl --shutdown` |
| 2026-11-24 | Chromium de Playwright del repo bajado a `~/.cache/ms-playwright` (`pnpm --filter @radev/slides exec playwright install chromium --only-shell`, sin `--with-deps`: nada de apt), para `preview` en V0-5. **Efecto secundario:** Playwright borró los navegadores que ningún proyecto registrado usaba (`chromium_headless_shell-1255` y `ffmpeg-1013`, de otro proyecto); si alguno los necesita, `npx playwright install` en ese proyecto | headless shell 1243 (Chrome 153), Playwright 1.63.0 | Borrar `~/.cache/ms-playwright/chromium_headless_shell-1243` y `ffmpeg-1011` |
| 2026-11-26 | Impeccable (skill de diseño de Claude Code) actualizado con `npx impeccable update`: skills en `~/.claude/skills/impeccable`, binario en `~/.impeccable/bin/0.1.31`, agentes en `~/.claude/agents` y un hook del detector de diseño en `~/.claude/settings.json` (y `~/.codex/hooks.json`). No toca el repo | v4.11.1 | `/impeccable hooks off` saca el hook; volver a una versión anterior con `npx impeccable@<versión> update` |
