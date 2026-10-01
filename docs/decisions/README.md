# Decisiones de arquitectura (ADR)

Registro corto de decisiones importantes y su porqué. Formato: contexto, decisión, alternativas, consecuencias. Para cambiar una decisión se escribe un ADR nuevo que la reemplaza o amplía (no se edita la historia, solo el estado).

| # | Decisión | Estado |
|---|---|---|
| 0001 | Todo en una VPS con Docker Compose | reemplazada parcialmente por 0007 |
| 0002 | Postgres como base y como cola (pg-boss) | aceptada |
| 0003 | Better Auth en lugar de NextAuth | aceptada |
| 0004 | Slides con plantillas en código, no con generación de imágenes | aceptada (ampliada por 0008, 0013, 0015 y 0016) |
| 0005 | Generación con Claude Code headless, aislada del repo | ampliada por 0009 (modo liviano: 2026-09-29) |
| 0006 | Multi-marca desde el día uno | ampliada por 0008 |
| 0007 | Infraestructura de costo cero | aceptada |
| 0008 | Marcas como datos, estilos como presets | aceptada (ampliada por 0015) |
| 0009 | Claude con suscripción + proveedores intercambiables | aceptada |
| 0010 | Solo TikTok en la v1 | aceptada (formato ampliado por 0011) |
| 0011 | 4:5 como formato único de la v1 | aceptada |
| 0012 | Archivos de media en una carpeta, servidos por la web | aceptada |
| 0013 | Ajustes a mano por arrastre, dentro de las plantillas | aceptada |
| 0014 | Cuenta de Oracle en Pay As You Go | aceptada |
| 0015 | Looks por post (preset `studio`) | aceptada (ampliada por 0016) |
| 0016 | Imágenes generadas con IA en portada y cierre | aceptada |
| 0017 | TikTok: borrador en la bandeja como modo definitivo | aceptada |
| 0018 | Métricas de toda la cuenta, no solo de los posts del sistema | aceptada |
| 0019 | SSH con contraseña además de llave, con fail2ban | aceptada |
