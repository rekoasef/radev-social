# 0011 — 4:5 como formato único de la v1

**Estado:** aceptada · 2026-09-23 · amplía 0010

**Contexto.** 0010 fijaba 9:16 como formato principal. Pero las referencias de RAdev son 4:5 y el operador ya publica en TikTok en 4:5. Una captura real (post de RAdev, 42K vistas) muestra que TikTok ajusta la imagen 4:5 al ancho, sin recortarla, y la completa con negro arriba y abajo. Con fondos oscuros no se nota. Mantener dos formatos obliga a diseñar, renderizar y controlar cada plantilla dos veces.

**Decisión.** La v1 renderiza **solo 4:5 (1080×1350)**, tanto para TikTok como para Instagram cuando se sume. Las zonas seguras del 4:5 contemplan la interfaz de TikTok encima de la imagen (ver `DESIGN-SYSTEM.md` §3). El campo `format` de `assets` se mantiene para poder agregar otros formatos después.

**Alternativas.** 9:16 como principal (plan original): más superficie en TikTok, pero duplica el trabajo de diseño y QA, y aleja el render de las referencias. 9:16 + 4:5: el doble de renders y dos calibraciones de zonas seguras.

**Consecuencias.** Un solo `SlideFrame`, una sola calibración y la mitad de los renders. Instagram después no requiere cambios de diseño. En la Fase 5 hay que verificar que la Content Posting API de TikTok acepte 4:5 en modo foto. Si no lo acepta, se agrega 9:16 como formato derivado (el 4:5 centrado sobre el fondo de la marca), sin rediseñar plantillas.
