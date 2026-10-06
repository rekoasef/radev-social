# 0024 — Capturas de pantalla en los carruseles generados

**Estado:** aceptada · 2026-10-06 · amplía el RF-15

**Contexto.** Para posts como "cargar un gasto en Lumus lleva segundos desde el celular", lo que convence es ver la app. La IA escribía sobre la pantalla sin verla y ninguna slide podía mostrar una imagen del operador: las imágenes generadas (ADR 0016) son objetos, sin pantallas ni texto, y solo van en portada y cierre. El operador quiere pasarle capturas a la IA al generar, sin ir a una biblioteca de archivos.

**Decisión.**
- **Dónde se suben**: en Nuevo post → Generar con IA (sirve desde una idea del banco o desde cero), hasta **4** capturas PNG, JPEG o WebP de hasta 5 MB, cada una con una frase de 3 a 120 caracteres que dice qué muestra. El navegador achica las grandes (JPEG de 2000 px como máximo) para que entren en un pedido. Solo marcas `studio`.
- **De quién son**: del **post**, en una tabla propia, `post_screenshots` (migración `0027`; archivos en `media/<marca>/screens/`), no en `brand_assets`: no se mezclan con el logo y el elemento de marca, y se borran con el post. Todas las versiones del post las comparten.
- **La IA las ve**: `claude-code` recibe las imágenes en el mensaje (`--input-format stream-json`, cada una después de la línea "Captura `<id>`: <frase>"; verificado con el token de la suscripción, Claude Code 2.1.282). OpenRouter recibe solo las frases (`screenshots.json`), que van siempre.
- **Slide nueva `screen`** (solo `studio`): `title`, `body?` y `screens` (1 o 2 ids). El dispositivo sale de la proporción de la captura: vertical → **celular** al costado del texto; si no → **notebook**; una de cada → **notebook con el celular adelante**. Dispositivos dibujados en código, iguales en todos los looks (DESIGN-SYSTEM §5).
- **Reglas que controla el código** (`aiCarouselSchema`): con capturas, el carrusel lleva **al menos una** slide `screen`; solo ids de capturas del post; dos juntas, una de cada dispositivo. Sin capturas, `screen` se rechaza. Lo mismo en "Rehacer una slide" y en las revisiones. El editor elige entre las capturas del post y el guardado rechaza ajenas.
- **Cifras**: las que se ven en una captura las puso el operador y la IA puede nombrarlas tal cual; no puede inventar otras (regla 9 intacta).

**Alternativas.** Que la IA lea solo la frase: más barato, pero no puede contar lo que se ve (en la prueba real el `flow` copió los pasos reales del formulario). Subirlas a una biblioteca de la marca y elegirlas: el operador no quiere un paso más. Captura a pantalla completa con el texto encima: descartada en los prototipos (el degradé tapa la mitad). Recortar en el panel: para más adelante; por ahora la ayuda pide capturas cerradas.

**Consecuencias.** Un post con capturas consume más del límite de la suscripción: ~25.000 tokens de entrada por carrusel con dos capturas (antes ~12.500) y ~24.000 por cada "Rehacer una slide" del post, porque las imágenes van siempre. Sigue siendo USD 0. Las marcas `bold` y `soft` no dibujan `screen`. Pendiente para después: recortar en el panel y marcar una zona de la captura.
