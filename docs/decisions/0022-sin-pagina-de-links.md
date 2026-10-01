# 0022 — Sin página de links: el perfil lleva directo al sitio de la marca

**Estado:** aceptada · 2026-10-01 · quita el RF-40 y el RF-41 (Fase 6, T5)

**Contexto.** La T5 agregó una página pública por marca (`/l/<marca>`) para el link de la bio de TikTok: preguntaba por qué post venía la visita y abría WhatsApp con el código del post, contando visitas y clics. El operador prefiere que el perfil lleve directo al sitio de la marca (radev.tech): un paso menos para quien llega y una página menos que mantener.

**Decisión.**
- Se quitan la página pública y su redirección (`/l/[brand]`, `/l/[brand]/go`), la pestaña Marcas → Links y el conteo de visitas y clics (Métricas).
- Migración `0025_drop_links_page`: borra `brand_links` y `link_events` (no tenían datos reales; solo visitas de prueba).
- **El registro de leads se queda** (RF-42): Métricas → Leads, con el código del post que nombró quien escribió, y los leads por pilar, gancho y modelo en Métricas. `packages/core/src/leads` y `packages/db/src/queries/leads.ts` (antes `links`).

**Alternativas.** Mantener la página y poner radev.tech como un link más (dos toques en vez de uno para llegar al sitio). Quitar también los leads (se perdía la única forma de saber qué contenido trae clientes).

**Consecuencias.** Los mensajes ya no traen solos el código del post: el operador lo pregunta o lo deduce al anotar el lead. Métricas pierde visitas y clics de la página; conserva leads y clientes.
