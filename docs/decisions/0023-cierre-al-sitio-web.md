# 0023 — El cierre de los posts puede mandar al sitio web de la marca

**Estado:** aceptada · 2026-10-01 · amplía el RF-07

**Contexto.** El cierre (`cta`) de los carruseles invitaba a escribir por WhatsApp cuando la marca tenía número. Con la página de links quitada (ADR 0022), el operador quiere que los posts de RAdev manden a su sitio, radev.tech, que también es el link del perfil.

**Decisión.**
- Campo nuevo de la marca, **Sitio web** (`brands.website`, migración `0026`), en Marcas → General → Contacto. Se guarda como se muestra: sin protocolo ni barra final (`normalizeWebsite`, `packages/core`).
- Destino del cierre (`ctaTarget`): el **sitio gana** sobre WhatsApp; sin sitio, WhatsApp; sin ninguno, el post cierra sin invitar a un canal.
- Con sitio, la sección Contacto del `CLAUDE.md` de la marca pide que el botón nombre el sitio ("Entrá a radev.tech"), que el caption invite a entrar desde el link del perfil, y aclara que manda sobre cualquier otro canal que nombre la voz.
- Datos de RAdev: sitio `radev.tech`, la voz y los cierres de los pilares "Hecho por RAdev" y "Llamado a la acción" hablan del sitio.

**Alternativas.** Un selector "WhatsApp o sitio" además del campo: un control más para el mismo resultado. Escribirlo solo en la voz: depende de que la IA lo respete, sin una regla de la marca que lo sostenga.

**Consecuencias.** WhatsApp queda para las marcas sin sitio. Lumus no cambia (no tiene WhatsApp ni sitio cargados: sus cierres siguen los de sus pilares).
