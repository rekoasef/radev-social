# 0015 — Looks por post (preset `studio`)

**Estado:** aceptada · 2026-09-29 · amplía 0004 y 0008

**Contexto.** Con un preset por marca (0008), todos los carruseles de RAdev salían con el mismo esqueleto: título arriba, un diagrama chico con cajas de borde naranja, mucho vacío y el mismo pie. En producción, seis posts seguidos parecían el mismo. El operador lo describió como "genéricos, básicos, todos iguales" y pidió que "cada post sea diferente, como ChatGPT, que hace imágenes siempre distintas". Entre dos posts cambiaba el texto, pero no el diseño ni la estructura. Además, el principio "layout consistente en todas las slides" (DESIGN-SYSTEM §1) empujaba hacia esa monotonía.

**Decisión.**
- Preset nuevo, `studio`. La marca carga una **paleta** chica como tokens (oscuro, claro, acento y un segundo acento; tipografías display, texto, mono y serif), y el código ofrece **looks**: direcciones de arte completas que combinan esa paleta de formas distintas. Hay 16 looks: editorial, bloques, atmósfera, plano, terminal, recorte, suizo, revista, neón, monocromo, bauhaus, recibo, chat, documento, gradiente y brutalista. La marca desactiva los que no quiere desde el panel.
- **Cada post tiene un look** (campo `look` del carrusel). Lo elige la IA según el tema, entre los activos de la marca menos los de los 2 últimos posts. El operador lo puede cambiar en el editor. Un post sin look (manual o viejo) toma uno de los activos según su id, siempre el mismo.
- Un look es un **kit** en código (`packages/slides/src/presets/studio/looks/`): la superficie de cada slide (oscura, clara o de acento, según su lugar en el carrusel), el fondo, el encabezado, el pie, el estilo del énfasis y unas pocas piezas (panel, lista, botón y decoración). Las **plantillas son comunes** a todos los looks: saben la estructura de cada tipo de slide y la dibujan con las piezas del look. Sumar un look no toca las plantillas.
- **Ajuste de densidad** (`fitSlide`): antes del control de calidad, en el navegador, si el contenido de una slide no entra, su bloque se achica con `zoom` (hasta 0,6) y el texto se reacomoda. Reemplaza la calibración a mano de cada tipo en cada look, que con 16 looks × 12 tipos no escala.
- La consistencia pasa a ser **dentro del carrusel**: todas las slides de un post comparten look. **Entre posts**, la variedad es lo buscado. Los principios de §1 siguen valiendo: sin personas, sin fotos, sin ilustraciones infantiles, y todo lo de la marca como datos.
- Tipografía nueva en la lista curada: **Fraunces** (serif, OFL), para los looks que la piden (revista).
- `bold` y `soft` siguen como estaban. Cambiar de preset es una decisión de cada marca en el panel.

**Alternativas.**
- Más presets, uno por marca: no resuelve la monotonía dentro de una marca.
- Variantes al azar dentro de `bold`: poca variación real, porque el esqueleto sigue igual.
- Generar las slides como imágenes con IA: texto poco fiable en español, identidad inestable y costo. Queda como complemento posible (imagen protagonista por post), sin reemplazar las plantillas (0004).
- Calibrar a mano cada tipo en cada look: 192 combinaciones, frágil ante cualquier cambio de texto.

**Consecuencias.**
- La IA suma una decisión más, el look. Se valida con Zod como todo lo demás y cuesta poco: la guía de looks es un párrafo en `slides.md`.
- Un look es código, así que sumar uno lleva commit, captura y aprobación, como un preset.
- El ajuste de densidad corre en el navegador: el render, la vista previa del panel y la herramienta `pnpm --filter @radev/slides preview` lo ejecutan antes del control de calidad. Un texto largo se ve más chico en lugar de fallar. El control de calidad sigue fallando si ni al mínimo entra.
- Posts publicados antes del cambio no cambian: sus PNG ya están hechos. Si una marca pasa a `studio`, un post viejo que se vuelva a renderizar toma un look.
