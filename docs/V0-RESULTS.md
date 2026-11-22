# Resultados de V0 (RAdev Studio)

Pruebas definidas en `RADEV-STUDIO-REVISION.md` §6. Cada resultado indica la máquina en la que se midió: **los números de una máquina no valen para la otra** (`ENVIRONMENTS.md`).

Código de las pruebas: `spikes/video-v0/` en la rama `spike/video-v0` (descartable). Las salidas (MP4, audio, mediciones crudas) quedan en `spikes/video-v0/out/`, fuera de git.

## V0-0 · Prerrequisitos (PC de casa, 2026-11-21)

- `.wslconfig`: 10 GB de RAM y 8 GB de swap. WSL ve 9,7 GiB y 8 GiB de swap.
- `ffmpeg` 6.1.1-3ubuntu5 con apt.
- Línea base en reposo, con Docker Desktop apagado: WSL ~0,5 GiB usados, GPU 36 °C. La temperatura de la CPU no se puede leer desde WSL; queda sin medir.

## V0-1 · Remotion en el entorno local

**Máquina:** PC de casa (Ubuntu), 2026-11-21. Remotion 4.0.545, Node 24.15, Chrome Headless Shell 158 (lo baja Remotion), 16 hilos. Docker, web y worker **apagados**.

**Qué se renderizó:** un Short de 1080×1920 a 30 fps con 5 escenas de motion graphics (título por palabras, lista con entradas, número que cuenta, cita que se escribe, cierre con pulso), fondo animado en todas, dos tipografías del repo (Space Grotesk e Inter Tight). H.264, sin audio. Composición en `spikes/video-v0/src/Short.tsx`, medición en `scripts/bench.ts`.

| Video | Concurrency | Render (3 corridas) | s de render por s de video | RAM pico WSL | CPU promedio / máx. | GPU máx. | MP4 |
|---|---|---|---|---|---|---|---|
| 30 s | 2 | 48,2 · 47,4 · 46,8 s | 1,58 | 1,9–3,0 GiB | 29 % / 59 % | 43 °C | 7,9 MiB |
| 30 s | 4 | 34,3 · 34,1 · 34,3 s | 1,14 | 2,1 GiB | 43 % / 70 % | 45 °C | 7,9 MiB |
| 30 s | 6 | 33,3 · 33,3 · 33,2 s | 1,11 | 2,3–2,4 GiB | 46 % / 70 % | 45 °C | 7,9 MiB |
| **45 s** | **4** | **54,0 · 50,8 · 50,7 s** | 1,13–1,20 | 2,1–3,2 GiB | 43 % / 74 % | 45 °C | 11,4 MiB |

- **Bundle** (empaquetar el proyecto antes de renderizar): 15,2–15,4 s en frío, 4,1–4,4 s con caché.
- **Swap:** nunca se usó.
- **Windows:** 12–13 GB usados de 15,2 durante el render, con ~12 GB ya en reposo (Windows + la VM de WSL). El render suma poco del lado de Windows, pero el margen total es chico: cerrar programas pesados en las sesiones de render sigue valiendo.
- **El primer render de cada tanda** usa ~1 GiB más de RAM y tarda un poco más (Chrome arrancando).

**Lectura:**
- **Éxito: un Short de 45 s en ~51 s con concurrency 4** (el criterio pedía ≤ 3 min), con WSL lejos de 8 GB y sin inestabilidad.
- **De 4 a 6 casi no mejora** (−3 %) y usa más RAM: el cuello de botella no es la cantidad de pestañas, la CPU nunca pasó del 50 % de promedio. **Concurrency por defecto: 4.**
- El `.wslconfig` (10 GB) alcanza con margen para el render solo.

**Pendiente de V0-1:**
- [ ] Una corrida con la web, el worker y Postgres levantados al mismo tiempo.
- [ ] Ver si `@remotion/player` anda dentro del panel (se puede pasar a V1: no cambia ninguna decisión).
- Temperatura de la CPU: no se puede leer desde WSL. La GPU no subió de 45 °C (Remotion renderiza con la CPU).

## V0-7 · Licencias y condiciones

*En curso.* Primera lectura (2026-11-21), a confirmar en las páginas oficiales antes de cerrar:

| Herramienta | Licencia | Uso comercial | Nota |
|---|---|---|---|
| Remotion 4.0.545 | Licencia propia | **Gratis** para personas, organizaciones sin fines de lucro y empresas de **hasta 3 personas**; desde 4 se paga la Company License | El tope cuenta la suma de empresas que colaboran. Remotion 5.0 cambia la licencia con el mismo tope: revisar al actualizar |
| Kokoro-82M | Apache 2.0 (pesos), MIT (código) | Sí | Depende de espeak-ng (GPLv3) para idiomas que no son inglés. Datos de entrenamiento mayormente en inglés: el español puede sonar peor (lo decide V0-2) |
| Piper (OHF-Voice/piper1-gpl) | GPL-3.0 | Sí para generar audio; la GPL importa si se distribuye el programa | El repo original (MIT) quedó archivado en octubre de 2025. **Cada voz tiene su licencia**: revisar la ficha de cada una en V0-2 |
