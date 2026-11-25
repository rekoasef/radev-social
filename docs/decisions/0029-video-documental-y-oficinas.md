# 0029 — Video documental, producido por oficinas

**Estado:** aceptada · 2026-11-25 · cierra V0 · reemplaza el alcance de V1 de `RADEV-STUDIO-REVISION.md` §7 (versión del 2026-11-23), reemplaza a 0028 y deja D-D (render por escena) para después

**Contexto.** V0 probó dos caminos para el video:
- **Animación con monigotes y escenarios armados con piezas** (V0-6 a V0-14, ADR 0028). Funcionó técnicamente, pero el operador la descartó: "no me gustan nada estos videos, son muy malos".
- **Formato documental** (2026-11-25): imágenes reales de archivo (Wikimedia Commons) con zoom lento, gráficos animados (fecha, cifra, nombre, cronología, cita), subtítulos karaoke y la voz de Alberto. Opinión del operador: "me encanta el video, quiero que así sea el formato".

El video de la Mona Lisa salió de punta a punta con scripts de la spike: investigación → búsqueda de imágenes → guion con visión → verificación de hechos con visión → voz en una sola toma → render → miniatura y descripción. Después salió también en 16:9 sin costo extra. El plan de V1 aprobado el 2026-11-23 era otro: escenas de plantilla, voz local, sin investigación, Shorts de 30–45 s y render por escena con FFmpeg. Hay que reescribirlo.

**Decisión.**
1. **El formato de V1 es el documental.** Los videos duran de 1,5 a 2,5 min y cada historia se cuenta con imágenes de archivo con licencia libre (dominio público, CC0, CC BY, CC BY-SA; nunca NC ni ND), siempre acreditadas en pantalla y en la descripción. Los monigotes, el kit de piezas, el Estudio y los looks quedan en la spike como historia: **no pasan al sistema**.
2. **Cada video sale en dos formatos**:
   - **Short** (9:16), con una descripción corta, sin capítulos y con #Shorts.
   - **Normal** (16:9), con la descripción completa y capítulos.
   - El guion, las imágenes y la voz son los mismos. Solo se renderiza dos veces: unos 4 min de máquina cada uno, sin gastar Claude ni créditos de ElevenLabs.
   - Antes, 16:9 estaba previsto para V2.
3. **La investigación y la verificación de hechos entran en V1** (decisión del operador del 2026-11-24: "no tiene que inventar nada"). La regla 9 vale también acá: todo número de la narración y de los gráficos tiene que estar en el dossier.
4. **La producción es una línea de montaje de oficinas.** Cada oficina tiene un solo trabajo y es un job del `video-worker`. Lee el documento de la anterior y deja el suyo, validado con Zod (regla 4). No son agentes que charlan entre sí: el orden es fijo y lo maneja la máquina de estados de `packages/core`.
5. **El video se renderiza entero, no por escena.** La voz sale de una sola toma; partirla por escena cortaba la entonación (V0-12). Así, D-D (clips por escena + armado con FFmpeg + caché por hash) no ahorra nada en V1. Queda para cuando haga falta rehacer escenas sueltas.
6. **V1 corre en la notebook** (como ya estaba decidido): `video-worker` y panel en local. El servidor sigue solo con los carruseles. Para tener un backup, el operador descarga el paquete y lo sube a Drive.
7. **La búsqueda web de `claude -p` se permite también para `video.research`**, la misma excepción de `ideas.research` (ADR 0005).

**Las oficinas.**

| # | Oficina | Quién trabaja | Deja |
|---|---|---|---|
| 1 | Investigación | `claude -p` con WebSearch y WebFetch | `dossier`: hechos con fragmento textual y fuente, citas, datos en disputa, lo no confirmado |
| 2 | Fuentes | Código: baja cada página y busca el fragmento | `sources`: cada hecho marcado como verificado o no |
| 3 | Imágenes | IA (consultas y curaduría por texto) + código (Commons, licencias, descarga) | `images`: 30–40 candidatas con autor, licencia, página y tamaño |
| 4 | Guion | `claude -p` mirando las imágenes | `script`: 16–20 escenas (narración, imagen, encuadre, gráficos), con `checkDocu` y hasta 3 intentos |
| 5 | Verificación de hechos | `claude -p` mirando las imágenes, contra el dossier | `review` + `script` corregido (solo se aplican las correcciones que no rompen reglas) |
| — | **Escritorio del operador** | Vos | Aprobar el guion, o rechazarlo con una nota (vuelve a Guion). Se puede editar el texto, cambiar una imagen o sumar una de Commons |
| 6 | Locución | ElevenLabs, una toma (`with-timestamps`), cortada por escena | `voice`: audio, tiempos por palabra y cuadros por escena |
| 7 | Render | Remotion, 9:16 y 16:9 | `render`: los dos MP4 con duración, tamaño, tiempo y control de calidad |
| 8 | Publicación | IA (título, gancho, capítulos, miniatura) + código (descripciones, fuentes, créditos, miniaturas) | `package`: título, las dos descripciones y las dos miniaturas |
| — | **Escritorio del operador** | Vos | Aprobar el video, o rechazarlo con una nota (vuelve a Guion o a Locución) |
| — | Descarga | La web | Un ZIP con `short/` y `normal/`, cada uno con `video.mp4`, `miniatura.png` y `descripcion.txt` |

**Alternativas.**
- **Seguir con los monigotes y mejorar los dibujos.** El operador ya los descartó.
- **Render por escena + FFmpeg, como decía D-D.** Con una sola toma de voz, rehacer una escena igual obliga a regenerar la voz entera. Más complejidad sin beneficio en V1.
- **Agentes autónomos que se pasan el trabajo.** Más difícil de controlar, medir y repetir. Una línea fija con documentos validados se audita escena por escena.
- **Llevar el video al servidor desde V1.** El servidor gratuito tiene 2 OCPU y 12 GB, y no se midió un render largo ahí (V0-9). Queda para después.

**Consecuencias.**
- **Costo por video** (medido con la Mona Lisa, 137 s):
  - `claude -p`: ~250k tokens de entrada / 40k de salida, ~USD 1,2 de lista (con la suscripción no se cobra, pero pesa en el límite).
  - ElevenLabs: ~1.900 créditos.
  - Render: ~8 min de máquina por los dos formatos.
- **Imágenes de terceros:** cada una se acredita en pantalla y en la descripción. Las CC BY-SA obligan a compartir igual las obras derivadas: el video ya las acredita con su licencia, y se revisa en V0-7 antes de monetizar.
- **Remotion** es gratis para personas y empresas de hasta 3 personas. Si el proyecto crece, hay que revisar la licencia.
- **La verificación no es determinista.** Si el dossier tiene un error, el guion lo repite. Por eso el operador aprueba el guion antes de pagar la voz.
- **ADR 0028 queda reemplazada.** El código del kit y del Estudio sigue en `spikes/video-v0` como referencia.
