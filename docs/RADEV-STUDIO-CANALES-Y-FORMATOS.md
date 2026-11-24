# RAdev Studio — Canales, formatos y videos largos (análisis, 2026-11-24)

Análisis pedido por el operador (a partir de una conversación con ChatGPT) **antes de implementar nada**: elegir formato y duración, ideas para videos largos, varios canales de YouTube y si la notebook puede producir videos largos. No cambia código, base, migraciones ni Docker. Contexto: el estilo de video aprobado es el **animado y guionado** de V0-6 (`docs/V0-RESULTS.md`).

**Decisiones del operador en esta charla:**
- Los videos largos van de **3 a 5 minutos**. No se apunta a 10 minutos.
- Hay que monetizar en YouTube (ver §6).
- Propuesta aprobada para guardar en el repo ("sí, perfecto"). Las pruebas nuevas de V0 de §7 se suman al plan.

## 1. Lo central: el cuello de botella es el contenido, no el render

El render crece en línea recta con la duración (cada cuadro se dibuja aparte). Lo difícil es el **contenido**:

- **La biblioteca de dibujos define la variedad.** Los 36,5 s de V0-6 necesitaron 4 escenarios, 4 vestuarios y unos 10 objetos, hechos en código. Un video de 4 minutos tiene entre 35 y 50 momentos visuales, y solo se pueden armar con dibujos que existan.
- **Cada temática pide su biblioteca.** Historias necesita bancos, autos, policías, ciudades. Educación necesita diagramas, gráficos animados y mapas.
- **La variedad también es requisito para monetizar** (§6).

## 2. Recursos (medido y estimado)

**Render.** Medido en la fábrica: 36,5 s de video en 62,7 s (concurrency 2, Ryzen 5 4600H, WSL con 5,5 GiB). La PC de casa (Ryzen 7 7735HS, WSL con 9,7 GiB) fue un 26 % más rápida en V0-3 y puede usar concurrency 4; este estilo **no se midió todavía ahí**.

| Duración | Cuadros (30 fps) | PC de casa (estimado) | Fábrica (proyectado de lo medido) | Disco por versión |
|---|---|---|---|---|
| 45 s | 1.350 | ~1 min | ~1,3 min | ~30 MB |
| 3 min | 5.400 | 3–4 min | ~5 min | ~120 MB |
| 4 min | 7.200 | 4–6 min | ~7 min | ~160 MB |
| 5 min | 9.000 | 5–7 min | ~9 min | ~200 MB |

- **Disco:** MP4 final ~0,33 MB/s (medido) más clips por escena y la voz en PCM (96 KB/s).
- **16:9** (1920×1080) tiene los mismos píxeles que 9:16: mismo costo por cuadro.
- **RAM:** depende de la concurrency, no del largo (los cuadros van directo al archivo). Fábrica: concurrency 4 → 640 MiB libres de 5,5 GiB; concurrency 2 → ~2 GiB libres.
- **GPU:** el render es SVG dibujado por Chrome en la CPU; la RTX 4050 casi no se usa. Importaría solo con imágenes o video generados por IA en local (fases V4–V5).

**Generación (aparte del render):**

- **Voz:** 502 caracteres = 35 s de Fran a 1,3 (~14 caracteres por segundo). Un video de 4 min son ~3.500 créditos de ElevenLabs. El Starter tiene 30.000 por mes (ADR 0027): unos 8 videos de 4 minutos, o unos 40 Shorts, o una mezcla. Las correcciones gastan aparte, aunque la caché por escena rehace solo lo que cambia.
- **Claude (`claude -p`):** sin medir, así que no se estima. Pistas:
  - El guion de 36 s ocupa 13 KB; uno de 4 min sería varias veces más grande.
  - Conviene generarlo por etapas: idea → capítulos → escenas por capítulo.
  - Lo que más influye: largo, cantidad de escenas, el catálogo de dibujos que Claude tiene que conocer (va en cada pedido) y las correcciones.
  - Se mide en V0-8 con el uso que informa `claude -p`.

**WSL y estabilidad:**
- WSL tiene un tope de memoria.
- Si Windows suspende la notebook, el render se corta.
- `/mnt/c` es lento: todo vive en Linux.
- Los programas de Windows compiten por la CPU.

Mitigación:
- Un render a la vez, con concurrency fija (4 en casa, 2 en la fábrica).
- Worker con prioridad baja.
- Siempre por escenas, nunca un video entero de un tirón.

## 3. Pipeline para videos largos

- **Capítulos → escenas.** Cada escena es un trabajo de la cola con caché por hash (V0-3). Si una escena falla, se reintenta solo esa; si se corta el proceso, se retoma desde la última escena terminada. El armado (concat + audio en PCM + mux con `-t`) es el de V0-3.
- **Previsualización:** el Player de Remotion en el panel muestra el video en vivo, sin render. Para un MP4 de borrador, escala 0,5 (cuánto ahorra en este estilo se mide en V0-9). El final va siempre en 1080p.
- **Formatos:** hoy el guion usa posiciones fijas sobre un escenario de 1080×1920. Para 16:9:
  - Los escenarios se dibujan anchos y la **cámara** del guion encuadra vertical u horizontal.
  - El formato se elige al crear el proyecto; no hay conversión automática entre formatos en la primera versión.
  - Subtítulos y titulares cambian de lugar según el formato.

## 4. Varios canales

La base ya existe. Hoy cada **marca** tiene:
- su identidad (tokens, logo);
- su voz y sus documentos;
- pilares, horarios e historial;
- sus **cuentas conectadas**: `social_accounts`, una por red, con tokens cifrados (regla 10);
- sus métricas: `post_metrics` y `audience_snapshots`, por cuenta.

Un canal de YouTube es eso mismo.

1. **Sin entidad `channels` aparte.** La marca se generaliza: en el panel se llama "Canales" y cada una conecta TikTok y YouTube. Una tabla paralela duplicaría identidad, voz, horarios y métricas.
2. **Relaciones:** canal → proyectos de video → escenas (voz, clip) → publicaciones (una por cuenta conectada). Un proyecto puede no tener canal (D-B, ya aprobado): sirve para proyectos sueltos y pruebas.
3. **Identidad y voz:** voz por defecto por canal (ADR 0027), paleta y tipografías del canal. El motor de dibujos es común y toma los colores del canal.
4. **Que no se mezclen:** proyectos, recursos y guiones llevan el id del canal, y cada consulta filtra por él, como hoy con los posts. Biblioteca en dos partes: la común del motor (personajes, escenarios) y la propia del canal (logo, recursos subidos).
5. **Credenciales de YouTube:** login de Google por canal, tokens cifrados, como TikTok. A verificar en la documentación oficial antes de diseñar (V0-7): la cuota diaria gratis de la API y cuánto consume una subida, y si las subidas desde apps no verificadas quedan privadas hasta pasar una auditoría.
6. **El mismo video en otro canal:** "duplicar en otro canal" copia el guion y lo vuelve a narrar y renderizar con la otra identidad. Ojo con la política de contenido repetido (§6).
7. **Métricas por canal:** salen de las cuentas conectadas, como hoy.
8. **Clientes:** un campo "propio / cliente" con el nombre del cliente. Paneles separados por cliente serían otra arquitectura y no hacen falta.

Escala a muchos canales sin rehacer nada: son filas, no código.

## 5. Experiencia de uso

1. Elegís un canal (o un proyecto suelto).
2. Elegís el formato: Short 9:16 (30–60 s) o video 16:9 (3–5 min).
3. Claude propone duración, enfoque y **5 ideas** del canal: título, historia, gancho inicial, duración, cantidad de escenas y enfoque visual. Se apoya en el módulo de ideas de Social.
4. Elegís una, la editás o escribís la tuya.
5. Se genera el guion. **Primera aprobación.**
6. Storyboard: el Player con las escenas.
7. Render por escenas. **Segunda aprobación.**
8. Descargás o publicás.

Todo editable, y cada escena se puede rehacer sola.

## 6. Monetización en YouTube (consultado el 2026-11-24)

- **No hay duración mínima para monetizar:** los videos cortos llevan anuncios antes y después. Los **anuncios en el medio** (*mid-roll*) se habilitan desde **8 minutos** ([ayuda de YouTube](https://support.google.com/youtube/answer/6175006)). Un video de 3–4 min gana menos por vista que uno de 8, pero monetiza.
- **Entrada al programa de socios:** 1.000 suscriptores + 4.000 horas de reproducción públicas en 12 meses, **o** 10 millones de vistas de Shorts en 90 días, más 3 videos en los últimos 90 días ([YouTube Partner Program](https://support.google.com/youtube/answer/72851)). Las horas de Shorts no cuentan para las 4.000. Guías de terceros dicen que desde el **1/2/2027** se duplican (8.000 horas o 20 millones de vistas); confirmarlo en YouTube Studio → Ingresos.
- **Contenido "genérico o repetitivo" (aclaración de julio de 2026):** no se monetiza lo que "parece hecho con una plantilla" o se siente repetido al ver varios videos seguidos del mismo canal. Entre los ejemplos aparecen canales de historias narradas con diferencias superficiales ([TechCrunch](https://techcrunch.com/2026/07/20/youtube-clarifies-policies-around-ai-slop-and-upsetting-videos/), [Tubefilter](https://www.tubefilter.com/2026/07/13/youtube-inauthentic-content-monetization-policy-update/)). Usar IA no descalifica: lo que penaliza es producir en serie videos casi iguales.

**Qué cambia para nosotros:**
- La variedad de la biblioteca de dibujos es requisito para monetizar.
- Los guiones no tienen que seguir siempre el mismo molde.
- La revisión humana (las dos aprobaciones) se mantiene.
- Nada de publicar el mismo video en varios canales.

## 6 bis. Lumus también hace videos (pedido del operador, 2026-11-24)

El sistema tiene que servir también para videos de **Lumus**, como un canal más:
- **Identidad:** violeta `#6E5CE8`, la orbe como elemento de marca y sus tipografías.
- **Voz:** Carlos Pro, la comercial (ADR 0027).

Lo que Lumus necesita y los videos de historias no:
- **Datos reales en pantalla.** Dólar, inflación, rendimientos: los números salen de Bluelytics y los pone el código, nunca la IA (regla 9). El guion dice qué dato va en cada lugar.
- **Gráficos animados.** Una línea que se dibuja o barras que crecen.
- **Capturas reales de la app dentro del celular** (como la slide `screen`, ADR 0024).
- **Personajes y escenarios con la paleta de la marca.**

Impacto en las pruebas:
- **V0-8:** dos guiones, uno de historias (Fran) y uno de Lumus (Carlos Pro, con datos y una captura).
- **V0-10:** los primeros dibujos nuevos son el gráfico animado y el celular con captura real.

Pendiente del operador: qué tipo de videos de Lumus (educación financiera, promoción de la app o una mezcla) y qué capturas usar.

## 7. Recomendación

**V1:**
- Shorts animados y guionados de 30 a 60 s, por canal (identidad y voz del canal).
- 5 ideas por canal y guion con `claude -p`.
- Revisión y descarga.
- "Canales" como evolución de las marcas.

**V2:**
- Videos 16:9 de 3 a 5 minutos, con capítulos.
- Publicación en YouTube.

**Pruebas que se suman a V0** (las que miden, en la PC de casa):

- **V0-8, ampliada:** `claude -p` escribe un guion en el formato de `spikes/video-v0/src/anim/guion.ts` para un Short y el plan de capítulos de un video de 4 min, solo con los dibujos que existen. Medir tokens, tiempo y porcentaje que pasa Zod.
- **V0-9, nueva — render largo:** un video 16:9 de 5 min armado repitiendo las escenas de V0-6 (no hace falta contenido real). Medir tiempo, memoria pico, disco y temperatura, concurrency 2 y 4, y la escala 0,5 para el borrador. Cortarlo a la mitad y retomarlo.
- **V0-10, nueva — biblioteca:** cuánto cuesta sumar un escenario o personaje nuevo con buena calidad. Uno de "Educación": un diagrama o gráfico animado.
- **V0-7, ampliada:** cuota y restricciones de la API de YouTube (apps no verificadas), y el cupo de ElevenLabs para videos de 3–5 min.

Varios canales no necesita prueba: es modelado de datos sobre lo que ya funciona.
