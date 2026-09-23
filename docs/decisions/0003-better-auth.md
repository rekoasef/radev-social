# 0003 — Better Auth en lugar de NextAuth

**Estado:** aceptada · 2026-09

**Contexto.** Hace falta login para un único operador. NextAuth/Auth.js pasó a ser mantenido por el equipo de Better Auth, que recomienda Better Auth para proyectos nuevos.

**Decisión.** Better Auth con OAuth, sesiones en Postgres (adaptador Drizzle) y lista blanca de emails.

**Consecuencias.** Auth moderna y mantenida, integrada con la misma base. Cualquier email fuera de `ALLOWED_EMAILS` se rechaza.
