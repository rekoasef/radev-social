# 0006 — Multi-marca desde el día uno

**Estado:** ampliada por 0008 · 2026-09

**Contexto.** Hay dos marcas (RAdev y Lumus) con públicos, voces, identidades y objetivos distintos, y a futuro podría haber marcas de clientes.

**Decisión.** Todo el modelo de datos cuelga de `brands`. Cada marca tiene tema visual, pilares, slots, cuentas, presupuesto de IA y su propio `content-workspace`.

**Consecuencias.** Sumar una marca es configuración + un tema + un CLAUDE.md de contenido. La interfaz de la v1 es de un solo operador; permisos por marca quedan fuera de alcance.
