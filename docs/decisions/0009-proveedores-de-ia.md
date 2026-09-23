# 0009 — Claude con suscripción + proveedores intercambiables

**Estado:** aceptada · 2026-09 · amplía 0005

**Contexto.** La API de Claude costaría USD 15–60/mes. El operador tiene Claude Pro. Claude Code permite autenticarse en scripts con un token de larga duración (`claude setup-token` → `CLAUDE_CODE_OAUTH_TOKEN`) que consume de la suscripción. Pero Pro tiene límites por ventana, compartidos con el uso del operador para desarrollar. Existen modelos gratuitos vía OpenRouter (oferta rotativa; pueden usar los prompts para entrenamiento).

**Decisión.**
- `claude -p` autenticado con la suscripción (API key solo como alternativa; nunca ambas).
- Paquete `packages/ai` con proveedores intercambiables (`claude-code`, `openrouter`) y ruteo por tarea configurable con respaldo.
- Claude para lo que requiere calidad (carruseles, investigación, lectura de capturas); modelos gratuitos para volumen (ideas, variantes).
- Límites: respaldo o reprogramación ante `rate_limited`; topes por marca; generación automática en ventana nocturna.
- A los modelos gratuitos solo se les envía contenido destinado a ser público.

**Consecuencias.** Costo de IA en cero. La calidad puede variar por modelo: cada versión registra proveedor y modelo para compararlos en métricas.
