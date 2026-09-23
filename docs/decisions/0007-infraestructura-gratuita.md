# 0007 — Infraestructura de costo cero

**Estado:** aceptada · 2026-09 · reemplaza la parte de hosting de 0001

**Contexto.** El objetivo es gastar USD 0 extra por mes. Una VPS de 4 GB cuesta alrededor de USD 24/mes. Las fases 0 a 3 no necesitan nada encendido las 24 horas.

**Decisión.**
- Fases 0 a 3: todo local (WSL + Docker Desktop), publicación manual.
- Producción (Fase 4), en orden: Oracle Cloud Always Free (ARM, 2 OCPU / 12 GB); máquina propia con Cloudflare Tunnel; VPS de hasta USD 5.
- Dominios: subdominios de `gestorlumus.site` (ya pago).
- Backups: capa gratuita de R2 o B2.
- Todo multi-arquitectura (`amd64`/`arm64`).

**Alternativas.** DigitalOcean (~USD 24/mes); Vercel + Supabase (límites serverless y servicios extra).

**Consecuencias.** Costo cero, a cambio de menos garantías: Oracle puede no tener capacidad o cambiar condiciones (ya lo hizo en 2026). Se mitiga con Docker Compose portable y backups externos: mudar de servidor lleva una tarde.
