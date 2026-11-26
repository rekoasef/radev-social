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
| 7 | El guion pasó en el último intento (3 de 3) | Guion | Largo y números | 4 intentos; después, la etapa 5 (abajo) |

**Para corregir el video publicado** (lo hace el operador): «Volver a revisar» → «Volver al escritorio del guion» → pies en las escenas 2, 8, 11 y 17, otra imagen en la 4, y en la 13 «aviones espía» (eso vuelve a grabar toda la voz). La miniatura se rehace al aprobar. En YouTube hay que subirlo de nuevo.

## Etapas 1 y 2 del recorrido por las oficinas (2026-11-26)

**1. Ver el cuadro final.** Al terminar su revisión de texto, la Verificación dibuja un cuadro fijo por escena en los dos formatos (a mitad del zoom, con carteles, pie, crédito y la primera línea de subtítulos; sin voz) y una segunda IA los mira con las descripciones completas. Corrige imagen, pie, encuadre, gráficos o pide la foto entera; nunca la narración. Si los cuadros no se pueden dibujar, el video sigue y el escritorio lo avisa.
- **El operador ve los mismos cuadros** en el escritorio del guion (Short / Normal). Al editar una escena, el `video-worker` la vuelve a dibujar (job `video.frames`). Los archivos se llaman por su contenido (`frames/<clave>-<formato>.jpg`): solo se dibuja lo que cambió.
- **Probado con el guion publicado de D.B. Cooper:** atrapó el cartel de Florence Schaffner («ella no aparece ahí»), el Boeing de Lufthansa y el de la FAA, «Noche del salto» sobre una montaña de día y el U-2 de 1960. Se le escapó la etiqueta de tabaco como «Evidencia» (ese cartel lo saca el código). 40 cuadros, ~90.000 tokens de entrada, 2 min.
- Dibujar 38 cuadros: 29 s.

**2. Fotos apaisadas en el Short.** Una escena puede ir con la foto **entera** sobre una copia desenfocada (`whole`), en vez de llenar la pantalla. La pide el guionista o la revisión de cuadros (un grupo de personas, un documento); el código la fuerza solo si cubrir mostraría menos de la mitad de lo pedido (una panorámica). Por defecto la foto llena la pantalla, como antes: probar «entera» para todas las apaisadas dejaba casi todo el video en una franja.

## Etapa 3: imágenes del caso real (2026-11-26)

En D.B. Cooper, de 32 candidatas solo ~5 eran del caso; el resto, relleno. Ahora la oficina de Imágenes **primero** trae las imágenes libres de los artículos de Wikipedia que más cita el dossier (hasta 2 artículos y 16 imágenes, desde 400 px), y **entran siempre**, antes de lo que elige la curaduría. Las que solo están en Wikipedia (uso legítimo) no están en Commons y quedan afuera solas; los íconos de la plantilla, también.
- Probado con el artículo real de D.B. Cooper: 16 imágenes libres que la búsqueda no había encontrado, entre ellas **los retratos robot del FBI**, la escalerilla del 727, el mapa de la zona del salto, el dispositivo «Cooper vane» y fotos de sospechosos. No todas son del hecho (un 727 de Piedmont, una estatua actual): el guionista las ve marcadas como `delCaso` y siguen valiendo `exact` y la revisión de cuadros.
- Varias son chicas (430–500 px): en pantalla se ven más blandas. El guion las usa enteras o sin acercar mucho.
- Un artículo que no existe o no responde no frena la oficina.

## Etapa 4: fuentes que sirven (2026-11-26)

Antes, 24 de 25 hechos de D.B. Cooper daban «no está en la página»: la búsqueda de Investigación le pasa a la IA un resumen de cada página, así que sus «fragmentos textuales» no estaban en ningún lado y el control no distinguía un dato falso de uno bien citado.
- **Cómo es ahora:** Fuentes baja cada página; lo que no aparece textual se lo pasa a una IA **sin búsqueda** (tarea `video.sources`) con el texto real, de a partes de 30.000 caracteres. La IA copia de 1 a 3 frases que lo respaldan y dice qué parte del hecho la página no dice (`differs`); **el código comprueba que cada frase esté en la página**. Se controlan también las citas.
- **Qué reciben Guion y Verificación** (`usableDossier`): cada hecho con la frase real de su página en `excerpt`; los respaldados a medias, con «(la página NO dice: …)»; sin los que su página no dice (salvo que eso deje menos del 60 % o menos de 8: entonces van todos y el escritorio lo avisa).
- **Probado con el dossier real de D.B. Cooper** (3 pruebas, ajustando): 23 de 31 hechos y citas textuales, 8 a medias, 0 descartados. Marcó «la página dice SR-71, no U-2», «un año después, no menos de cinco meses» y que la página citada no da la fecha del 8 de julio de 2016. 82 s y ~94.000 tokens de entrada.
- Lo que se aprendió en las pruebas: con la página entera de Wikipedia (más de 120.000 caracteres) la IA no encontraba frases que estaban («el único secuestro sin resolver»): por eso va de a partes. Y un dato repartido en dos oraciones daba «a medias»: por eso hasta 3 frases.
- El escritorio muestra la frase de cada hecho y lo que la página no dice, y tacha los que no llegaron al guion.

## Etapa 5: el guion en menos intentos (2026-11-26)

En D.B. Cooper el guion pasó en el 3.º intento: el 1.º se pasó por ~400 caracteres. La causa estaba en las instrucciones: pedían 1.400–1.800 en total pero permitían escenas de hasta 28 palabras (20 × 28 da más del doble).
- Cada escena: **70 a 100 caracteres** (12 a 17 palabras). Las fechas en pantalla, solo con números que dice la voz.
- Cuando se pasa, el aviso dice **cuánto sobra y qué escenas acortar** (las 4 más largas, con su largo).
- La etiqueta de una cifra que repite la unidad la arregla el código (`tidyScript`) sin gastar un intento.
- **Probado con el dossier y las imágenes de D.B. Cooper:** 2 intentos (el 1.º, por números de una fecha), 1.732 caracteres de entrada, 124 s, ~100.000 tokens. Declaró `exact` en todas las escenas y puso pie a las que no son el hecho; el código sacó dos carteles que las fotos no respaldaban («Dan Cooper» sobre un afiche, «JCPenney» sobre la sede del FBI).

## Etapa 6: la voz (2026-11-26)

Cuatro tomas de las escenas 7 a 9 de D.B. Cooper, con el volumen igualado (−14 LUFS), para elegir de oído: A como hoy (`eleven_multilingual_v2`, ajustes guardados de Alberto: estabilidad 0,3, estilo 0,3), B más estable (0,5 y estilo 0,15), C `eleven_v3` (estabilidad 0,5) y D `eleven_v3` con «...» para las pausas. ~1.200 créditos.
- **Elegida: C, `eleven_v3`.** El operador primero dijo «dejalo así», después le gustó la D, pero la sintió lenta: la lentitud venía de las pausas agregadas, no del modelo (D 21,6 s, C 17,7 s, A 20,8 s). Se usa v3 sin puntuación especial (ADR 0027, nota).
- v3 solo acepta estabilidad 0, 0,5 o 1: se manda 0,5 siempre. Los subtítulos muestran «...» como «…» si aparece.
- **Falta escucharlo en un video entero.** Si se siente rápido, se puede bajar la velocidad de la voz (0,95) en su ficha.

## Lo que todavía no se controla

- **Homónimos:** el código compara nombres, no personas (en el ejemplo de la Mona Lisa, un Giovanni Poggi de 1770). Queda como regla para la IA.
- **Un cartel con nombre sobre una foto de grupo** que sí lo nombra: depende del encuadre que elija la IA.
- Las reglas nuevas **no se probaron todavía con un video real**.
- Un dato que una parte de la página respalda a medias y otra parte completa queda «a medias» (no se juntan frases de partes distintas): el guion lo evita aunque sea cierto.
- La revisión de cuadros mira el **medio** del zoom: lo que se ve al empezar o al terminar la escena puede ser distinto.
- Las etapas 1 y 2 **no se probaron con un video nuevo de punta a punta**.
