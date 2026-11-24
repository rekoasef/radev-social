# 0027 — Voces del video con ElevenLabs (pago) y voz elegida por video

**Estado:** aceptada · 2026-11-23 · excepción a la regla 13 (costo cero), dentro del tope de USD 6/mes que el operador aceptó el 2026-09-28 · completa D-G de `RADEV-STUDIO-REVISION.md`

**Contexto.** El Video Studio necesita voz en off en español rioplatense y en inglés, con tiempos por palabra para los subtítulos. En V0-2 se probaron voces locales y gratis (Kokoro y Piper, `docs/V0-RESULTS.md`). En inglés, Kokoro `am_michael` le gustó al operador ("fluida y muy profesional"). En español ninguna lo convenció ("muy mala"): están entrenadas casi todo en inglés, `espeak-ng` no tiene variante rioplatense, y Kokoro baja el tono en las preguntas de sí/no (medido: −28 %, sin arreglo posible). Las referencias del operador (TikToks narrados) piden una voz que suene humana.

**Decisión.**
- **ElevenLabs, plan Starter (USD 6/mes, 30.000 créditos + los no usados del mes anterior, licencia comercial).** Lo paga el operador desde el 2026-11-23. El plan gratis no sirve: no tiene licencia comercial y no deja usar las voces de la biblioteca por la API (HTTP 402).
- **Modelo `eleven_multilingual_v2`** (1 crédito por carácter): un Short de 45 s son ~700 caracteres, unos 40 Shorts por mes. Con la caché por escena (por hash del texto y la voz), corregir una frase regenera solo esa escena.
- **Tiempos por palabra** desde el endpoint `/v1/text-to-speech/{voz}/with-timestamps`, que devuelve tiempos por carácter del texto original. Las palabras salen sin alineación extra, también con números ("1978").
- **Varias voces y una elegida por video.** Catálogo de voces en la base (proveedor, id de la voz, nombre, uso: narrativa o comercial, idioma, velocidad), voz por defecto por marca y selector al crear cada video (regla 6). Primeras voces (biblioteca de ElevenLabs, acento argentino):
  - **Carlos Pro** (`gBTPbHzRd0ZmV75Z5Zk4`): comerciales, por ejemplo de Lumus.
  - **Fran** (`0bu1GUsOfNJYyXbmSTxD`): **narrativa por defecto** (la que más convenció al operador, 2026-11-23; además sube el tono en las preguntas). Con **`speed` 1,1**: la voz trae guardado 0,92 y el operador eligió 1,1 de oído entre 0,92, 1,0 y 1,1 (V0-3, 2026-11-24).
- **Velocidad por voz.** ElevenLabs acepta `speed` de 0,7 a 1,2 y genera la voz de nuevo a ese ritmo (no la acelera después, así que respeta las pausas). Se manda junto con los demás ajustes guardados de la voz, leídos de `/v1/voices/{voz}/settings`: si se manda sola, el resto puede volver a los valores por defecto. La velocidad entra en la clave de la caché.
  - **Juan** (`dGjL92Li0y7ZUQ3MESQW`): narrativa alternativa, para relatos.
- **La voz entra por una interfaz `TtsProvider`** (texto + voz → audio + tiempos por palabra). Proveedores: `elevenlabs` (principal) y `kokoro` (local y gratis: inglés con `am_michael` si el operador lo prefiere, y respaldo si se acaban los créditos o ElevenLabs no responde).
- La clave `ELEVENLABS_API_KEY` va en el `.env` (de cada máquina y del servidor), nunca en la base ni en los logs.

**Alternativas.**
- Kokoro y Piper (gratis, locales): descartadas para español por calidad (V0-2).
- Azure (voces `es-AR` Tomás y Elena, 500.000 caracteres/mes gratis) y Google Chirp 3 HD (1 millón gratis, pero solo `es-US`/`es-ES`): quedaron preparadas en `spikes/video-v0/tts/cloud.py` sin probar. Gratis, pero piden tarjeta, Azure da los tiempos por palabra solo con su SDK y Google no los da. El operador eligió ElevenLabs por las voces argentinas de su biblioteca.
- Un plan más grande de ElevenLabs (Creator, USD 22/mes): solo si 30.000 créditos no alcanzan; necesitaría otra decisión.

**Consecuencias.**
- Primer gasto fijo del proyecto: USD 6/mes. La regla 13 sigue valiendo para todo lo demás.
- Generar voz necesita internet y la clave; la caché por escena evita pagar dos veces el mismo texto con la misma voz.
- Sin créditos, el worker tiene que avisar (Telegram) y ofrecer Kokoro, en vez de fallar en silencio.
- Las voces de la biblioteca son de terceros: si su autor la retira de la biblioteca, puede dejar de estar disponible. El catálogo tiene que tolerar una voz que ya no existe (marcarla y pedir otra).
- Lo generado con el plan gratis (antes del 2026-11-23) no se publica.
