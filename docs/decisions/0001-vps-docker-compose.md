# 0001 — Todo en una VPS con Docker Compose

**Estado:** reemplazada parcialmente por 0007 (dónde se hospeda) · 2026-09

**Contexto.** El sistema necesita procesos largos (`claude -p` puede tardar minutos), un Chromium real para renderizar y un dominio propio que sirva imágenes públicas (TikTok exige un dominio verificado). Es un proyecto de una sola persona.

**Decisión.** Una VPS con Docker Compose: Caddy, web, worker, Postgres y backup.

**Alternativas.** Vercel + Supabase + worker aparte: más servicios, límites de funciones serverless, costos variables y el dominio de media igual había que resolverlo.

**Consecuencias.** Costo fijo y predecible, todo en un lugar. A cambio, me hago cargo de backups, actualizaciones y seguridad de la VPS (tareas en Fase 0).
