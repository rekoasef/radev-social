# 0020 — Sin series recurrentes

**Estado:** aceptada · 2026-10-01 · quita el RF-12 (Fase 3, T10)

**Contexto.** Las series ("¿Cuánto cuesta realmente…?") eran posts con una estructura fija y slides obligatorias, con su propia pestaña en cada marca. El operador no las usa. La única serie, la de costos de RAdev, exigía una slide `costBreakdown` con rangos copiados de Precios, y RAdev no tiene precios fijos: cada proyecto se cotiza aparte. Sin rangos, cada post de la serie fallaba a propósito.

**Decisión.**
- Se quitan las series del panel (pestaña Marcas → Series, selector en "Generar con IA" y en "Proponer ideas"), del worker, de `core`, `db`, `ai` y del seed.
- Migración `0023_drop_series`: borra la tabla `content_series` y la columna `ideas.series_key`. Las ideas con origen `series` pasan a `ai`. `IDEA_SOURCES` ya no tiene `series`.
- Se mantienen la slide `costBreakdown` y la regla de que sus rangos salen tal cual de Precios (regla 9): sirve para cualquier post, y sin Precios la IA simplemente no la usa.
- Los pedidos y posts viejos que guardaban `seriesKey` en su JSON lo conservan, pero ya no se lee.

**Alternativas.** Dejar el código y no usarlo (más superficie para mantener sin beneficio). Sacar solo el código y dejar la tabla (se pidió limpiar también los datos).

**Consecuencias.** Un tema recurrente se pide como cualquier idea, con su pilar y su tipo de hook. Si alguna vez vuelve a hacer falta una estructura fija, se puede escribir en la voz de la marca. El documento de voz de RAdev en la base todavía describe la serie: hay que sacar esa sección desde el panel (el seed ya no la tiene).
