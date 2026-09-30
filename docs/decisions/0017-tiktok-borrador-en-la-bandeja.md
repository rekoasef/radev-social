# 0017 — TikTok: borrador en la bandeja como modo definitivo

**Estado:** aceptada · 2026-09-30 · cambia el alcance de la Fase 5 (RF-35)

**Contexto.** El plan de la Fase 5 era publicar en TikTok sin abrir la app: modo borrador (`MEDIA_UPLOAD`) mientras la app estuviera en sandbox y, después de la revisión y la auditoría de TikTok, publicación directa (`DIRECT_POST`). La prueba real (T9, RA-0007) mostró que el borrador ya resuelve casi todo: a la hora programada el carrusel llega solo a la bandeja de la cuenta, con título y descripción cargados, y desde la app se publica **público**. Con la app en sandbox alcanza para hasta 10 cuentas (RAdev, Lumus y alguna más).

**Decisión.** El modo borrador en la bandeja es el modo definitivo. El operador prefiere ver cómo quedó el post en TikTok (slides, título, copy) antes de tocar "Publicar": es el último control, y cuesta un toque. No se hacen, por ahora, la pantalla de publicación según las pautas de UX de TikTok (T7) ni la revisión y auditoría de la app (T10): solo hacen falta para la publicación directa. La app sigue en sandbox.

**Alternativas.** Publicación directa después de la auditoría: sin abrir la app, pero sin ese último control, y con trabajo extra (pantalla de pautas, video de demo, espera de la revisión) y la dependencia de que TikTok la apruebe.

**Consecuencias.** La Fase 5 termina cuando un post aprobado llega solo a la bandeja de TikTok a su horario y los permisos se mantienen vivos (T8). "Publicado" en el panel lo sigue marcando el operador después de publicar desde la app. Si el sandbox deja de alcanzar (más de 10 cuentas, o TikTok cambia sus reglas), se retoman T7 y T10: el adaptador ya distingue el modo (`TikTokPostMode`) y los scopes de publicación directa ya se piden.
