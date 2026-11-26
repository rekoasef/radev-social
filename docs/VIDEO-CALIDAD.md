# Calidad de los videos: errores encontrados y qué se hizo

Bitácora de lo que falla en los videos reales de RAdev Studio. Antes de tocar las instrucciones o los controles de una oficina, mirá acá. Cada error nuevo se anota con su causa y su arreglo.

## Video 1: D.B. Cooper (2026-11-26, publicado en YouTube)

Primer video hecho entero desde el panel: 39 min desde el tema hasta aprobarlo, ~370.000 tokens de entrada y ~58.000 de salida de Claude, 1.943 créditos de voz, render de 10 min sin problemas de memoria. Sin devoluciones.

| # | Error | Oficina | Causa | Arreglo (2026-11-26) |
|---|---|---|---|---|
| 1 | Cartel «Florence Schaffner · Azafata» sobre una foto donde ella no está; en el Short, encima de un hombre | Guion, Verificación | A Verificación le llegaban 90 caracteres de la descripción: quién es quién quedaba cortado. Nada controlaba los carteles | Descripción completa. El código saca todo cartel `nombre` que la imagen no nombra (`name-cards.ts`), también al cambiar la imagen en el escritorio |
| 2 | Una etiqueta de tabaco de 1870–1900 como «Evidencia · Hallada en el avión» | Guion | Se permitía ilustrar con cualquier objeto parecido | Campo `exact` por escena (si no es el hecho, pie obligatorio, controlado por código); regla: un objeto genérico nunca es evidencia; el cartel «Evidencia» lo saca el código |
| 3 | «Aviones U-2» (probablemente fueron SR-71) | Investigación | El dossier tomó el dato de una sola página | Datos técnicos: confirmados en dos sitios o van a `disputed`; Verificación usa la forma general ante la duda |
| 4 | Imágenes sin aclarar: Boeing de Lufthansa, foto actual de un volcán como «Noche del salto», correo actual | Guion | La regla del pie existía en las instrucciones, pero nada la hacía cumplir | `exact` + pie obligatorio |
| 5 | Miniatura floja: otro avión, cielo blanco en media imagen, texto chico | Publicación, render | La foto apaisada se recortaba a 9:16; las instrucciones pedían poco | Miniatura nueva (en vertical la foto apaisada ocupa la parte de arriba, texto que llena el ancho, palabra clave en bloque amarillo, más contraste). Tiene que ser una imagen del hecho (control de código), preferir cara/objeto/documento, texto de 2 líneas cortas. Nunca la cara de un sospechoso |
| 6 | Voz baja: −17 LUFS (YouTube usa −14 y no sube los videos bajos) | Locución | Sin normalizar | `loudnorm` al decodificar la toma (medido: −14,1 LUFS) |
| 7 | El guion pasó en el último intento (3 de 3) | Guion | Largo y números | 4 intentos |

**Para corregir el video publicado** (lo hace el operador): «Volver a revisar» → «Volver al escritorio del guion» → pies en las escenas 2, 8, 11 y 17, otra imagen en la 4, y en la 13 «aviones espía» (eso vuelve a grabar toda la voz). La miniatura se rehace al aprobar. En YouTube hay que subirlo de nuevo.

## Lo que todavía no se controla

- **Nadie mira el cuadro final.** Las IA ven cada foto entera, no el recorte vertical con sus carteles. Propuesta pendiente: un control visual que dibuje un cuadro por escena (sin voz, antes de tu aprobación del guion) y lo haga revisar.
- **Homónimos:** el código compara nombres, no personas (en el ejemplo de la Mona Lisa, un Giovanni Poggi de 1770). Queda como regla para la IA.
- **Un cartel con nombre sobre una foto de grupo** que sí lo nombra: depende del encuadre que elija la IA.
- Las reglas nuevas **no se probaron todavía con un video real**.
- Fuentes: 24 de 25 hechos «no están» en su página (WebFetch le pasa a la IA un resumen). Sigue siendo informativa.
