# 0016 — Imágenes generadas con IA en portada y cierre

**Estado:** aceptada · 2026-09-29 · amplía 0004 y 0015

**Contexto.** Con los looks (0015) cada post cambió de diseño, pero el operador quería además ese "toque" de imagen única por post, como cuando ChatGPT genera imágenes. 0004 descartó generar las slides como imágenes: el texto sale mal en español, la identidad no es estable y hay costo. Una prueba de calidad con Cloudflare Workers AI (FLUX.1 schnell) dio buenos resultados con objetos simbólicos sobre fondo liso (una esfera agrietada, un candado, una cerradura), a unos 3 segundos por imagen y dentro de un cupo gratuito diario. También mostró el riesgo: el modelo a veces ignora el fondo pedido (un escudo sobre blanco para un look oscuro).

**Decisión.**
- Cloudflare Workers AI, modelo `@cf/black-forest-labs/flux-1-schnell`, con la cuenta gratuita del operador. El cupo es de 10.000 neuronas por día (~100 imágenes); un tope propio de 60 imágenes diarias deja margen. Si se agota, los pedidos fallan: el plan gratis no cobra excedentes. Cumple la regla 13 (costo cero).
- Las imágenes van **solo en la portada y el cierre**, y **solo en los looks donde encajan**: atmósfera, neón, gradiente, revista, editorial y monocromo (este, en blanco y negro). Los demás (terminal, recibo, chat, plano…) siguen siendo solo diseño.
- La IA que escribe el carrusel describe **un objeto** por imagen, en inglés. El código agrega siempre las reglas: un objeto, sin texto ni personas, el fondo de esa slide y el color de acento de la marca. Zod rechaza descripciones con personas o con cosas que el modelo llenaría de letras inventadas (carteles, pantallas, libros, gráficos). El texto de las slides lo sigue poniendo el código: 0004 no cambia.
- Un job propio, `art.generate`, corre entre la escritura y el render. Controla el fondo (brillo de los bordes, medido en el Chromium del worker), reintenta una vez, reutiliza la imagen de otra versión del mismo post si el prompt no cambió y **nunca bloquea un post**: sin credenciales, con el cupo agotado o con el servicio caído, el post sale con el diseño propio del look y el panel dice por qué.
- La imagen se funde con la slide (mezcla `screen` sobre fondo oscuro, `multiply` sobre claro, bordes desvanecidos) y queda en la capa "elemento gráfico": el operador la puede mover y escalar (0013). En el editor se ve, se cambia su descripción, se piden imágenes nuevas o se quita.

**Alternativas.**
- Gemini (Google): los cupos gratuitos de imágenes cambian seguido y la información disponible venía de blogs, no de la documentación oficial.
- API de imágenes de OpenAI: paga.
- Imágenes en todas las slides: compiten con el texto y multiplican el consumo.
- Generar las slides completas como imagen: descartado por 0004.

**Consecuencias.**
- Servicio externo nuevo, gratis. Credenciales `CLOUDFLARE_ACCOUNT_ID` y `CLOUDFLARE_API_TOKEN` en el `.env` (desarrollo y servidor); nunca en logs ni en el repo.
- Columna `post_versions.art` (migración 0016): estado y rutas de las imágenes. Las imágenes viven en `media/`, junto a los PNG de la versión, y viajan con los backups como el resto de `media/`.
- Un post nuevo con imagen tarda unos 10 segundos más antes del render.
- La calidad depende de un modelo externo: si Cloudflare cambia el modelo o el cupo, los posts siguen saliendo sin imagen, y este ADR se revisa.

**Ampliación (2026-09-29): elemento de marca.** Una marca puede cargar su propio elemento gráfico en `studio` (`heroAsset`; para Lumus, la orbe). Aparece en portada y cierre de los looks con imagen cuando el post no tiene imagen generada, en lugar de la decoración del look. Con `heroAlways`, aparece siempre, la IA no describe imágenes y no se generan: la marca conserva su firma visual sin gastar cupo.

