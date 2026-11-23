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

**Sin verificar.** Lo único que se sabe es que usa WSL con **Debian**. La primera vez que se trabaje desde ahí, completar esta tabla antes de instalar o medir nada:

| Dato | Valor |
|---|---|
| Windows (equipo, usuario) | ? |
| WSL (distro, versión, usuario) | Debian, ? |
| CPU / GPU | ? |
| RAM total / RAM que ve WSL | ? |
| `.wslconfig` | ? |
| Docker | ? |
| Node / nvm | ? |
| Postgres nativo en 5432 | ? |
| `ffmpeg` | ? |
| SSH a producción (`radev-oracle`) | ? (posiblemente sí: falta confirmar) |
| `/etc/wsl.conf` / systemd | ? |

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
| — | (todavía ninguno) | | |
