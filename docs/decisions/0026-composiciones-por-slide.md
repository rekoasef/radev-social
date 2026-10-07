# 0026 — Composiciones por slide, escenas a sangre e imagen del medio

**Estado:** aceptada · 2026-10-07 · amplía 0015, 0016 y 0025

**Contexto.** Con los looks (0015) cada post cambió de piel, pero no de estructura: las plantillas son comunes a todos los looks, así que una portada siempre tenía el objeto arriba y el título abajo, los pasos siempre iban en lista y las tarjetas, pasos, flujo y diagrama usaban la misma pieza (`List`). El operador lo resumió así: "todos los looks tienen la misma estructura; que sigan los looks pero que la IA se esmere y le dé diferentes diseños, dibujos, imágenes, estructura". También pidió "un fondo" en algunas imágenes: eligió la imagen a sangre. Aprobó los prototipos sobre capturas (2026-10-07).

**Decisión.**
- Cada slide de `cover`, `statement`, `steps`, `cardGrid` y `cta` lleva un campo opcional `composition`: su estructura, independiente del look que la pinta. Sin el campo sale la estructura de siempre, así que los posts viejos no cambian.
  - `cover`: `hero` (objeto arriba), `bleed` (escena a sangre), `split` (título a la izquierda, objeto cortado por el borde derecho), `giant` (título arriba, objeto abajo).
  - `statement`: `center`, `quote` (comillas gigantes), `drawing` (un ícono en órbitas dibujado en código; campo nuevo `icon`), `photo` (una imagen generada arriba).
  - `steps`: `list`, `grid` (dos columnas con números grandes), `path` (zigzag por una línea central).
  - `cardGrid`: `list`, `tiles` (mosaico de paneles), `bento` (la primera tarjeta grande).
  - `cta`: `center`, `bleed`.
- La IA elige la composición de cada slide según su contenido y varía entre slides; se valida con Zod. El editor tiene un selector de composición por slide (marcas en `studio`).
- **Escena a sangre** (`bleed`): esa imagen es un lugar, no un objeto. Se pide en 4:5 (1024×1280) con un prompt propio (`scenePrompt`: luz del tono de la slide, el tercio de abajo tranquilo para el título, el acento como color fuerte) y ocupa toda la slide bajo un degradé al fondo del look. No pasa por el control de fondo liso. Sin imagen, la composición vuelve a la original.
- **Imagen del medio**: una afirmación `photo` lleva una tercera imagen (`art.middle`), con el fondo de la superficie de su slide. Una por carrusel; la imagen y la slide van juntas (lo controla el esquema). Sin imagen, la afirmación se dibuja como `drawing`. Hasta 3 imágenes por post: siguen entrando en el tope de 60 por día.
- La IA describe imágenes que se entiendan **en un segundo al lado del título**: el objeto más directo del tema, contado por su estado, sin metáforas rebuscadas.
- Las superficies de los looks con imagen pasan a un módulo sin React (`surfaces.ts`), que leen tanto los looks como el worker (para saber el fondo de la imagen del medio).

**Alternativas.**
- Más looks: cambian la piel, no la estructura.
- Composición al azar por el id del post: variaría sin sentido; la IA elige según el contenido (una lista corta va bien en `grid`, una tarjeta principal en `bento`).
- Escena en todas las portadas: se pierde el objeto grande, que funciona bien; queda como una opción más.

**Consecuencias.**
- Columna nueva: ninguna (todo vive en el JSON del contenido y en `post_versions.art`).
- Un post con escena o imagen del medio tarda unos 20–35 s más por imagen antes del render.
- Las composiciones nuevas pasan el control del render con los textos al límite en los 16 looks.
- Sumar una composición: agregarla a `COMPOSITIONS` (`content/compositions.ts`), con su etiqueta, dibujarla en `templates.tsx` y describirla en la guía de la IA (`compositionGuide`).
