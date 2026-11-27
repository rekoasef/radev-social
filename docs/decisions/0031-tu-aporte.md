# 0031 — «Tu aporte»: la opinión del operador dentro del video

**Estado:** aceptada · 2026-11-27 · amplía 0029 (escritorio del guion) y 0030 (papeles de escena)

**Contexto.** YouTube no monetiza el contenido «producido en masa o repetitivo» sin aporte propio, y una presentación de imágenes con voz sintética es lo que más se marca (PROGRESS, «Monetización de YouTube…», idea 1). Los videos ya tienen investigación con fuentes, verificación y aprobación humana, pero en pantalla no se oye a nadie: todo lo que dice el narrador sale del dossier. Desde V1, el escritorio del guion tiene reservado un recuadro «Tu aporte (próximamente)».

Hoy una opinión no puede entrar: el control del guion pide que cada dato salga del dossier, y la Verificación marcaría la opinión como «no-respaldado» y la sacaría.

**Decisión** (elegida con el operador el 2026-11-27).
1. **Se escribe en el escritorio del guion**, después de leerlo, cuando ya se sabe qué trajo la investigación. Es opcional. Mandarlo es una devolución: rehace Guion y Verificación con la suscripción de Claude, no gasta créditos de voz. La nota de devolución pasa a ser opcional si hay aporte.
2. **Se guarda en el video** (`videos.contribution`), no en el guion. Sigue valiendo en las devoluciones siguientes. Para cambiarlo, se edita en el escritorio; para sacarlo, se manda vacío.
3. **Entra en 1 o 2 escenas con un papel nuevo, `aporte`**, que vale en las cuatro formas. Nunca es la escena 1 (`gancho`) ni la última (`cierre`). Las escenas `aporte` no cuentan en las proporciones de la forma: por ejemplo, el 60 % de `hecho` de la cronología se calcula sin ellas.
4. **Suena en primera persona:** «Para mí, lo más raro de este caso es…». El código controla que la narración de esa escena tenga una marca de primera persona («para mí», «creo», «me parece», «pienso»…). Si no la tiene, se la devuelve a la IA como cualquier otro error.
5. **Solo opinión, sin datos nuevos.** La IA usa el ángulo del operador y se apoya en hechos del dossier. Si el aporte trae un dato que la investigación no tiene, no entra. Sigue valiendo la regla de los números: todo número de la narración tiene que estar en el dossier.
6. **La Verificación no la saca, pero la revisa.** Las instrucciones le dicen que las escenas `aporte` son la opinión del operador. Tiene que controlar que no afirme como cierto algo que el dossier no dice ni lo contradiga, y que siga sonando a opinión. Puede corregirla, pero el código descarta la corrección si le saca la primera persona.
7. **En pantalla, un cartel chico «Opinión»** en las escenas `aporte`. Lo dibuja el código según el papel de la escena, sin que la IA lo pida, así no se puede olvidar. Se ve en los dos formatos (arriba a la izquierda en vertical; abajo a la izquierda en horizontal, donde los subtítulos anchos ocupan la parte de arriba) y en el cuadro que mira la Verificación.

**Alternativas.**
- **Escribirlo al crear el video:** no suma una vuelta, pero se escribe antes de saber qué encontró la investigación. Queda para después, si el operador lo pide.
- **Plural del canal («acá creemos…») o atribuida al autor («quien hace este canal piensa…»):** igual de claras, pero menos personales.
- **Datos del operador atribuidos y sin verificar («según lo que encontré…»):** más libre, pero un error del operador llegaría al aire sin control.
- **Mezclarla en la narración sin papel propio:** no se podría controlar ni marcar en pantalla, y la opinión podría sonar a hecho.

**Consecuencias.**
- Migración que solo agrega la columna `videos.contribution` (texto, `null` = sin aporte).
- El guion no cambia de forma: `aporte` es un valor más de `beat`. Los guiones viejos siguen valiendo.
- Sumar un aporte cuesta una devolución, como una nota: unos USD 0,78 equivalentes de la suscripción (PROGRESS, «Gasto de Claude»). Abaratar las devoluciones sigue pendiente.
- Un aporte ayuda a mostrar que hay una persona detrás, pero no garantiza la monetización: la revisión de YouTube mira el canal entero.
- No cambian todavía la descripción ni el título. Una línea en la descripción («La opinión de la escena X es del autor») queda para después.
