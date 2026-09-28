# 0014 — Cuenta de Oracle en Pay As You Go

**Estado:** aceptada · 2026-09-28 · amplía 0007

**Contexto.** La cuenta gratuita de Oracle no conseguía una ARM `VM.Standard.A1.Flex` en `sa-santiago-1` (un solo availability domain): 35 intentos automáticos en 4 horas, todos "Out of capacity". Según cuentan muchos usuarios (no está documentado por Oracle), las cuentas Pay As You Go tienen prioridad para esas máquinas y no sufren la recuperación de instancias Always Free "ociosas". El operador aceptó en 2026-09-28 hasta USD 6/mes si no quedaba otra, pero lo ideal sigue siendo gratis.

**Decisión.**
- La cuenta pasa a **Pay As You Go** (lo hizo el operador el 2026-09-28). Al cambiar, Oracle retiene USD 100 en la tarjeta para verificarla y los devuelve enseguida (así pasó).
- Se usa **solo lo que entra en Always Free**: una A1.Flex de 2 OCPU / 12 GB (tope gratis 4 / 24), disco de arranque de 100 GB (tope 200), IP pública efímera, la red `radev-vcn`. Costo esperado: USD 0.
- Oracle no tiene tope de gasto duro: se configura un **presupuesto con alerta a USD 1**.

**Alternativas.** Seguir esperando capacidad con la cuenta gratuita (días, sin garantía); máquina propia con Cloudflare Tunnel (tiene que estar siempre prendida); VPS de hasta USD 5.

**Consecuencias.** La máquina salió en el intento 36, minutos después del cambio. A cambio, un error al crear recursos en la consola (otra forma de máquina, balanceador, más disco o backups de volumen) **cobra de verdad**: no se crea nada en Oracle fuera de lo listado sin revisar antes que sea Always Free. La cuenta no puede volver a ser gratuita: la única salida es cerrarla con el soporte de Oracle.
