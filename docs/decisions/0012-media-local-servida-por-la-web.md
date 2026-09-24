# 0012 — Archivos de media en una carpeta, servidos por la web

**Estado:** aceptada · 2026-09-24

**Contexto.** La T7 de la Fase 1 suma `brand_assets`: logos y elementos gráficos que el operador sube desde el panel y que las plantillas cargan al renderizar. Hacía falta decidir dónde viven los archivos, cómo llegan al navegador y a las páginas `/render`, y qué se acepta. La arquitectura ya preveía `MEDIA_DIR` y el subdominio `media.` en producción, pero no el caso local.

**Decisión.**
- Los archivos viven en `MEDIA_DIR` y la base guarda rutas **relativas** a esa carpeta (`<marca>/brand/<uuid>.<ext>`). Nunca se usa el nombre original.
- En local, `MEDIA_DIR` es `./media` en la raíz del repo, tanto para `pnpm dev` como para Docker (montada en `/data/media`). Los dos comparten la base, así que tienen que compartir los archivos a los que apunta.
- La web los sirve en `/media/...`: ruta pública, de solo lectura, que rechaza cualquier ruta fuera de `MEDIA_DIR`. Los nombres son imposibles de adivinar, así que es equivalente al subdominio público de producción. Reemplazar un archivo le da una ruta nueva y conserva el id, así que se puede cachear para siempre.
- Se aceptan PNG, JPEG, WebP y SVG de hasta 5 MB. El tipo sale del contenido del archivo, no de la extensión. Los SVG no se reescriben: se sirven con `Content-Security-Policy: sandbox` y las páginas los cargan con `<img>`, donde los scripts no corren.
- No se puede borrar un asset que los tokens de la marca estén usando.

**Alternativas.** Volumen de Docker separado: la base compartida quedaría apuntando a archivos que el otro entorno no tiene. Guardar los archivos en Postgres: la base crece con binarios y el backup pesa más. Almacenamiento externo (R2/B2): innecesario en local y suma una cuenta. Sanitizar los SVG con una librería: más código y dependencias, cuando las dos barreras de arriba ya cubren el uso actual.

**Consecuencias.** Los archivos subidos no viajan con el repo ni con la base: en otra máquina el seed recrea los de las marcas iniciales, y lo subido desde el panel se pierde salvo que se copie `media/`. En la Fase 4 se decide si Caddy sirve `media.` directo desde el volumen o sigue pasando por la web, y el backup tiene que incluir la carpeta. Si alguna plantilla llega a insertar un SVG como código (no como `<img>`), antes hay que sanitizarlo.
