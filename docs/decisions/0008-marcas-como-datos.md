# 0008 — Marcas como datos, estilos como presets

**Estado:** aceptada · 2026-09 · amplía 0004 y 0006

**Contexto.** El operador quiere crear, editar y eliminar marcas y cambiar su branding desde el panel, sin código. Pero las marcas no difieren solo en colores: RAdev y Lumus tienen personalidades visuales distintas (mayúsculas vs. oración, bordes luminosos vs. vidrio, decoraciones distintas).

**Decisión.** Separar personalidad y valores:
- **Presets de estilo** en código (`bold`, `soft`), cada uno con un schema Zod de tokens configurables.
- **Todo lo demás es dato** editable en el panel: preset elegido, tokens, assets, voz, precios, casos, reglas, pilares, slots, contacto, topes de IA.
- Los archivos de `seeds/brands/` solo cargan los datos iniciales.
- Marcas y pilares con historial se archivan; el borrado definitivo solo sin posts.

**Consecuencias.** Marca nueva sin código. Un estilo visual realmente nuevo requiere programar un preset, que queda disponible para todas las marcas. El CLAUDE.md de contenido se genera desde la base en cada ejecución.
