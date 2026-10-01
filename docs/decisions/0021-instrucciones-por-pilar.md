# 0021 — Instrucciones por pilar para la IA

**Estado:** aceptada · 2026-10-01 · amplía el RF-05

**Contexto.** Un pilar tenía nombre, una descripción de una línea y su porcentaje. Con eso la IA sabía de qué hablar, pero no cómo: qué tipo de gancho le sirve, si el post busca alcance o venta, cómo cerrar ni qué evitar. "Llamado a la acción: servicios, contacto, y promoción de Lumus" no alcanza para escribir un buen post.

**Decisión.**
- Cada pilar suma, todo opcional: **objetivo** (`reach` alcance, `trust` confianza, `sales` venta), **ganchos preferidos** (hasta 4 de `HOOK_TYPES`), **cómo se cuenta** (ángulo, formatos y ejemplos), **cómo cierra** y **qué evitar**. Columnas `goal`, `hook_types`, `guide`, `closing` y `avoid` de `content_pillars` (migración `0024`).
- Van en el `CLAUDE.md` de la marca, debajo de cada pilar: los usan la generación de carruseles y la de ideas.
- Los ganchos son una **preferencia**: si el pedido fija otro gancho, gana el pedido. No se valida en código.
- Se editan en Marcas → Pilares → "Cómo se escribe cada pilar". El seed los trae para RAdev y Lumus.

**Alternativas.** Looks preferidos por pilar: chocan con la rotación de looks que evita repetir (`lookChoices`), se dejan afuera. Escribir todo en la descripción: un solo campo sin estructura, más difícil de mantener y de mostrar.

**Consecuencias.** El prompt de sistema crece unas 100 palabras por pilar. La recomendación de mezcla de la Fase 6 puede usar el objetivo para leer las métricas (alcance por vistas, venta por leads).
