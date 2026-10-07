# 0025 — Imágenes con FLUX.2 klein 4B y prompt de foto editorial

**Estado:** aceptada · 2026-10-07 · cambia el modelo y el prompt de 0016

**Contexto.** El operador pidió que las imágenes de portada y cierre (0016) fueran "mucho mejores". Mirando las de producción (RA-0015, RA-0010, RA-0006): el objeto ocupaba poco del cuadro (el prompt pedía "generous negative space"), FLUX.1 schnell daba a veces un render 3D barato y algunos fondos salían con humo o un pedestal. Se comparó schnell contra FLUX.2 klein 4B, con el prompt de entonces y con uno de foto editorial, sobre los 3 temas de producción (15 imágenes, 2026-10-07).

**Decisión.**
- Modelo `@cf/black-forest-labs/flux-2-klein-4b` en Cloudflare Workers AI, 1024×1024, pedido como multipart (`prompt`, `width`, `height`). Sale con aspecto de foto real: materiales, reflejos, relieve, fondos limpios. Cuesta casi lo mismo que schnell (~105 neuronas por imagen contra ~96): el tope de 60 por día sigue entrando en el cupo gratis. Licencia Apache 2.0, la única de la familia FLUX.2 sin restricciones de uso comercial.
- Prompt de **foto editorial de producto**: lente macro, el objeto grande (unos dos tercios del cuadro) pero entero y con margen, detalle de material, luz baja con borde del acento sobre negro o luz difusa sobre blanco, fondo puro sin piso, humo ni utilería, tono de campaña premium.
- El acento de la marca pasa de ser "la luz" a ser **el color dominante del objeto**. Con el prompt de foto y el acento como luz, las imágenes salían casi sin color (vidrio transparente, cristales blancos) y la marca desaparecía.
- Tiempo de espera por imagen de 90 s (klein tarda 15–36 s; schnell, ~3 s) y vencimiento de `art.generate` de 8 minutos para el peor caso (2 imágenes × 2 intentos).

**Alternativas.**
- Mantener schnell con el prompt nuevo: mejora el tamaño, pero sigue viéndose como un render y desobedece más (dibujó abierta una cápsula pedida "cerrada").
- FLUX.2 klein 9B, Leonardo Lucid Origin y Phoenix: 1.360 a 2.600 neuronas por imagen; entrarían 3 a 7 por día.

**Consecuencias.**
- Un post con imagen tarda entre 30 s y 1 minuto más antes del render (antes, unos 10 s). Corre en el worker y no se nota en el panel más que en la espera del primer render.
- Las imágenes viejas no cambian: las versiones nuevas generan con el modelo y el prompt nuevos (el prompt distinto evita reutilizar imágenes viejas).
- Que los temas sean variados (no siempre esferas y vidrio) depende de la guía de `art` que lee la IA, no del modelo.
