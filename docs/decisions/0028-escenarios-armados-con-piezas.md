# 0028 — Escenarios del video armados con piezas, a medida de cada historia

**Estado:** aceptada · 2026-11-25 · amplía la biblioteca de lugares de V0-10 (`docs/V0-RESULTS.md`)

**Contexto.** Desde V0-10, cada escena elegía un lugar de una biblioteca fija dibujada en código (banco, bóveda, túnel, cine, plano…) con la regla de variedad del operador: ningún lugar en más de 3 escenas. En el video del apagón de S3 (V0-14, 18 escenas) la regla obligó a usar al menos 6 lugares, pero para una historia de servidores calzaban 2 o 3: el guion rellenó con el cine, el plano (con "BÓVEDA" escrito), la tienda y el banco. Dirección marcó algunos y propuso otros que tampoco calzaban. Pedido del operador: **"cada video tiene que tener escenas personalizadas"**.

**Decisión.**
- **Cada video arma sus propios escenarios** (`sets` del guion, 3 a 7) con un **kit de piezas dibujadas a mano** (`spikes/video-v0/src/anim/kit.tsx`), y cada escena dice en `setting` el id de su escenario. Un escenario: interior o exterior, hora (`dia`, `atardecer`, `noche`), color de pared, tipo de piso y 3–16 piezas con posición, tamaño, espejo y color.
- **El kit es uno solo para todos los videos** y crece: hoy 39 piezas (techo, pared, exterior, muebles, tecnología, decoración, ambiente). Reglas de la biblioteca de V0-10: sin textos fijos, algo siempre en movimiento, estilo plano. Si un escenario necesita una pieza que no existe, el guion la anota en `missingPlaces` y se dibuja una vez.
- **Posición única para todas las piezas:** (x, y) es el centro de la base. Lo que va encima de un mueble se apoya con `on` (índice del mueble) y el código calcula la altura. El piso de todos los escenarios armados está en y = 1340 (personajes con los pies en y ≈ 1330).
- **Los 13 lugares de V0-10 quedan como plantillas**, solo para cuando la historia pasa exactamente ahí. El catálogo de la IA prohíbe usar una plantilla que no tenga que ver.
- **La lista de piezas que lee la IA sale del código** (`kitDoc()` en `kit-catalog.ts`): sumar una pieza es dibujarla y agregarla a `PIECES`.
- La regla de variedad del operador sigue igual (máximo 3 escenas por escenario, nunca el mismo con el mismo encuadre en dos escenas seguidas): con escenarios a medida, ya no obliga a rellenar.
- Controles en código (`checkSet`): piso acorde a interior o exterior, `on` apuntando a un mueble anterior con superficie, lo que va sobre un mueble sin `on`, piezas fuera del cuadro, ids repetidos o iguales a una plantilla.

**El Estudio: el kit crece solo (pedido del operador, 2026-11-25: "la IA tiene que ser capaz de decir que no están hechos los escenarios y hacerlos y guardarlos en el kit").**
- Si la historia necesita algo que no está (un ovni, la vitrina de una carnicería), el guion lo declara en `newPieces` (nombre, cómo es, dónde va, tamaño) y ya lo usa en sus `sets`. El catálogo le prohíbe reemplazarlo por algo que no es.
- `pnpm studio draw <guion>` le pide a Claude cada pieza nueva **como datos, no como código**: formas simples (`rect`, `circle`, `ellipse`, `path` con comandos absolutos), colores con nombre de una paleta fija y movimientos predefinidos (mecer, flotar, titilar, girar, latir, deslizar). Se valida con Zod (regla 4) y con controles en código: límites de la pieza, grupos, algo que se mueva, ni texto ni colores sueltos. Hasta 3 intentos con los errores.
- **El operador aprueba cada pieza al principio** (decisión del 2026-11-25): queda `pendiente` con su vista previa (`pnpm studio sheet`), y `approve` la suma al kit o `reject <pieza> "<motivo>"` la manda a redibujar con el motivo. El render no arranca si un escenario usa una pieza sin aprobar. Más adelante, cuando la calidad sea pareja, se puede pasar a automático.
- La biblioteca vive en `spikes/video-v0/studio/pieces/<pieza>.json` (en git: es parte del kit). Las aprobadas y pendientes aparecen en la lista de piezas que lee la IA, así ningún video vuelve a pedir la misma.
- Costo medido (Sonnet): ~5,5k tokens de entrada y ~10k de salida por pieza (~USD 0,11 de lista), una sola vez por pieza.

**Alternativas.**
- **La IA dibuja el SVG de cada fondo:** totalmente a medida, pero ~40k tokens de salida más por video y calidad despareja (habría que revisar cada fondo). Descartada.
- **Lugares fijos con variantes** (objetos extra, colores): lo más rápido, pero una oficina sigue siendo una oficina y cada historia nueva pide dibujar un lugar entero. Descartada.

**Consecuencias.**
- El guion es más largo: los `sets` suman ~1–2k tokens de salida por video y la lista de piezas ~1,5k de entrada por vuelta. A cambio, no más escenas de relleno.
- Riesgo de que los videos se parezcan (mismas piezas): se varía con color, hora, cantidad y posición; a revisar después de varios videos.
- En V1, el kit es parte del paquete de video (piezas en código, como los presets de estilo de los carruseles: regla 6). Los colores de la marca pueden aplicarse encima de los tonos sin redibujar.
