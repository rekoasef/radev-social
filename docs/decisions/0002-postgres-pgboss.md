# 0002 — Postgres como base y como cola (pg-boss)

**Estado:** aceptada · 2026-09

**Contexto.** Web y worker necesitan comunicarse y hay trabajos programados (publicar el jueves a las 19), con reintentos.

**Decisión.** Postgres con Drizzle para los datos y pg-boss para la cola, sobre la misma base. La web encola; el worker ejecuta. Sin llamadas HTTP de web a worker.

**Alternativas.** Redis + BullMQ (un servicio más que mantener); llamadas HTTP directas (acopla procesos, se pierden trabajos si el worker está caído).

**Consecuencias.** Una sola cosa que respaldar y monitorear. pg-boss cubre jobs diferidos, cron, reintentos y singleton keys para idempotencia.
