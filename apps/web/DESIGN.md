---
name: RAdev Social
description: Panel del operador, pensado como la sala de control de una emisora con un canal por marca.
colors:
  console: "#0c0e12"
  panel: "#13161c"
  panel-raised: "#1a1e26"
  bezel: "#252a34"
  bezel-strong: "#343a47"
  ink: "#e8eaed"
  ink-dim: "#a3a9b4"
  ink-faint: "#818895"
  tally-red: "#f2555a"
  tally-amber: "#f2b53a"
  tally-green: "#3dd68c"
  tally-blue: "#5bbcf5"
  folder-manila: "#d9b66f"
  folder-tab-1: "#8cc9a6"
  folder-tab-2: "#ee8fc0"
  folder-tab-3: "#7fb4e8"
  folder-tab-4: "#b49af0"
  folder-tab-5: "#5ec4c4"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6.5vw, 4.5rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.16em"
  plate:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.22em"
  timecode:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontWeight: 400
    letterSpacing: "0.02em"
    fontFeature: "tnum, zero"
rounded:
  plate: "3px"
  control: "4px"
  field: "6px"
  popup: "8px"
  monitor: "10px"
spacing:
  gutter-phone: "16px"
  gutter-desktop: "32px"
  section: "56px"
  container: "1400px"
components:
  plate:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.plate}"
    rounded: "{rounded.plate}"
    padding: "7px 10px 6px"
  console-button:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  console-button-hover:
    backgroundColor: "{colors.bezel}"
  console-button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.console}"
    rounded: "{rounded.control}"
    padding: "14px 20px"
  switcher:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    height: "44px"
  switcher-open:
    backgroundColor: "{colors.panel-raised}"
  console-popup:
    backgroundColor: "{colors.panel-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.popup}"
  console-item-highlighted:
    backgroundColor: "{colors.bezel}"
    height: "44px"
  nav-key:
    textColor: "{colors.ink-dim}"
    typography: "{typography.label}"
    padding: "12px 12px 13px"
  nav-key-current:
    textColor: "{colors.ink}"
  nav-key-off-air:
    textColor: "{colors.ink-faint}"
  monitor:
    backgroundColor: "{colors.panel}"
    rounded: "{rounded.monitor}"
    padding: "6px"
---

# Design System: RAdev Social

## Overview

**Creative North Star: "La sala de control"**

El panel es la sala de control de una emisora. Cada marca es un **canal**, cada post es un bloque en la **planilla de emisión** y el operador trabaja frente a una pared de monitores. La estética descarta a propósito el admin genérico de barra lateral más grilla de tarjetas: la consola es de grafito, los bordes son finos como el bisel de un equipo, las etiquetas van grabadas en mayúsculas espaciadas y los datos se leen en tipografía monoespaciada, como un timecode.

La consola es siempre oscura y neutra. **El color de las marcas no aparece en el cromo del panel.** Solo se ve dentro de su propio canal: la pantalla del monitor y las barras de color. Así la identidad de cada marca se lee sin que contamine la de la herramienta. El estado del sistema se comunica con lámparas tally (rojo, ámbar y verde), siempre con forma y texto, nunca solo con el color.

La densidad es de herramienta de trabajo: información a la vista, poca decoración y un solo momento de movimiento pensado, el encendido tipo CRT de los monitores.

**Key Characteristics:**
- Consola de grafito, siempre en modo oscuro (`color-scheme: dark`).
- Etiquetas grabadas ("plates") como títulos de sección, no como texto chico decorativo encima de un título.
- Números, códigos y horas en Geist Mono con cifras tabulares.
- El color de cada marca vive solo dentro de su canal.
- Las secciones de fases futuras se ven apagadas ("fuera del aire") con su fase, nunca como páginas vacías.

## Colors

Una paleta de grafito casi monocroma, con tres lámparas de estado como único color propio.

### Neutral
- **Consola** (#0c0e12): fondo de la página y de las barras superior e inferior (al 88–92 % con desenfoque).
- **Panel** (#13161c): superficies apoyadas: planilla, selector de marca en reposo.
- **Panel elevado** (#1a1e26): plates, botones, menús desplegables.
- **Bisel** (#252a34): bordes finos, divisores y la fila resaltada de un menú.
- **Bisel fuerte** (#343a47): bordes de controles (botones, selector, avatar).
- **Tinta** (#e8eaed): texto principal y la sección actual de la navegación.
- **Tinta tenue** (#a3a9b4): texto secundario y navegación en reposo.
- **Tinta apagada** (#818895): etiquetas, metadatos y secciones fuera del aire.

### Tally (estado)
- **Rojo al aire** (#f2555a): publicado o en emisión; errores destructivos. Lámpara circular con brillo.
- **Ámbar en cola** (#f2b53a): en cola o seleccionado (la marca activa). También es el color del foco del teclado. Lámpara triangular.
- **Verde listo** (#3dd68c): sistema sano (base en línea). Lámpara cuadrada.
- **Azul a su hora** (#5bbcf5): programado, o una pausa que retoma sola a una hora (el límite de Claude en el estudio de video). Lámpara de rombo.
- **Rojo falla** (#f2555a): algo falló y espera "Reintentar" (estudio de video). Lámpara en cruz, para no confundirla con "al aire".

### Named Rules
**La regla del canal propio.** El color de una marca solo se pinta dentro de su canal (pantalla del monitor, barras de color). El cromo del panel nunca toma el color de una marca, ni siquiera el de la marca activa.

**La regla de la lámpara.** Todo estado lleva forma y texto además del color: círculo al aire, triángulo en cola, cuadrado listo, rombo a su hora, cruz falla, anillo en espera, guion apagado.

## Typography

**Fuente principal:** Geist (con system-ui)
**Fuente de datos:** Geist Mono (con ui-monospace)

**Character:** una sans técnica y neutra para la interfaz, con una mono de cifras tabulares para todo lo que se lee como dato: horas, códigos de post, colores, cantidades.

### Hierarchy
- **Display** (600, clamp(2.5rem, 6.5vw, 4.5rem), 0.95): el nombre de la marca dentro de su monitor. Usa la tipografía de títulos de la propia marca cuando está cargada.
- **Title** (600, 15px): el nombre del producto en la barra superior.
- **Body** (400, 14px): contenido y descripciones, con un máximo de 60ch en los textos de estado vacío.
- **Plate** (600, 12px, 0.22em, mayúsculas): título de cada zona ("CANALES", "EN COLA").
- **Label** (500, 11px, 0.16em, mayúsculas): etiquetas de filas, lámparas, pestañas y botones.
- **Timecode** (Geist Mono, cifras tabulares y cero con barra): reloj, códigos `RA-0001`, valores hex.

### Named Rules
**La regla del dato en mono.** Si un valor se compara, se ordena o se lee de corrido (hora, código, número, color), va en timecode. El texto corrido nunca va en mono.

## Layout

- Contenedor de 1400px centrado, con margen lateral de 16px en el celular y de 32px desde `sm` (640px).
- Barra superior pegajosa. En la compu tiene dos filas: la de identidad (producto, selector de marca, reloj, operador) y la de navegación (pestañas). En el celular es una sola fila, sin reloj.
- Navegación: pestañas desde `md` (768px); por debajo, una barra fija abajo con 6 celdas iguales, a mano del pulgar y respetando `safe-area-inset-bottom`. El contenido deja 112px abajo para que la barra no lo tape.
- Las zonas se separan con 56px. Cada zona abre con su plate, seguido de una línea de bisel que llega hasta un dato al margen ("2 activos", "0 en cola").
- Los canales van en 2 columnas desde `md` y se apilan en el celular.
- Todo control táctil mide al menos 44px de alto.

## Elevation & Depth

La profundidad viene de capas de tono (consola → panel → panel elevado) y de biseles, no de sombras flotantes. Las sombras que hay son físicas: el brillo superior interno de una pieza grabada y la sombra larga y difusa de un monitor apoyado.

### Shadow Vocabulary
- **Grabado** (`inset 0 1px 0 rgb(255 255 255 / 0.05), 0 1px 2px rgb(0 0 0 / 0.4)`): plates.
- **Monitor** (`inset 0 1px 0 rgb(255 255 255 / 0.04), 0 18px 40px -18px rgb(0 0 0 / 0.8)`): bisel de cada canal.
- **Desplegable** (`0 18px 40px -12px rgb(0 0 0 / 0.7)`): menús del selector de marca y del operador.
- **Canal activo**: el monitor suma un anillo ámbar de 1px al 25 % y el borde se mezcla con el ámbar al 55 %.

### Named Rules
**La regla del vidrio de consola.** Solo las barras fijas (arriba y abajo) usan fondo translúcido con `backdrop-filter: blur(10px)`. Ninguna otra superficie usa vidrio.

## Shapes

Esquinas chicas y mecánicas: 3px en los plates y el indicativo de la marca, 4px en los botones, 6px en el selector y 8px en los menús. El único radio generoso es el del bisel del monitor (10px, con la pantalla a 6px), porque imita un equipo físico. El avatar del operador es el único círculo. Las líneas de bisel son siempre de 1px.

## Components

### Buttons
- **Shape:** 4px.
- **Consola (por defecto):** fondo panel elevado, borde de bisel fuerte, texto label en tinta, relleno de 10px × 14px.
- **Principal:** fondo tinta con texto consola, relleno de 14px × 20px. Solo para la acción única de una pantalla (entrar con GitHub).
- **Hover / Focus:** el fondo pasa a bisel y el borde a tinta apagada, en 160ms ease-out. El foco es un contorno ámbar de 2px con 3px de separación, igual para todo el panel.
- **Deshabilitado:** opacidad al 60 % y cursor de progreso.

### Plate
Etiqueta grabada que **es** el título de la zona (`h1`/`h2`), no un texto decorativo encima de él. Lleva un degradado de panel elevado a panel, borde de bisel fuerte y la sombra de grabado.

### Tally
Lámpara SVG de 10px más un texto en label. La forma y el color van juntos: circular (al aire, con brillo), triangular (en cola / activa), cuadrada (lista), anillo (en espera), guion (apagada).

### Channel monitor (componente distintivo)
Un bisel oscuro de 6px con una pantalla 16:9 pintada con los tokens de la marca (`--screen-bg`, `--screen-ink`, `--screen-accent`, `--screen-muted`) y líneas de barrido muy tenues. El nombre de la marca va en display con su propia tipografía, seguido de un punto de acento con brillo. Debajo van la carta de ajuste (barras de color de los tokens con su leyenda hex) y la ficha técnica en filas de 7.5rem con dato. La marca activa lleva la lámpara "Activa" junto al indicativo y el anillo ámbar en el bisel.

### Navigation
- **Compu:** pestañas con ícono de 14px y label. En reposo van en tinta tenue y pasan a tinta en hover. La sección actual lleva una barra de 2px en tinta sobre el borde inferior de la barra superior ("bus de programa encendido"). Las secciones futuras son `<span aria-disabled>` en tinta apagada, con una etiqueta de fase `F2` en mono con borde de bisel.
- **Celular:** barra fija con 6 celdas de al menos 60px, ícono de 20px y un label corto de 10.5px. La sección actual lleva una barra de 2px arriba. Las secciones futuras van al 70 % de opacidad con su fase en mono en la esquina.

### Brand switcher
Botón de 44px con el indicativo en mono (`RA`), el nombre de la marca y un ícono de flechas. Abre un menú "Trabajar en" con las marcas activas como opciones de radio (44px, fila resaltada en bisel, tilde en la elegida). El cambio es optimista y el botón baja al 60 % mientras se guarda la cookie.

### Operator menu
Avatar circular de 36px (el de GitHub o las iniciales en mono). El menú muestra "Operador", el nombre y el email, y la acción Salir.

### Popups
Fondo panel elevado, borde de bisel fuerte, 8px de radio y la sombra desplegable. Entran y salen con opacidad y escala 0.97 en 120ms, desde el punto de origen del disparador.

### Estudio de video (RAdev Studio, `/videos`)
Diseño aprobado el 2026-11-26 (T10). Capturas y maqueta en `docs/references/studio/`. El operador pidió un tono "bien de juego": el estudio es el único lugar del panel con ilustración. Igual que el color de una marca en su canal, la ilustración vive **solo dentro de su escena**; el cromo (barra, plates, lámparas, botones, tablas) es la consola de siempre.

- **Plano del estudio (componente distintivo).** El edificio visto desde arriba, de noche, en SVG generado a partir de los datos (no es una imagen). Las oficinas 1 a 5 van arriba, Recepción a la izquierda, tu oficina vidriada al centro, el Archivo a la derecha y las oficinas 6 a 8 abajo. Hay flechas tenues en el pasillo. Cada oficina tiene su piso (madera, alfombra, baldosa, goma acústica) y paredes de bisel. En el celular, el mismo plano va apilado en dos columnas.
- **La luz es el estado.** Una oficina trabajando tiene la lámpara prendida (un charco cálido; frío en Render). Una libre queda a oscuras. Una con falla tiene un resplandor rojo. Tu oficina se ilumina en ámbar cuando algo te espera. Igual, cada oficina lleva su **cartel de puerta**: un plate con número y nombre, y debajo su lámpara tally con un texto. La luz nunca es la única señal.
- **Quién trabaja.** Las oficinas de Claude tienen personas, las de código tienen robots, y tu oficina tiene la silla vacía con "VOS". Los globos de diálogo son cortos: "intento 2/3", "¡429!", "¡te espera!".
- **Carpeta.** Cada video es una carpeta de papel manila (#d9b66f) con una pestaña de color pastel y su número de dos cifras en mono. La pestaña identifica al video y **nunca es un color de estado**: menta #8cc9a6, rosa #ee8fc0, celeste #7fb4e8, lila #b49af0 y turquesa #5ec4c4. La misma pestaña aparece en la planilla y en los títulos de las pantallas de ese video.
- **Cartel "Te espera".** Una franja ámbar de todo el ancho, arriba del plano, con la única acción principal de la pantalla ("Ir a tu escritorio"). Solo aparece si algo te espera.
- **Cabecera de oficina.** Al entrar a una oficina, su escena va en grande a la izquierda. A la derecha van qué hace, el video actual con su reloj, la barra de intentos (rojo si fue rechazado, tinta si está en curso) y, si hubo un rechazo, la lista de problemas. Debajo van el historial y el informe, en filas de ficha técnica.
- **Escritorios (aprobar guion y video).** Son pantallas de trabajo, sin ilustración. Llevan una columna principal (las escenas, o los dos reproductores) y a la derecha un panel fijo con la decisión: aprobar dice qué cuesta y devolver pide una nota. En el celular, la decisión pasa a una barra fija sobre la navegación. Las correcciones de la verificación se ven tachadas y corregidas, con un borde verde. Los hechos llevan su lámpara: cuadrado verde si está en su página, triángulo ámbar si es casi igual, anillo punteado si no está.
- **Movimiento previsto (T12).** Las carpetas caminan por el pasillo cuando cambian de oficina, el de Guion teclea, los LEDs de Render titilan y el globo ámbar respira. Nada más se mueve, y con `prefers-reduced-motion` no se mueve nada.

## Do's and Don'ts

### Do:
- **Do** titular cada zona con un plate y su línea de bisel, con el conteo al margen.
- **Do** mostrar el estado real con una lámpara tally (forma + texto), incluso cuando está vacío ("En espera · sin posts", "0 en cola").
- **Do** mostrar las secciones de fases futuras apagadas con su fase, en vez de crear páginas vacías.
- **Do** escribir todo valor numérico, código u hora en timecode.
- **Do** mantener los controles táctiles en 44px o más y la navegación del celular abajo.
- **Do** respetar `prefers-reduced-motion`: el encendido de los monitores es el único momento de movimiento y se apaga ahí.

### Don't:
- **Don't** usar el color de una marca en el cromo del panel (barras, navegación, botones, fondos).
- **Don't** comunicar un estado solo con el color.
- **Don't** usar la barra lateral más grilla de tarjetas del admin genérico.
- **Don't** agregar sombras flotantes a las superficies: la profundidad va por tono y bisel.
- **Don't** agregar un modo claro: el panel es siempre de consola oscura.
- **Don't** usar vidrio translúcido fuera de las barras fijas.
