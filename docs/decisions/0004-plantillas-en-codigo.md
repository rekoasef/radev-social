# 0004 — Slides con plantillas en código, no con generación de imágenes

**Estado:** aceptada · 2026-09

**Contexto.** Los carruseles hechos con un modelo de imágenes salieron inconsistentes (colores y tipografías variables, riesgo de errores en el texto). El estilo de las marcas es 100% reproducible con HTML y CSS.

**Decisión.** La IA genera solo el contenido (JSON validado con Zod). Las slides son componentes React + Tailwind con temas por marca, renderizados a PNG con Playwright. Sin fotos ni imágenes generadas.

**Consecuencias.** Identidad idéntica en cada post, texto siempre correcto, costo de render cero, preview y render con el mismo código. Límite: solo se puede mostrar lo que las plantillas saben dibujar; ampliar el catálogo requiere código.
