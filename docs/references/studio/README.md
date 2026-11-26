# Estudio de video: diseño aprobado (T10)

Capturas aprobadas por el operador el 2026-11-26. Son la referencia visual de T12 (panel `/videos`). Dirección y reglas del estilo: `apps/web/DESIGN.md` → "Estudio de video", y la ficha de dirección en `apps/web/.impeccable/surfaces/app-panel-videos-page-tsx.md`.

| Pantalla | Compu | Celular |
|---|---|---|
| El estudio: plano del piso, cartel "Te espera", planilla | `01-estudio-compu.png` | `01-estudio-celular.png` |
| Una oficina por dentro (Guion), con pausa, falla y libre | `02-oficina-compu.png` | `02-oficina-celular.png` |
| Nuevo video | `03-nuevo-video-compu.png` | `03-nuevo-video-celular.png` |
| Aprobar guion | `04-aprobar-guion-compu.png` | `04-aprobar-guion-celular.png` |
| Aprobar video y paquete | `05-aprobar-video-compu.png` | `05-aprobar-video-celular.png` |

**Elegida: A, el plano del piso**, entre tres direcciones. Las otras dos quedan en `descartados/`: B (línea de montaje) y C (pared de cámaras). El operador pidió un tono "bien de juego" y pensado para la compu.

**Datos:** el guion, las imágenes, la publicación y los tiempos de voz son los reales de la Mona Lisa (`packages/video/test/fixtures`). Los gastos por oficina son los medidos con Betty y Barney Hill. Las correcciones de la verificación, el estado de las fuentes, los tamaños de archivo y los demás videos son de ejemplo.

## Maqueta

`maqueta/` tiene las páginas HTML estáticas que generan las capturas. No son código de la app: sirven de referencia para portar a componentes en T12. Las escenas se dibujan en SVG a partir de los datos, y `scene-top.js` es lo que hay que llevar a React.

```bash
bash docs/references/studio/maqueta/bajar-imagenes.sh          # miniaturas de Commons (no van a git)
node docs/references/studio/maqueta/capturar.cjs estudio guion  # → maqueta/out/*.png
```

Las páginas cargan Geist de Google Fonts y los íconos de unpkg, así que necesitan internet.
