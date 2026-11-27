# 0030 — Formas de contar los videos

**Estado:** aceptada · 2026-11-27 · amplía 0029 (oficina de Guion)

**Contexto.** Todos los videos de V1 tienen la misma estructura: un gancho con fecha y lugar, una pregunta, los hechos en orden y una pregunta final. Con dos videos no se nota; con veinte, el canal entero parece hecho con molde. YouTube no monetiza el contenido «repetitivo o producido en masa», y quien lo revisa mira el canal completo, no un video suelto (PROGRESS, «Monetización de YouTube…», idea 2). Hace falta que cada video pueda contarse de otra manera, sin sumarle trabajo al operador.

**Decisión.**
1. **Cuatro formas de contar.** Cada una cambia cómo arranca el video, cómo avanza, qué gráficos usa y cómo cierra:

| Forma | Sirve para | Arranca | Avanza | Gráficos | Cierra |
|---|---|---|---|---|---|
| **Cronología** («cómo pasó») | Un hecho con una secuencia clara | Fecha y lugar + pregunta | Un hecho por escena, en orden | Fecha, cronología | Pregunta abierta |
| **Misterio** («qué es esto») | Algo sin explicar del todo | El enigma, **sin fecha** ni contexto | Pistas e hipótesis; **la respuesta, en el último tercio** | Cifra, cita | «¿Vos a quién apostás?» |
| **Contraste** («lo que se creía y lo que se sabe») | Algo que se entendió mal, dos versiones, dos personas | Una afirmación del lado A | Bloques que alternan A y B (al menos dos cambios) y un **veredicto** con matiz | Carteles de cada lado («1902» / «HOY»), cifras enfrentadas | «¿De qué lado estás?» |
| **Qué pasó después** («y entonces…») | Un hecho famoso con consecuencias menos conocidas | El hecho, resuelto en 3 o 4 escenas como mucho | Bloques de «qué fue de…», cada uno con el cartel del nombre y un salto en el tiempo; **al menos el 60 % es el después** | Nombre, fecha | Dónde está hoy + pregunta |

   Las cuatro, aplicadas a Anticitera con los hechos de su dossier, quedaron en el chat del 2026-11-27 y en PROGRESS.
2. **La elige la oficina de Guion, después de leer el dossier.** Sabe qué forma aguantan los hechos (misterio necesita algo sin resolver; contraste, dos lados reales). Si el dossier no aguanta una forma, elige otra.
3. **El código no deja repetir la forma de los 2 videos anteriores** (los que ya tienen guion, sin contar los descartados). Esto protege al canal sin depender de que el operador se acuerde.
4. **En «Nuevo video», un selector opcional:** «Automática» (por defecto) o una forma fija. Si el operador la fija, la rotación no aplica.
5. **El escritorio del guion muestra la forma** y deja cambiarla al devolver el guion: rehace Guion y Verificación, como una devolución con nota.
6. **El código controla que la forma se cumpla.** La IA declara la forma del guion y el papel de cada escena (gancho, pista, revelación, lado A, veredicto…); `checkScript` controla el orden de cada forma. Si no cumple, se lo devuelve a la IA con el error, como el largo o los números.

**Alternativas.**
- **Que el operador elija siempre al crear el video:** todavía no sabe qué trajo la investigación, y suma una decisión por video. Queda como opción, no como regla.
- **Solo instrucciones, sin control en código:** la IA podía declarar «misterio» y entregar una cronología disfrazada.
- **Al azar:** podía tocar una forma que el dossier no aguanta.

**Consecuencias.**
- El guion trae dos campos nuevos (`form` y `beat` por escena). Los guiones viejos siguen valiendo: sin `form`, cuentan como cronología.
- `videos.form` guarda la forma que fijó el operador (`null` = automática): una migración que solo agrega la columna.
- La investigación no sabe qué forma viene: a veces no va a traer lo que una forma necesita (p. ej., hechos posteriores para «qué pasó después») y la IA va a elegir otra. Si se repite seguido, la investigación buscará según la forma.
- Siguen sin variar por forma el título y la miniatura. Queda para después.
