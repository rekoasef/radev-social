# 0013 — Ajustes a mano por arrastre, dentro de las plantillas

**Estado:** aceptada · 2026-09-24 · amplía 0004

**Contexto.** Con las plantillas en código (0004), el operador edita el contenido, pero no dónde queda cada cosa. Al usar el editor pidió poder corregir detalles como centrar el título o mover el orbe, arrastrando como en Canva. Un editor libre tipo Canva rompe lo que 0004 garantiza: identidad consistente, la IA generando posts listos para aprobar y el control automático de zonas seguras.

**Decisión.**
- Cada slide tiene un campo opcional `layout` con ajustes de hasta tres **capas**: título, contenido (el resto, como un bloque: tarjetas, diagramas y conectores no se desarman) y elemento gráfico de la marca. Guarda corrimientos en píxeles de slide y un tamaño para el título (0,6–1,5, agranda la letra y reacomoda las líneas) y para el elemento gráfico (0,4–2). Vacío es la disposición de la plantilla; la IA lo deja vacío.
- Las plantillas dibujan cada capa donde la ponen y le aplican el ajuste con `transform`, así mover una no corre a las otras. El render final usa el mismo campo: el PNG es lo que se ve en el editor.
- En el editor se arrastra sobre la vista previa, con guías que imantan al centro y a los márgenes seguros, límite en el área segura, esquinas para el tamaño del elemento gráfico, botones para el del título, flechas para el ajuste fino y "Restablecer".
- El control del render sigue valiendo sobre lo movido (zona segura, botones de TikTok, desbordes) y hace fallar el render como siempre. Que dos capas queden encimadas es solo un aviso del editor: nunca hace fallar el render, porque el operador ve el resultado y la medición es aproximada.

**Alternativas.** Editor libre tipo Canva: casi otra aplicación, rompe la consistencia y la generación con IA. Solo controles (alineación, deslizadores): más simple, pero el operador pidió arrastrar. Mover cada pieza por separado (cada tarjeta): rompe el orden y los conectores que calcula la plantilla.

**Consecuencias.** Las posiciones viven en la versión del post: versionar y restaurar también las incluye. Un ajuste se guarda como corrimiento desde la posición de la plantilla, así que si cambia el texto la capa sigue corrida lo mismo, no queda fija en la misma coordenada. Una plantilla nueva tiene que envolver sus partes en `Layer` (lo hace sola si usa `TemplateLayout`) y un test lo exige.
