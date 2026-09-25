# PRD — RAdev Social

## 1. Visión

Un sistema que se encarga de las redes sociales de mis marcas de punta a punta: piensa qué publicar, escribe el copy, diseña los carruseles con la identidad de cada marca, los programa en el mejor horario y los publica. Mi único trabajo es revisar y aprobar, idealmente desde el celular en menos de un minuto por post. Y todo **sin costo extra**: infraestructura gratuita y la suscripción de Claude que ya pago.

## 2. Problema

- Publicar con constancia me cuesta: no tengo ganas de armar y subir contenido todos los días, y cuando dejo de publicar, el alcance cae.
- Hoy diseño los carruseles con ChatGPT: el resultado es inconsistente (colores y tipografías que varían, errores en el texto) y lleva tiempo.
- Tengo alcance pero no conversión: la gente ve mi contenido pero casi no entra al perfil ni me escribe (ver §4).
- No sé qué contenido me trae clientes; solo veo reproducciones y likes.

## 3. Usuario

Un único operador: yo (Renzo, desarrollador, dueño de RAdev y de Lumus). Login con GitHub y lista blanca de un email. Todo el modelo de datos cuelga de una **marca**, gestionable desde el panel, para sumar marcas (propias o de clientes) sin tocar código. Múltiples usuarios con permisos quedan para después.

## 4. Estado actual (TikTok de RAdev, al 21/09/2026)

- Actividad real desde mediados de 2026. Últimos 365 días: 190.4K reproducciones, 141.9K espectadores (82.2K nuevos), 8.6K likes, 1K compartidos.
- **Cuello de botella**: 1.1K visitas al perfil (≈0.6% de las reproducciones) y 67 comentarios. El contenido se consume pero no convierte.
- Audiencia: 86% hombres, mayormente del mundo tech. Países: Argentina, México, Perú, Colombia, Chile, Ecuador, Bolivia, España y Honduras.
- Horarios activos: meseta de 14 a 21 h (hora argentina), pico lunes 15-16 h.
- **El formato ganador es el carrusel**: el top 10 son casi todos carruseles; el video con cara está entre los últimos.
- Top posts: "¿Cuánto cuesta realmente tener una app?" (40K), "Automatizá con IA y n8n" (20K), "No publiques tu app sin hacer esto" (17K), "Comprar un dominio... leé esto antes" (15K), "Firebase vs Supabase" (15K), "¿Cuánto vale realmente una automatización?" (11K).
- Patrón: **plata/costos** y hooks de **advertencia** rinden consistentemente; las comparativas son irregulares.

## 5. Marcas iniciales

Se cargan con el seed desde `seeds/brands/` y después se editan desde el panel.

### RAdev
Mi marca de desarrollo. Vendo sistemas internos, automatizaciones, integraciones, dashboards, webs con funciones específicas y apps a negocios y emprendimientos de **toda Latinoamérica** (y España).
- **Objetivo**: que me escriban potenciales clientes **por WhatsApp**. Métricas clave: clics a WhatsApp, leads atribuidos a posts, visitas al perfil, comentarios.
- **Público objetivo**: dueños de negocios y emprendedores hispanohablantes. El público tech actual se mantiene vía build in public y programación explicada.
- **Casos reales publicables**: Lumus, landing para estudio de abogadas, sistema interno para estudio contable, portfolio para fotógrafa, catálogo de tecnología (celulares y computadoras).
- **Rol de Lumus en RAdev**: caso de estudio y build in public; empuja seguidores a la cuenta de Lumus.

### Lumus
Mi SaaS B2C: gestor de gastos con IA hecho para Argentina (gestorlumus.site). $7.800/mes con 30 días gratis sin tarjeta.
- **Objetivo**: registros a la prueba gratis.
- **Público objetivo**: argentinos que quieren ordenar su plata. Masivo, no tech. **Solo Argentina.**
- **Cuenta propia de TikTok** (a crear).
- **Regla de oro**: nunca recomendar inversiones ni dar asesoramiento financiero.

## 6. Requerimientos funcionales

Cada requerimiento indica la fase del roadmap en la que se implementa.

### Marcas (todo gestionable desde el panel)
- **RF-01** (F1) CRUD de marcas: crear, editar y archivar. Borrado definitivo solo si la marca no tiene posts.
- **RF-02** (F1) Identidad visual por marca: elegir un preset de estilo y editar sus tokens (colores, tipografías de una lista curada, radios, textos de encabezado y pie, wordmark) con vista previa en vivo.
- **RF-03** (F1) Assets por marca: subir, reemplazar y borrar logos y elementos gráficos (ej. el orbe de Lumus).
- **RF-04** (F3) Documentos de marca editables: voz (guía para la IA), precios, casos y reglas duras. Con historial de versiones.
- **RF-05** (F3) Pilares de contenido por marca con porcentaje objetivo (CRUD; archivar si tienen posts).
- **RF-06** (F4) Slots de publicación por marca (día + hora local).
- **RF-07** (F3) Datos de contacto por marca (WhatsApp) para los llamados a la acción.
- **RF-08** (F0) Login con GitHub solo para emails en lista blanca.

### Ideas
- **RF-09** (F3) Banco de ideas por marca: cargar ideas manualmente en segundos (desde el celular).
- **RF-10** (F3) Generación de ideas con IA a partir de pilares, series e historial (modelo gratuito por defecto).
- **RF-11** (F3) Investigación semanal de temas del nicho con búsqueda web (Claude).
- **RF-12** (F3) Series recurrentes (ej. "¿Cuánto cuesta realmente...?") con estructura fija.
- **RF-13** (F3) Reciclado: nuevos ángulos de posts anteriores con buen rendimiento.

### Carruseles
- **RF-14** (F2) Crear y editar carruseles manualmente con vista previa en vivo.
- **RF-15** (F3) Generar un carrusel completo con IA a partir de una idea: slides, copy, hashtags, pilar y tipo de hook.
- **RF-16** (F3) Rechazar con feedback escrito y regenerar usando ese feedback.
- **RF-17** (F2) Versionado: cada generación o edición crea una versión; se puede volver a cualquiera.
- **RF-18** (F2) Etiquetar cada post con pilar y tipo de hook.
- **RF-19** (F2) Código público corto por post (ej. `RA-0142`) para atribuir leads.
- **RF-20** (F3) Contenido basado en datos para Lumus (cotización del dólar vía Bluelytics): la IA escribe alrededor de números provistos por el código.

### IA
- **RF-21** (F3) Proveedores de IA intercambiables: Claude Code (suscripción del operador) y OpenRouter (modelos gratuitos).
- **RF-22** (F3) Ruteo por tarea configurable desde el panel: proveedor y modelo principal, y respaldo.
- **RF-23** (F3) Si un proveedor alcanza su límite de uso, el job usa el respaldo o se reprograma para cuando se renueve el límite, y avisa si compromete un post programado.
- **RF-24** (F3) Registro de cada generación: proveedor, modelo, duración, uso, costo si aplica.
- **RF-25** (F3) Topes de uso por marca (cantidad de generaciones por día y por mes).
- **RF-26** (F4) Ventana horaria de generación automática (por defecto de madrugada, para no competir con el uso del operador).

### Render
- **RF-27** (F1) Renderizar cada slide en 1080×1350 (4:5, formato único para TikTok e Instagram, ADR 0011) con el tema de la marca.
- **RF-28** (F2) Control de calidad automático post-render: texto desbordado o contenido fuera de la zona segura invalida el render; si viene de IA, se regenera (máx. 2 veces).
- **RF-29** (F2) Descargar el carrusel (PNGs + copy) para publicar manualmente.

### Calendario y revisión
- **RF-30** (F4) Calendario por marca; mover posts entre slots.
- **RF-31** (F4) Llenado automático de slots vacíos respetando la mezcla de pilares.
- **RF-32** (F4) Cola de revisión usable en celular: ver, editar, aprobar o rechazar.
- **RF-33** (F4) Notificaciones por Telegram: posts para revisar, recordatorio de publicación manual, errores, límites de IA.

### Publicación
- **RF-34** (F2) Adaptador manual: a la hora programada avisa y deja todo listo; se marca como publicado con un toque.
- **RF-35** (F5) Publicación automática en TikTok (modo foto) una vez aprobada la auditoría; antes, modo borrador en la bandeja de TikTok.
- **RF-36** (F5) Conectar cuentas de TikTok por marca (OAuth), con renovación de tokens.

### Medición y aprendizaje
- **RF-37** (F6, pospuesto desde F3: no hay historial con métricas) Usar los posts con mejores métricas como ejemplos para la generación.
- **RF-38** (F6) Sincronizar métricas por post desde la API de TikTok.
- **RF-39** (F6) Cargar capturas de analíticas y extraer datos con IA.
- **RF-40** (F6) Página de links propia por marca con seguimiento de clics.
- **RF-41** (F6) Botón de WhatsApp con mensaje precargado que incluye el código del post (`RA-0142`) para atribuir cada lead.
- **RF-42** (F6) Registro de leads (manual rápido o a partir del código recibido).
- **RF-43** (F6) Tablero por pilar, tipo de hook, horario, proveedor/modelo de IA; recomendaciones de horarios y mezcla.

## 7. Requerimientos no funcionales

- **Costo**: USD 0 extra por mes. Infraestructura gratuita; IA con la suscripción Pro existente y modelos gratuitos.
- **Confiabilidad**: jobs idempotentes y con reintentos; nunca publicar doble ni sin aprobación.
- **Calidad visual**: render determinista y fiel al preset y a los tokens de la marca.
- **Rendimiento**: un carrusel de 8 slides en ambos formatos se renderiza en menos de 60 segundos.
- **Seguridad**: HTTPS, login con lista blanca, tokens cifrados, `/render` inaccesible desde internet, Postgres no expuesto.
- **Resguardo**: backup diario de Postgres y de los assets fuera del servidor (capa gratuita de R2 o B2); retención mínima de 14 días.
- **Portabilidad**: todo en Docker Compose, compatible con `amd64` y `arm64`; mudar de servidor lleva una tarde.
- **Observabilidad**: logs estructurados; vista de jobs en el panel.
- **Mobile first en revisión**: aprobar un post desde el celular en menos de un minuto.
- **Idioma**: interfaz en español rioplatense.

## 8. Alcance

### Dentro de la v1
Todo lo listado en §6 (fases 0 a 6): marcas gestionables, RAdev y Lumus, **solo TikTok**, solo carruseles.

### Fuera de la v1
- Instagram (el formato ya es 4:5; se suma después).
- LinkedIn y otras redes.
- Video de cualquier tipo.
- Generación de imágenes con IA: las slides se construyen con plantillas; nunca fotos ni personas.
- Tipo de slide `code`.
- Presets de estilo adicionales a `bold` y `soft` (se agregan con código cuando haga falta).
- Múltiples usuarios y permisos.
- Responder comentarios o mensajes automáticamente.
- Publicidad paga.

## 9. Restricciones conocidas

- **TikTok**: sin auditoría aprobada, la API solo publica en privado; hay que cumplir sus pautas de UX (vista previa, edición del texto, consentimiento explícito). Las imágenes deben servirse desde un dominio verificado. Límite aproximado de publicaciones diarias por cuenta.
- **Claude Pro**: límites de uso por ventana de tiempo, compartidos con el uso del operador para desarrollar.
- **Modelos gratuitos**: la oferta rota y puede usar los prompts para entrenamiento (aceptable: el contenido es público). Nunca se les envían datos privados.
- **Oracle Free**: capacidad no garantizada, ARM, y Oracle cambió los límites sin aviso en 2026.
- **Métricas de audiencia** probablemente no disponibles por API: se cubren con capturas (RF-39).

## 10. Riesgos

- **Contenido genérico**: mitigación: voz de marca con ejemplos ganadores, feedback de rechazo, medición por pilar/hook/modelo.
- **Casos o precios inventados**: mitigación: los documentos de precios y casos de la marca son la única fuente.
- **Mencionar proyectos confidenciales** (trabajo en relación de dependencia): regla dura en la voz de RAdev.
- **Asesoramiento financiero en Lumus**: regla dura y chequeo en revisión.
- **Límites de Claude**: generación nocturna, modelo por tarea, respaldo con modelos gratuitos.
- **Fatiga de revisión**: arrancar con 1 post/día por marca.
- **Pérdida del servidor gratuito**: backups externos + portabilidad (plan B: máquina propia con Cloudflare Tunnel o VPS de hasta USD 5).

## 11. Preguntas abiertas

- Dónde apuntan los nameservers de `gestorlumus.site` (Hostinger o Vercel), para crear `app.` y `media.`.
- Usuario de TikTok de Lumus.
- Número de WhatsApp de RAdev para los CTA.
- Contenido de `seeds/brands/radev/pricing.md` y detalle de cada caso en `cases.md` (y permiso para nombrar a cada cliente).
- Validar la propuesta de pilares de Lumus.
