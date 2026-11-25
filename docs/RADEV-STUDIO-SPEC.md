# RAdev Studio — Especificación funcional y arquitectónica

> **⚠ Documento histórico (2026-11-25).** Es la especificación original (v0.1, 2026-11-20), anterior a V0. Cambió: el formato del video es **documental** (imágenes de archivo + gráficos + voz de ElevenLabs), no escenas de plantilla ni personajes; la investigación y la verificación de hechos **entran en V1**; el render es del video **entero** en dos formatos (Short 9:16 y normal 16:9); la voz es de ElevenLabs (ADR 0027), no local; la producción es una **línea de oficinas** (no un Director IA con modos automático y colaborativo). Lo vigente de V1 está en `docs/RADEV-STUDIO-REVISION.md` §7, `docs/decisions/0029-video-documental-y-oficinas.md` y `docs/ARCHITECTURE.md` §14.

**Versión:** 0.1  
**Fecha:** 20 de noviembre de 2026  
**Estado:** Documento de definición y planificación. No autoriza implementación automática.  
**Proyecto de origen:** RAdev Social  
**Nuevo producto:** RAdev Studio  
**Nuevo módulo:** Video Studio

> Análisis técnico de esta especificación contra el repositorio: `docs/RADEV-STUDIO-ANALISIS.md`.

---

# 1. Visión del producto

## 1.1. Objetivo

Evolucionar RAdev Social hacia RAdev Studio, una plataforma de producción de contenido audiovisual asistida por IA.

El objetivo principal es que el usuario pueda crear videos profesionales a partir de una idea, una temática o recursos propios, sin necesitar conocimientos avanzados de edición audiovisual.

La plataforma debe poder:

- Investigar y desarrollar ideas.
- Crear guiones.
- Diseñar storyboards.
- Elegir estilos visuales.
- Crear personajes y escenarios.
- Generar animaciones y clips.
- Crear narraciones y efectos de audio.
- Editar y componer escenas.
- Renderizar videos terminados.
- Permitir modificar escenas individualmente.
- Preparar contenido para diferentes plataformas.

**La plataforma debe ser genérica y adaptable a cualquier nicho.**

Ejemplos de temáticas posibles:
- Videojuegos.
- Historia.
- Ciencia.
- Tecnología.
- Educación.
- Entretenimiento.
- Curiosidades.
- Finanzas.
- Documentales.
- Marketing.
- Contenido empresarial.

GTA VI fue solamente un ejemplo inicial para visualizar el tipo de contenido. No debe existir ningún acoplamiento del producto a videojuegos ni a una temática particular.

## 1.2. Principio principal

RAdev Studio no debe ser simplemente un generador de videos a partir de imágenes.

Debe ser un estudio de producción audiovisual donde la IA pueda decidir cómo representar visualmente cada parte del contenido.

Queremos poder producir:
- Animaciones 2D.
- Animaciones 3D.
- Motion graphics.
- Videos generados mediante modelos de IA.
- Producciones híbridas que combinen las cuatro alternativas.

La IA debe elegir la técnica más conveniente para cada escena, teniendo en cuenta calidad, coherencia visual, capacidades técnicas y costo.

---

# 2. Estructura general del producto

RAdev Studio tendrá dos módulos principales.

## 2.1. Social Studio

Es la evolución del producto actual RAdev Social.

Debe conservar:
- Carruseles.
- Generación de imágenes.
- Publicaciones.
- Calendario.
- Marcas.
- Ideas.
- Métricas.
- Integraciones sociales.
- Funcionalidades actuales.

No se debe romper ni reescribir innecesariamente.

## 2.2. Video Studio

Será el nuevo módulo de producción audiovisual.

Responsabilidades:
- Crear proyectos de video.
- Generar guiones.
- Crear storyboards.
- Planificar escenas.
- Seleccionar motores visuales.
- Gestionar personajes y recursos.
- Generar voces.
- Componer y renderizar.
- Editar escenas.
- Aprobar y exportar videos.
- Preparar publicaciones.

Los dos módulos deben compartir infraestructura, autenticación, marcas, almacenamiento y servicios comunes, pero mantener separados sus dominios y ciclos de vida.

---

# 3. Experiencia funcional de Video Studio

## 3.1. Dashboard

El usuario debe encontrar:
- Proyectos en producción.
- Videos terminados.
- Videos pendientes de revisión.
- Proyectos pausados.
- Historial de producciones.
- Presupuestos y consumo.
- Acceso a crear un nuevo video.

## 3.2. Creación de proyectos

El usuario puede comenzar de dos maneras:

**A. Desde una idea**

Escribe una temática o instrucción.

Ejemplo:
"Quiero un video de 60 segundos que explique cómo funciona la inteligencia artificial".

La IA debe investigar, desarrollar la propuesta y planificar la producción.

**B. Desde recursos propios**

El usuario puede proporcionar:
- Imágenes.
- Videos.
- Logos.
- Audios.
- Personajes de referencia.
- Fotografías.
- Documentos.
- Material audiovisual propio.

Estos recursos deben incorporarse a la producción y quedar asociados al proyecto.

La carga de recursos es opcional.

## 3.3. Configuración del video

El usuario puede definir:
- Formato vertical u horizontal.
- Duración deseada o automática.
- Idioma del contenido.
- Temática.
- Marca asociada.
- Estilo visual preferido.
- Presupuesto máximo.
- Modo de producción.

La IA debe poder recomendar configuraciones cuando el usuario no especifique todos los parámetros.

---

# 4. Modos de producción

Deben existir dos modalidades principales.

## 4.1. Modo automático

El usuario entrega una idea y el Director IA se encarga de:

1. Investigar.
2. Definir el enfoque.
3. Crear el guion.
4. Seleccionar los estilos visuales.
5. Crear el storyboard.
6. Seleccionar los motores de producción.
7. Generar los recursos.
8. Producir las escenas.
9. Componer el video.
10. Presentar el resultado para revisión.

El usuario no necesita intervenir durante cada etapa.

No obstante, debe poder configurar límites de gasto y permisos.

## 4.2. Modo colaborativo

El usuario participa durante la producción.

Puede:
- Revisar y modificar el guion.
- Aprobar el storyboard.
- Modificar escenas.
- Cambiar personajes.
- Reemplazar clips.
- Modificar narraciones.
- Cambiar estilos visuales.
- Aprobar o rechazar resultados.
- Solicitar regeneraciones.

El usuario debe poder intervenir sin perder el trabajo realizado.

## 4.3. Elección automática del modo

En el futuro, la plataforma podrá recomendar el modo según la complejidad del proyecto.

Ejemplo:
- Video sencillo: producción automática.
- Video narrativo complejo: producción colaborativa.

La decisión final siempre pertenece al usuario.

---

# 5. Director IA

El Director IA es el componente central de Video Studio.

No debe ser un único prompt gigante que intente producir un video completo.

Debe funcionar como un orquestador de tareas independientes.

## 5.1. Responsabilidades

- Comprender el objetivo del video.
- Investigar el contenido.
- Identificar datos que necesitan verificación.
- Definir el enfoque narrativo.
- Escribir el guion.
- Dividir el contenido en escenas.
- Seleccionar estilos visuales.
- Elegir motores de generación.
- Definir personajes y escenarios.
- Determinar qué recursos son necesarios.
- Estimar costos.
- Planificar la producción.

## 5.2. Selección inteligente de estilos

La plataforma debe contemplar cuatro familias visuales:

**2D**
- Personajes ilustrados.
- Expresiones.
- Movimientos.
- Escenarios.
- Animación de objetos.

**3D**
- Personajes tridimensionales.
- Escenarios.
- Cámaras.
- Iluminación.
- Animaciones de objetos y personajes.

**Motion graphics**
- Tipografía animada.
- Gráficos.
- Infografías.
- Transiciones.
- Elementos geométricos.
- Visualización de datos.

**Generación de video mediante IA**
- Personas.
- Escenarios.
- Movimientos.
- Secuencias cinematográficas.
- Clips generados a partir de texto o referencias.

La IA puede combinar diferentes estilos dentro del mismo video.

No debe estar obligada a elegir un único motor para toda la producción.

## 5.3. Plan de producción

Antes de producir, el Director IA debe generar una especificación estructurada:

- Objetivo.
- Guion.
- Duración.
- Escenas.
- Estilo visual de cada escena.
- Personajes.
- Recursos.
- Motor seleccionado.
- Instrucciones de generación.
- Voz.
- Audio.
- Presupuesto estimado.

El resultado debe validarse mediante Zod.

No se deben aceptar estructuras arbitrarias generadas por el modelo.

---

# 6. Storyboard y editor de escenas

## 6.1. Storyboard

Antes de generar el video completo, el usuario debe poder visualizar las escenas planificadas.

Cada escena debe incluir:
- Identificador.
- Descripción.
- Guion.
- Duración estimada.
- Personajes.
- Recursos.
- Estilo visual.
- Movimiento de cámara.
- Motor de generación.
- Estado.

El usuario puede modificar la planificación antes de comenzar la producción.

## 6.2. Editor

El editor debe permitir:
- Visualizar el video.
- Navegar entre escenas.
- Modificar textos.
- Cambiar personajes.
- Cambiar imágenes o clips.
- Cambiar animaciones.
- Cambiar voces.
- Ajustar duraciones.
- Regenerar escenas.
- Reordenar escenas.

No necesitamos construir un editor profesional completo como Premiere o DaVinci Resolve.

Queremos un editor orientado a escenas y datos estructurados.

## 6.3. Regeneración individual

Regla fundamental:

**Modificar una escena no debe obligar a regenerar todo el video.**

Cada recurso debe tener su propia identificación, versión y estado.

Si una escena cambia:
- Se invalida solamente lo que depende de ella.
- Se conserva el resto de las escenas.
- Se reutilizan recursos que no hayan cambiado.
- Se actualiza el render final.

Debe existir caché para evitar regeneraciones innecesarias.

---

# 7. Consistencia visual

La plataforma debe poder mantener continuidad entre escenas.

Necesitamos contemplar:

- Personajes persistentes.
- Referencias visuales.
- Estilos por proyecto.
- Escenarios reutilizables.
- Vestimenta y características visuales.
- Paletas de colores.
- Recursos asociados a una marca.

Un personaje que aparece en cinco escenas debe conservar, en la medida de las capacidades del motor, sus características visuales.

Los recursos propios del usuario deben poder utilizarse como referencias.

La consistencia no puede darse por garantizada en todos los proveedores: debe evaluarse según las capacidades reales de cada motor.

---

# 8. Estrategia económica: local-first y costo mínimo

Esta es una de las decisiones más importantes del proyecto.

El objetivo es que RAdev Studio pueda producir videos sin generar gastos obligatorios por cada producción.

La prioridad es:

1. Herramientas locales y gratuitas.
2. Modelos locales.
3. Planes gratuitos de proveedores cuando sus condiciones lo permitan.
4. APIs pagas solamente como opción adicional.

No se debe asumir que una herramienta gratuita permite uso comercial o producción ilimitada.

Antes de integrar cualquier servicio deben verificarse sus condiciones, cuotas y licencias.

## 8.1. Hardware disponible

Equipo actual del operador:

- CPU: AMD Ryzen 7 7735HS.
- GPU: NVIDIA GeForce RTX 4050 Laptop.
- VRAM dedicada: 6 GB.
- RAM: 16 GB.
- GPU integrada: AMD Radeon.
- Almacenamiento: SSD NVMe.

No se debe asumir que los 7,6 GB de memoria GPU compartida equivalen a VRAM dedicada.

El equipo es suficiente para comenzar con:
- Remotion.
- FFmpeg.
- Animaciones 2D.
- Motion graphics.
- Escenas 3D moderadas.
- Blender.
- Modelos locales pequeños.
- Experimentación con generación de imágenes.

La generación local de video mediante modelos grandes debe considerarse una capacidad experimental y limitada con este hardware.

No comprar hardware adicional inicialmente.

Primero medir el rendimiento con los recursos disponibles.

## 8.2. Claude Pro

El operador dispone de una suscripción Claude Pro.

Debe considerarse principalmente como herramienta de desarrollo, arquitectura y experimentación manual.

No asumir que Claude Pro incluye acceso a la API ni que puede utilizarse como crédito de producción ilimitado.

No construir una dependencia obligatoria de la sesión personal de Claude para que RAdev Studio funcione.

Cualquier integración automatizada con una suscripción debe verificarse previamente según las interfaces y condiciones autorizadas por Anthropic.

La arquitectura debe permitir utilizar modelos locales y proveedores alternativos.

## 8.3. Herramientas locales candidatas

Evaluar progresivamente:

- Remotion: composición y animación.
- FFmpeg: procesamiento audiovisual.
- Blender: producción 3D.
- Ollama: ejecución de modelos LLM locales.
- ComfyUI: flujos locales de generación visual.
- Piper o Kokoro: síntesis local de voz.
- Otros modelos locales compatibles con el hardware.

No instalar todas las herramientas desde el primer día.

Incorporarlas solamente cuando una etapa del producto las necesite.

---

# 9. Arquitectura de proveedores

Crear una capa de abstracción para que el Director IA no dependa de proveedores concretos.

Categorías:

- LLM.
- Generación de imágenes.
- Generación de video.
- Text-to-speech.
- Procesamiento de audio.
- Renderizado.
- Procesamiento audiovisual.

Cada proveedor debe declarar:
- Identificador.
- Modelos.
- Capacidades.
- Formatos soportados.
- Duraciones.
- Resoluciones.
- Idiomas.
- Requisitos de hardware.
- Costos.
- Disponibilidad.
- Limitaciones.

El router debe seleccionar proveedores considerando:
- Calidad.
- Compatibilidad.
- Costo.
- Tiempo estimado.
- Disponibilidad.
- Preferencias del usuario.

Debe existir un proveedor principal y alternativas compatibles.

No cambiar automáticamente a otro proveedor si ello implica una diferencia importante de calidad o características sin notificar al usuario.

---

# 10. Sistema de medición y costos

Cada operación debe quedar registrada.

## 10.1. Métricas

Para LLM:
- Tokens de entrada.
- Tokens de salida.
- Tokens de caché cuando corresponda.
- Modelo.
- Proveedor.
- Duración.
- Estado.

Para generación visual:
- Imágenes generadas.
- Clips generados.
- Duración.
- Resolución.
- Modelo.
- Intentos.
- Costo real.

Para TTS:
- Caracteres.
- Duración.
- Voz.
- Modelo.
- Costo.

Para render:
- Duración del proceso.
- CPU.
- RAM.
- VRAM.
- Tamaño final.
- Errores.

## 10.2. Cost Manager

Cada proyecto debe tener:
- Presupuesto máximo.
- Costo estimado.
- Costo reservado.
- Costo real.
- Operaciones fallidas.
- Regeneraciones.
- Consumo local.
- Historial.

El sistema debe distinguir claramente:
- Operaciones gratuitas.
- Operaciones locales.
- Operaciones con costo API.

Los costos locales deben contabilizarse como recursos y tiempo de procesamiento, aunque no generen una factura por API.

## 10.3. Límites

Debe ser posible:
- Definir un límite por proyecto.
- Definir un límite global.
- Desactivar proveedores pagos.
- Solicitar aprobación antes de un gasto.
- Alertar al alcanzar determinados porcentajes.
- Pausar la producción si no hay presupuesto.

**Estado inicial: proveedores pagos desactivados por defecto.**

Ninguna generación paga debe ejecutarse sin autorización explícita del operador.

---

# 11. Continuidad y recuperación de trabajos

Una producción no puede depender de una sesión de IA activa durante todo el proceso.

Cada tarea debe ser independiente, persistente y recuperable.

Ejemplo de flujo:

1. Crear proyecto.
2. Generar investigación.
3. Guardar investigación.
4. Generar guion.
5. Guardar guion.
6. Aprobar guion.
7. Crear storyboard.
8. Guardar escenas.
9. Generar recursos.
10. Guardar cada recurso.
11. Componer.
12. Renderizar.
13. Revisar.
14. Aprobar.

Si un proveedor falla o se alcanza un límite:
- Pausar el trabajo.
- Conservar todos los resultados.
- Registrar el error.
- Esperar disponibilidad o intervención.
- Reanudar desde la última tarea completada.

Requisitos:
- Jobs idempotentes.
- Checkpoints.
- Reintentos controlados.
- Estados persistentes.
- Caché por hash.
- Registro de errores.
- Sin regenerar recursos ya completados.

---

# 12. Flujo de estados del video

Video debe tener una máquina de estados propia.

Estados propuestos:

- `draft`
- `researching`
- `scripting`
- `script_review`
- `storyboarding`
- `storyboard_review`
- `producing`
- `composing`
- `rendering`
- `in_review`
- `approved`
- `scheduled`
- `publishing`
- `published`
- `paused`
- `failed`
- `archived`

Las transiciones deben estar centralizadas en una máquina de estados dentro de `packages/core`.

No modificar estados directamente desde componentes de interfaz.

Reglas:
- No se puede producir voz definitiva antes de aprobar el guion.
- No se puede publicar sin aprobación del video final.
- Una modificación posterior a la aprobación invalida esa aprobación.
- Una tarea fallida no debe perder los resultados anteriores.

La revisión del guion y la revisión del video final son dos puertas de aprobación obligatorias.

La revisión del storyboard puede ser obligatoria en modo colaborativo y opcional en modo automático.

---

# 13. Arquitectura técnica sobre RAdev Social

La auditoría existente indica que RAdev Social tiene una arquitectura de monolito modular, con Postgres, pg-boss, Next.js, workers y paquetes separados.

La estrategia es evolucionar esa base, no reemplazarla.

## 13.1. Principios

- Mantener el monolito modular.
- Una sola base de datos.
- Mantener pg-boss.
- No incorporar microservicios innecesarios.
- No incorporar Redis.
- Mantener límites entre paquetes.
- No modificar innecesariamente Social Studio.
- Video debe tener sus propias entidades.
- Reutilizar servicios existentes cuando tenga sentido.

## 13.2. Estructura objetivo

```text
apps/
  web/
    # Panel común
    # Social Studio
    # Video Studio

  worker/
    # Worker actual de Social Studio
    # Sin cambios funcionales innecesarios

  video-worker/
    # Nuevo worker independiente
    # Producción audiovisual
    # TTS
    # Remotion
    # FFmpeg
    # Procesamiento de escenas

packages/
  core/
    # Dominio actual
    # Nueva máquina de estados de videos

  db/
    # Schema y migraciones nuevas

  ai/
    # Router actual
    # Nuevos proveedores y tareas

  slides/
    # Componentes actuales reutilizables

  video/
    # Nuevo paquete
    # VideoSpec
    # Schemas Zod
    # Escenas
    # Composiciones Remotion
    # Transiciones
    # Subtítulos
    # Presets visuales

  publishers/
    # Publicadores existentes
    # Futuro publicador de YouTube
```

## 13.3. Separación de workers

El procesamiento audiovisual pesado no debe ejecutarse en Next.js ni en el worker actual de Social Studio.

Crear `apps/video-worker`.

Debe poder iniciarse y detenerse independientemente.

El worker debe ejecutar:
- Generación de recursos.
- TTS.
- Procesamiento de escenas.
- Remotion.
- FFmpeg.
- Render.
- Tareas de publicación cuando corresponda.

Los jobs se administran mediante pg-boss.

## 13.4. Renderizado

Remotion será evaluado como motor principal de composición.

Debe poder:
- Crear Shorts.
- Crear videos horizontales.
- Animar componentes React.
- Integrar subtítulos.
- Integrar narraciones.
- Aplicar transiciones.
- Componer recursos externos.
- Renderizar MP4.

FFmpeg se utilizará para procesamiento adicional.

Los componentes React de `packages/slides` son candidatos a reutilización, pero deben verificarse sus dependencias antes de importarlos.

No utilizar el endpoint actual `/render` de Next.js para producir videos completos.

## 13.5. Almacenamiento

El sistema actual está preparado principalmente para imágenes.

Video requiere:
- Streaming.
- HTTP Range.
- Subidas por partes.
- Archivos grandes.
- Retención de intermedios.
- Gestión de proxies.
- Reproducción desde el navegador.

No cargar videos completos en memoria.

Los renders reproducibles no deberían respaldarse indiscriminadamente.

Se deben conservar:
- Recursos originales del usuario.
- Especificaciones de video.
- Voces que corresponda conservar.
- Archivos finales importantes.

Los intermedios deben tener políticas de limpieza.

---

# 14. Modelo de datos propuesto

No generalizar la entidad `posts`.

Video debe tener tablas propias.

Entidades conceptuales:

- `channels`
- `videos`
- `video_scripts`
- `video_scenes`
- `media_items`
- `video_renders`
- `voice_tracks`
- `video_publications`
- `video_metrics`
- `provider_runs`
- `provider_pricing`
- `usage_events`
- `project_budgets`
- `cost_reservations`

La implementación definitiva debe revisar qué estructuras actuales de `packages/db` se pueden extender.

No crear tablas redundantes si existen entidades compatibles.

Las migraciones deben ser aditivas y conservar la compatibilidad con Social Studio.

Las escenas pueden utilizar JSON validado con Zod cuando resulte conveniente.

---

# 15. Infraestructura y entorno de ejecución

Hay dos entornos que deben distinguirse.

## 15.1. Servidor actual

RAdev Social utiliza una instancia Oracle ARM de 2 OCPU y 12 GB de RAM, según la auditoría.

Este servidor puede seguir alojando:
- Web.
- Base de datos.
- Social Studio.
- Cola de trabajos.
- Servicios compartidos.

No asumir que es adecuado para renderizar videos largos o ejecutar modelos de IA pesados.

## 15.2. Notebook del operador

Hardware:
- Ryzen 7 7735HS.
- RTX 4050 Laptop de 6 GB VRAM.
- 16 GB RAM.
- SSD NVMe.

Será el primer entorno experimental de producción local.

No modificar ni ampliar hardware inicialmente.

Se debe medir:
- Tiempo de render.
- Uso máximo de RAM.
- Uso de VRAM.
- Uso de CPU y GPU.
- Temperaturas.
- Tamaño de archivos.
- Calidad de resultado.

La posibilidad de incorporar un worker local conectado a la aplicación remota debe evaluarse más adelante.

No asumir que el worker de Docker en Oracle y la notebook tienen el mismo hardware o capacidades.

---

# 16. Calidad, derechos y recursos

La plataforma debe contemplar:
- Licencias de imágenes.
- Licencias de videos.
- Licencias de música.
- Licencias de voces.
- Condiciones de uso comercial de modelos.
- Origen de recursos.
- Atribuciones cuando correspondan.

No utilizar automáticamente clips de terceros sin derechos adecuados.

No asumir que un recurso generado por IA tiene derechos comerciales irrestrictos.

Los recursos deben registrar:
- Origen.
- Proveedor.
- Licencia.
- Fecha.
- Proyecto asociado.
- Permisos de uso.

La IA no debe inventar cifras ni hechos verificables. La investigación debe conservar referencias y fuentes para las afirmaciones importantes.

---

# 17. Publicación y analítica

La publicación automática no es prioridad del primer MVP.

A futuro:
- Integración con YouTube.
- OAuth.
- Subidas reanudables.
- Programación.
- Publicación privada para revisión.
- Publicación aprobada.
- Miniaturas.
- Métricas.
- Rendimiento por temática, formato, gancho y duración.

La integración debe respetar los requisitos de auditoría, permisos, cuotas y políticas vigentes de Google.

No implementar publicación hasta que el pipeline de producción esté probado.

---

# 18. Roadmap incremental

El desarrollo debe avanzar mediante fases pequeñas y funcionales.

Cada fase debe entregar algo utilizable.

## V0 — Auditoría y pruebas técnicas

- Revisar la arquitectura actual.
- Revisar los paquetes.
- Verificar licencias.
- Evaluar Remotion.
- Crear un spike descartable.
- Probar un video de 30 segundos.
- Medir recursos en el entorno disponible.
- No modificar producción.

Criterio de finalización: conocer las capacidades y limitaciones reales.

## V1 — MVP de producción local

Primer objetivo funcional:

Crear Shorts animados genéricos, sin depender de modelos pagos.

Características:
- Formato vertical 9:16.
- Duración inicial de 30 a 45 segundos.
- Guion simple.
- Escenas estructuradas.
- Motion graphics.
- Tipografía animada.
- Personajes 2D sencillos.
- Narración.
- Subtítulos.
- Remotion.
- FFmpeg.
- Render MP4.

La producción debe poder realizarse con recursos locales.

No es obligatorio que todas las tareas estén automatizadas todavía.

Criterio de finalización: generar y reproducir un Short completo de calidad aceptable.

## V2 — Director IA básico

- Crear videos desde una idea.
- Generar guiones.
- Dividir en escenas.
- Crear storyboard.
- Seleccionar plantillas.
- Modo automático.
- Modo colaborativo.
- Validación Zod.

Criterio de finalización: un tema puede convertirse en un video estructurado con intervención mínima.

## V3 — Editor y regeneración

- Editor por escenas.
- Reemplazo de recursos.
- Modificación de texto.
- Regeneración individual.
- Caché.
- Versionado.
- Consistencia visual básica.

Criterio de finalización: modificar una escena sin reconstruir innecesariamente el resto.

## V4 — Producción visual avanzada

- Personajes más complejos.
- Blender.
- Escenarios 3D.
- Modelos locales de imagen.
- Animaciones más elaboradas.
- Recursos reutilizables.

Criterio de finalización: mejorar la calidad audiovisual sin perder estabilidad.

## V5 — Generación audiovisual con IA

- Evaluar modelos locales de video.
- Evaluar proveedores externos.
- Integrar referencias visuales.
- Medir consistencia de personajes.
- Comparar calidad y costos.
- Incorporar proveedores pagos solo con autorización.

Criterio de finalización: disponer de alternativas de generación audiovisual para escenas que lo justifiquen.

## V6 — Publicación y analítica

- YouTube.
- Programación.
- Publicación.
- Analytics.
- Rendimiento por contenido.

## V7 — Videos largos

- Capítulos.
- Escenas complejas.
- B-roll.
- Narración extensa.
- Generación por capítulos.
- Render nocturno.
- Miniaturas.
- Revisión final.

---

# 19. Reglas de desarrollo

Estas reglas son obligatorias:

1. No implementar todas las fases juntas.
2. No modificar Social Studio sin necesidad.
3. No generalizar `posts` para incluir videos.
4. No introducir microservicios ni Redis.
5. No ejecutar render pesado en Next.js.
6. No asumir que una API gratuita es ilimitada.
7. No habilitar proveedores pagos por defecto.
8. No perder resultados ante interrupciones.
9. No regenerar recursos innecesariamente.
10. Validar todas las salidas de IA con Zod.
11. Mantener jobs idempotentes.
12. Mantener pruebas automatizadas.
13. Mantener compatibilidad con Docker y las arquitecturas soportadas.
14. No renombrar técnicamente el proyecto ni modificar volúmenes existentes sin un plan específico.
15. Cada fase debe tener criterios de aceptación.

---

# 20. Instrucciones para Claude Code

Este documento define la visión y las decisiones de producto acordadas con el operador.

**No constituye una autorización para implementar todo el sistema.**

Primero se debe:

1. Leer `CLAUDE.md`.
2. Revisar `docs/ARCHITECTURE.md`.
3. Revisar `docs/PRD.md`.
4. Revisar `docs/ROADMAP.md`.
5. Revisar `docs/PROGRESS.md`.
6. Leer `docs/AUDIT.md`.
7. Leer `docs/EVOLUTION-PLAN.md`.
8. Revisar el estado real del repositorio y las ramas actuales.

Luego, comparar esta especificación con la arquitectura existente.

Entregar un análisis que identifique:

- Qué decisiones ya están contempladas.
- Qué decisiones nuevas deben incorporarse.
- Qué propuestas anteriores quedaron desactualizadas.
- Qué componentes se pueden reutilizar.
- Qué riesgos técnicos existen.
- Qué pruebas necesitamos realizar primero.
- Qué aspectos requieren investigación.
- Qué cambios mínimos serían necesarios para el MVP.

Prestar especial atención a las nuevas decisiones:

- Producto genérico para cualquier temática.
- Cuatro familias de estilos visuales.
- Director IA con modo automático y colaborativo.
- Editor por escenas.
- Regeneración individual.
- Estrategia local-first.
- Costo adicional cero como objetivo inicial.
- Claude Pro como herramienta de desarrollo y experimentación, no como API ilimitada.
- Hardware inicial de 16 GB RAM y RTX 4050 de 6 GB.
- Evolución progresiva, sin desarrollar todas las capacidades de una vez.

**No modificar código, migraciones, base de datos, Docker Compose ni archivos de producción durante esta primera revisión.**

El resultado esperado es un plan técnico actualizado, con decisiones documentadas, riesgos y una propuesta concreta para implementar únicamente V0 y V1.

La implementación comenzará después de revisar y aprobar ese plan con el operador.

---

# 21. Definición de éxito

RAdev Studio será exitoso si consigue:

- Producir videos de distintas temáticas.
- Crear contenido visualmente atractivo y animado.
- Elegir técnicas visuales adecuadas para cada escena.
- Funcionar con costos adicionales mínimos.
- Aprovechar el hardware disponible.
- Permitir intervención humana.
- Regenerar escenas individualmente.
- Recuperarse de errores y límites de proveedores.
- Crecer sin romper Social Studio.
- Incorporar capacidades más avanzadas a medida que el producto y la infraestructura lo permitan.

**Principio final: primero conseguir un producto pequeño, útil y estable; después mejorar la calidad, automatización y complejidad audiovisual de manera progresiva.**
