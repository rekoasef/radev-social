# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un único operador: Renzo, desarrollador y dueño de las marcas RAdev y Lumus. Usa el panel en dos situaciones:

- **En la compu**: gestionar marcas (identidad visual, assets, documentos, pilares), editar carruseles y configurar la IA.
- **En el celular**: revisar y aprobar o rechazar carruseles, idealmente en menos de un minuto por post, y marcar publicaciones manuales.

Múltiples usuarios y permisos quedan fuera de la v1.

## Product Purpose

RAdev Social es el panel de un sistema que maneja de punta a punta los carruseles de TikTok de varias marcas: la IA propone ideas y escribe el contenido, las slides se dibujan con plantillas en código, y el sistema programa y publica. El trabajo del operador es revisar y aprobar. Éxito: publicar con constancia sin esfuerzo manual, con identidad visual consistente, y saber qué contenido trae clientes (RAdev) y registros (Lumus). Costo objetivo: USD 0 extra por mes.

## Positioning

Herramienta interna, no un producto a la venta. Lo que la distingue de un gestor de redes genérico: las marcas son datos editables (preset de estilo + tokens), la IA solo escribe contenido validado y nunca inventa números, precios ni casos, y todo corre sobre infraestructura gratuita y la suscripción de Claude del operador.

## Operating Context

- Multi-marca: todo cuelga de una marca; el panel tiene un selector de marca siempre presente.
- Flujo de un post: idea → generación → render → revisión → aprobado → programado → publicado (ver `docs/ARCHITECTURE.md` §5).
- Publicación manual al principio (descargar PNGs + copy y subir a TikTok); automática desde la Fase 5.
- Notificaciones por Telegram (Fase 4).

## Capabilities and Constraints

- Stack: Next.js App Router, Tailwind v4, shadcn/ui, Postgres + Drizzle. Server Components por defecto.
- Se construye por fases (`docs/ROADMAP.md`); las secciones de fases futuras existen en la navegación pero no se implementan antes de tiempo.
- La web nunca ejecuta IA ni render: encola trabajos que hace el worker.
- Login con GitHub restringido a una lista blanca de emails.

## Brand Commitments

- Nombre del producto: **RAdev Social**.
- Interfaz en **español rioplatense con voseo**.
- Las identidades de RAdev (preset `bold`, naranja `#FF7A00`) y Lumus (preset `soft`, lavanda `#BDB4FF`) pertenecen a las marcas gestionadas y a sus carruseles; están definidas en `docs/DESIGN-SYSTEM.md`.

## Evidence on Hand

- Referencias de slides de RAdev: `docs/references/radev/`.
- Assets y branding de Lumus: `seeds/brands/lumus/assets/`.
- Métricas reales de TikTok de RAdev en `docs/PRD.md` §4.

## Product Principles

1. Revisar y aprobar tiene que ser rápido y cómodo en el celular.
2. La marca activa siempre es evidente: nunca hay duda de sobre qué marca se está trabajando.
3. Mostrar el estado real del sistema (jobs, errores, límites de IA) en vez de esconderlo.
4. Nada de una marca en el código: todo lo que define a una marca se ve y se edita desde el panel.
