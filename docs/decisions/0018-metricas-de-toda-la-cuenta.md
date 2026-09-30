# 0018 — Métricas de toda la cuenta, no solo de los posts del sistema

**Estado:** aceptada · 2026-09-30 · amplía el modelo de datos de la Fase 6 (RF-38, RF-43)

**Contexto.** ARCHITECTURE colgaba `post_metrics` de `publications`: solo había métricas para los posts que salieron del sistema. La prueba con la Display API en el sandbox (2026-09-30) mostró que `video.list` devuelve **todos** los posts de la cuenta, incluidos los carruseles de fotos y los 62 posts que RAdev publicó antes del sistema. También mostró que, para un borrador publicado desde la bandeja, `status/fetch` devuelve el id público del post, así que se sabe cuál es cada post nuestro. El operador pidió una sección de Métricas "con toda la info".

**Decisión.**
- Tabla nueva `network_posts`: cada post de una cuenta conectada tal como lo muestra la red (id de la red como texto, descripción, link, portada descargada, fecha y últimos conteos). `post_id` lo vincula con nuestro post cuando `metrics.sync` sabe cuál es: por el id público que devuelve TikTok para el borrador, o por el link de TikTok que el operador pegó al marcarlo publicado.
- `post_metrics` cuelga de `network_posts`: una fila por post, fuente y **día** en la zona de la marca; la última lectura del día gana (así el job es idempotente y queda la evolución).
- `audience_snapshots` guarda los totales de la cuenta (seguidores, likes, cantidad de posts) una vez por día y fuente.
- `metrics.sync` corre cada 4 horas (y con "Actualizar ahora"): totales, todos los posts, vínculos y portadas.
- Los ids de TikTok llegan a veces como números JSON de 19 dígitos que `JSON.parse` redondea: se leen del texto crudo (`postIdsFrom`).

**Alternativas.** Solo los posts del sistema (como decía ARCHITECTURE): más simple, pero el tablero arranca casi vacío y no compara con el historial de la cuenta ni permite aprender de los posts viejos que funcionaron (RF-37).

**Consecuencias.** La sección Métricas compara lo del sistema con el resto de la cuenta. "Publicado" en el panel lo sigue marcando el operador (ADR 0017); el vínculo con TikTok no cambia el estado del post. Guardados, visitas al perfil y audiencia no vienen por API: quedan para las capturas (RF-39) con `source = screenshot`.
