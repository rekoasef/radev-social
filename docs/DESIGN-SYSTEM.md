# Design System — Carruseles

Reglas visuales escritas para que el código las cumpla siempre. El carrusel número 300 tiene que verse tan de la marca como el primero.

## 1. Principios

Aplican a todas las marcas:

- Estética editorial tecnológica, **premium y minimalista**.
- **Mucho espacio negativo.** Tipografía fuerte y composición limpia.
- **Sin personas, sin fotos, sin ilustraciones infantiles, sin 3D innecesario.** Las plantillas solo aceptan íconos (Lucide), diagramas propios y assets de la marca.
- **Layout consistente** en todas las slides de un carrusel.
- Lo que en un prompt de IA era un deseo, acá es una restricción del código.

## 2. Presets y tokens: qué es código y qué es dato

Una identidad visual = **preset de estilo** (código) + **tokens** (datos editables en el panel).

- El **preset** define la personalidad: cómo se ven las tarjetas, qué decoraciones existen y cómo se ubican, comportamiento tipográfico (mayúsculas, interlineados), estilo del énfasis, componentes de encabezado y pie. Vive en `packages/slides/presets/<preset>/`.
- Los **tokens** son los valores que el preset expone para configurar: colores, tipografías, radios, textos, assets, intensidades. Viven en `brands.theme_tokens` (JSON) y se editan desde el panel con vista previa en vivo.
- Cada preset exporta un **schema Zod de sus tokens** (con valores por defecto neutros: los de cada marca viven en la base). Los assets se guardan como id de `brand_assets`. El panel genera el formulario desde ese schema y valida todo lo que se guarda.
- Las plantillas nunca usan colores ni fuentes literales: consumen el preset y los tokens vía CSS variables.
- **Marca nueva = elegir preset + cargar tokens y assets. Cero código.** Un estilo visual completamente distinto = un preset nuevo (código), que queda disponible para todas las marcas.

### Tipografías disponibles (lista curada)
Todas libres, auto-hospedadas en el proyecto (no se cargan de internet al renderizar): Inter, Inter Tight, Hanken Grotesk, Geist Sans, Geist Mono, Space Grotesk, Manrope, DM Sans, JetBrains Mono. Vienen de paquetes `@fontsource-variable` (fuentes variables). Para sumar una: instalar su paquete en `packages/slides` y registrarla en `src/fonts/registry.ts` y `src/fonts/load.ts`.

### Presets de la v1

| Preset | Personalidad | Marca inicial |
|---|---|---|
| `bold` | Fuerte y directa: títulos enormes en mayúsculas, acento brillante, tarjetas con borde luminoso, lenguaje de workflows | RAdev |
| `soft` | Calma y premium: títulos en oración normal, mucho aire, paneles de vidrio, glows radiales, elemento protagonista (hero) | Lumus |

## 3. Formatos y zonas seguras

**Formato único de la v1: `4x5` (1080×1350)**, para TikTok y, más adelante, Instagram (ADR 0011). TikTok muestra el 4:5 ajustado al ancho, sin recortar, con negro arriba y abajo.

**Zonas seguras** (medidas sobre una captura real de un carrusel de RAdev en TikTok; confirmar superponiendo un render real):

| Zona | Valor | Por qué |
|---|---|---|
| Márgenes | superior 80 · izquierdo 80 · derecho 80 · inferior 100 | Aire de las referencias; abajo, los puntitos de paginación de TikTok (~90 px) |
| Exclusión inferior derecha | `x ≥ 930` y `y ≥ 650` (150 px del borde derecho, mitad inferior) | Columna de botones de TikTok (avatar, me gusta, comentarios, guardar) |

El contenido (`data-qa="content"`) no puede invadir ninguna zona. Las decoraciones sí, y también el encabezado y el pie: el pie puede quedar parcialmente tapado en TikTok, porque es firma y no información.

**Pie**: en todos los presets, el indicador de página y el "Deslizá →" terminan en `x = 930`, a la izquierda de la columna de botones (con ella encima quedaban tapados por el contador de comentarios).

En la práctica, las plantillas (de los dos presets) usan un ancho de **850** (x 80–930) para todo lo que va debajo del título, así nunca tocan la columna de botones. El título puede usar los 920 del área segura: aun con 4 líneas termina muy por encima de `y = 650`.

## 4. Anatomía de una slide

```
┌──────────────────────────────────┐
│ ETIQUETA IZQ          ETIQUETA DER│  encabezado (preset + textos de tokens)
│                                  │
│  CONTENIDO                       │  varía según el tipo de slide
│                                  │
│──────────────────────────────────│
│ logo/wordmark                 3/7│  pie (preset + tokens) + indicador de página
└──────────────────────────────────┘
   + decoraciones del preset
```

- Indicador de página ("3/7") en todas las slides salvo la portada. La portada muestra "Deslizá →".
- Decoraciones con variación **determinista**: semilla = id del post.

## 5. Catálogo de slides

La estructura (campos) es común a todos los presets. Schemas en `packages/slides/src/content/`; límites centralizados en `limits.ts`, a calibrar en Fase 1 con casos extremos. Los límites cuentan caracteres **visibles** (sin los asteriscos del énfasis). Todo texto admite énfasis (§6) salvo que se indique. **No admiten énfasis** (texto plano, `*` prohibido): las etiquetas dentro de tarjetas, chips y nodos (`label`, `lead`), el `kicker` de `cover`, `value` y `source` de `bigNumber`, `source` de `chart`, los rangos y etiquetas de `costBreakdown`, `name` de `comparison` y `button` de `cta`. Los íconos son nombres de Lucide en kebab-case y se valida que existan.

### v1

**`cover`** — portada con el hook.
- `kicker?` (≤24, sin énfasis) · `title` (≤60) · `subtitle?` (≤90)

Las slides sin referencia (`statement`, `question`, `cta` y las demás) se diseñan en código con las reglas del preset y el operador las aprueba sobre capturas del render real.

**`statement`** — afirmación fuerte con apoyo.
- `title` (≤70) · `body?` (≤160) · `visual?`: `{ from: {icon, label≤16}, to: {icon, label≤16} }`

**`question`** — pregunta con caja de callout.
- `title` (≤80) · `callout`: `{ icon, lead≤30, text≤80 }`

**`cardGrid`** — grilla de tarjetas con ícono, **sin orden** entre ellas (opciones, ejemplos). Ref: `ref-cardgrid.png`
- `title` (≤60) · `intro?` (≤40) · `cards`: 3–6 × `{ icon, lead?≤16, label≤28 }` · `footer?` (≤80)
- `lead` es la línea liviana sobre la etiqueta ("una" → "automatización"): da los dos tonos de la referencia sin gastar énfasis.

**`flow`** — tarjetas unidas por conectores, **en orden** (un proceso, un recorrido). Refs: `ref-flow-1.png`, `ref-flow-2.png`
- `title` (≤60) · `nodes`: 3–5 × `{ icon, label≤22 }` · `body?` (≤180) · `closing?` (≤90)
- Hasta 4 nodos: una fila (como `ref-flow-2`). 5 nodos: dos filas, 3 + 2 (como `ref-flow-1`), la segunda centrada. Las dos filas se leen de izquierda a derecha: el conector sale de abajo del tercer nodo, cruza por el espacio entre filas y entra por arriba al cuarto.
- A diferencia de `steps`, los nodos no llevan texto propio: el recorrido se entiende de un vistazo.

**`hubDiagram`** — fuentes que confluyen en un centro. Ref: `ref-hubdiagram.png`
- `title` (≤60) · `nodes`: 3–6 × `{ icon, label≤16 }` · `center`: `{ icon }` · `body?` (≤180) · `closing?` (≤70)

**`comparison`** — X contra Y.
- `title` (≤60) · `left` / `right`: `{ name≤18, icon?, points: 2–5 × ≤40 }` · `verdict` (≤90)
- `right` es la opción hacia la que se inclina el veredicto: el preset la destaca. Si ninguna gana, el veredicto lo dice igual; va a la derecha la que se recomienda en la mayoría de los casos.

**`costBreakdown`** — desglose de costos (serie "¿Cuánto cuesta realmente...?").
- `title` (≤60) · `items`: 3–6 × `{ label≤30, range≤20 }` · `total`: `{ label≤20, range≤24 }` · `note?` (≤100)
- Rangos **solo** del documento de precios de la marca.

**`steps`** — pasos numerados.
- `title` (≤60) · `steps`: 3–5 × `{ title≤32, text≤90 }`

**`bigNumber`** — cifra enorme con contexto.
- `kicker?` (≤30) · `value` (≤10, sin énfasis) · `label` (≤80) · `context?` (≤140) · `source` (≤90, obligatorio)
- `value` debe existir en `data.json`; nunca inventado.

**`chart`** — gráfico simple de líneas o barras en SVG.
- `title` (≤60) · `kind`: `line` | `bar` · `datasetRef` · `caption?` (≤100) · `source` (≤90)
- La IA elige el dataset; los puntos los inyecta el código. Cada dataset (`chartDatasetSchema`) tiene `unit?`, `unitPosition` y 2–60 puntos `{ label≤10, value }`. El render recibe los datasets de la marca; si falta el de `datasetRef`, falla (nunca se dibuja un gráfico sin datos reales).
- Números con "." de miles y "," decimal (`formatNumber`, sin `Intl` para no depender del runtime). Sin decimales si todos los valores son enteros o desde 100.

**`cta`** — cierre con llamado a la acción.
- `title` (≤70) · `subtitle?` (≤120) · `button` (≤50) · `icon?`
- Si la marca tiene WhatsApp configurado, el `button` refleja esa acción ("Escribime por WhatsApp").

### Carrusel

```ts
Carousel = {
  hook: string            // ≤100
  pillarKey: string
  hookType: "cost" | "warning" | "myth" | "comparison" | "question" | "data" | "story" | "howto"
  slides: Slide[]         // 5–8; primera `cover`, última `cta`
  caption: string         // ≤2000
  hashtags: string[]      // ≤5, sin "#"
  altTexts?: string[]     // uno por slide
}
```

### v2
- **`code`**: fragmento de código resaltado.

## 6. Énfasis

- Sintaxis: `*texto*` → estilo de énfasis del preset con el color de acento de la marca.
- Máximo **2 fragmentos por slide**.
- Parser propio y simple (`parseEmphasis`). Son errores de validación: un asterisco sin cerrar, un énfasis vacío (`**`) y un énfasis que empieza o termina con espacio. Sin escape ni anidamiento.

## 7. Preset `bold` — tokens iniciales de RAdev

**Personalidad**: fuerte y directa; lenguaje visual de workflows y diseño de sistemas.

### Tokens (valores del seed de RAdev)

| Token | Valor | Uso |
|---|---|---|
| `colors.bg` | `#0B0B0B` | Fondo |
| `colors.surface` | `#121212` | Tarjetas y cajas |
| `colors.accent` | `#FF7A00` | Énfasis, bordes, íconos, conectores activos |
| `colors.text` | `#FFFFFF` | Títulos y texto principal |
| `colors.muted` | `#A1A1AA` | Texto de apoyo |
| `colors.line` | `#27272A` | Divisores y conectores neutros |
| `glow.intensity` | 0.35 | Brillo de bordes y puntos (acotado 0–0.5) |
| `fonts.display` | Inter Tight 900 | Títulos |
| `fonts.body` | Inter 300 | Apoyo |
| `fonts.label` | Inter 500 | Etiquetas |
| `radius.card` / `radius.callout` | 16 / 20 | |
| `header.left` / `header.right` | "PROCESOS DE HOY" / "RESULTADOS DE MAÑANA" | Etiquetas de esquina |
| `footer.tagline` | "AUTOMATIZACIÓN" / "IDEAS EN RESULTADOS" | Dos líneas. No va en el pie (lo tapan los botones de TikTok): se muestra debajo del botón de la `cta` |
| `wordmark` | `{ strong: "RA", light: "dev", dot: true }` | Construido en código |
| `logoAsset` | — | Opcional; si existe, reemplaza al wordmark |

### Comportamiento del preset (código)

- Títulos en MAYÚSCULAS, interlineado 1.06, tracking -0.02em con espacio entre palabras +0.12em. Con 0.95 las mayúsculas acentuadas (DÍA, INFORMACIÓN) se montan sobre la línea de arriba. Escala sugerida: 104 / 84 / 64 · cuerpo 36 · etiqueta 18. Se ajusta en Fase 1.
- Énfasis en títulos: color de acento. En apoyo: peso 700, acento, mayúsculas.
- Etiquetas: mayúsculas, tracking 0.3em, barra vertical fina.
- Pie: línea divisoria, wordmark a la izquierda (o el logo, si la marca tiene `logoAsset`), indicador de página a la derecha (en la portada, "Deslizá →"), terminando en `x = 930` para que la columna de botones de TikTok no lo tape. Sin tagline.
- Decoraciones: líneas curvas finas en esquinas terminadas en punto brillante, grillas de puntos, línea punteada vertical izquierda, glow radial suave (solo portada y `cta`).
- Contenedores: dos formas y no más. Las referencias usan cuatro variantes distintas; estas reglas las unifican:
  - **Tarjeta** (`cardGrid`, `flow`, `steps`): fondo `surface`, borde 1px acento con glow, radio `radius.card`. Ícono en color `text` dentro de un cuadradito oscuro (un tono sobre `surface`, sin borde de acento). Texto debajo del ícono en `fonts.body`, en oración normal (no mayúsculas): `lead` liviano y `label` en peso 700, en color `text`. Así se logran los dos tonos de `ref-cardgrid`. Ninguna tarjeta se resalta en acento (en la referencia, la primera sí: se descarta porque superaría los 2 énfasis por slide).
  - **Chip** (nodos de `hubDiagram`): mismo borde y fondo; ícono y texto en una sola línea, sin cuadradito. El centro del hub lleva el ícono en acento.
- Conectores de diagramas: 1–2px en acento con puntos brillantes en los extremos. En `hubDiagram` terminan en flecha hacia el centro.
- `cardGrid` reparte las tarjetas en filas: 3 → 3 · 4 → 2+2 · 5 → 3+2 · 6 → 3+3. `hubDiagram` ubica los chips en lugares fijos según la cantidad: 3 → arriba y uno por lado · 4 → dos por lado · 5 → arriba y dos por lado (como la referencia) · 6 → como 5 más uno abajo.
- `cover`: kicker en acento con barrita, título más grande que en el resto (124 / 104 / 88 según el largo) arriba y a 850 de ancho, subtítulo abajo detrás de una línea corta en acento; en el medio, espacio negativo.
- `statement`: el visual `from → to` son dos tarjetas en los extremos unidas por un conector punteado con flecha; el ícono del destino va en acento.
- `question`: caja destacada (radio `callout`) con el ícono en acento a la izquierda y `lead` (en negrita) + `text` como un solo párrafo.
- `cta`: botón sólido en acento con texto en el color de fondo y el ícono; debajo, el tagline de la marca (`footer.tagline`) con barrita, en `muted`.
- `comparison`: dos columnas; la izquierda neutra (borde `line`, sin brillo), la derecha en acento (borde, brillo, viñetas e ícono). Veredicto abajo.
- `costBreakdown`: filas concepto / rango separadas por líneas finas, rangos en `fonts.label` 700 con números tabulares; el total en una caja destacada (radio `callout`) con el rango grande en acento. La nota, chica abajo.
- `steps`: badges cuadrados "01", "02"… en acento, unidos por un riel vertical; título del paso en 700 y texto en apoyo.
- `bigNumber`: la cifra enorme en acento con brillo, en una línea (el tamaño se ajusta al largo, hasta 260 px); etiqueta en 600, contexto y fuente.
- `chart`: SVG propio. Grilla punteada en `line`, ejes en `muted`. Línea en acento con brillo y área con degradado; barras en acento al 42 % salvo la última, sólida. El último valor va en una etiqueta en acento. Con ≤ 8 puntos se rotulan todos; si hay más, el primero, el del medio y el último.
- Toda slide con datos (`bigNumber`, `chart`) muestra "Fuente: …" en `muted`.
- Tamaño del título según el largo visible: hasta 24 caracteres 100 px, hasta 48 84 px, más 70 px (a calibrar en la T11).
- Las etiquetas de un mismo diagrama comparten tamaño: se achican todas juntas hasta que entra la palabra más larga (en los chips, la etiqueta entera, que va en una línea), con un mínimo. Es una estimación por cantidad de caracteres, sin medir en el navegador.

Referencias: `docs/references/radev/`. Cuando una referencia contradice estas reglas, mandan las reglas.

## 8. Preset `soft` — tokens iniciales de Lumus

**Personalidad**: calma y premium (referencias: Linear, Arc, Raycast, Apple). **El color señaliza, no decora.** Branding original: `seeds/brands/lumus/assets/BRANDING-original.txt`.

### Tokens (valores del seed de Lumus)

| Token | Valor | Uso |
|---|---|---|
| `colors.bg` | `#0B0B12` | Fondo |
| `colors.surface` | `#171620` | Tarjetas |
| `colors.elevated` | `#1D1B28` | Cajas destacadas |
| `colors.line` | `#2E2B3D` | Bordes y divisores |
| `colors.text` | `#F0EDF7` | Títulos |
| `colors.secondary` | `#C8C4D7` | Apoyo |
| `colors.muted` | `#8F8B9E` | Etiquetas y fuentes de datos |
| `colors.accent` | `#BDB4FF` | Énfasis principal |
| `colors.wordmark` | `#E4DFFF` | Nombre de la marca |
| `colors.accent2` | `#FFB86E` | Segundo acento, uso mínimo |
| `colors.positive` / `colors.negative` | `#22C55E` / `#EF4444` | Solo en datos |
| `glass` | fondo `rgba(24,23,34,0.68)`, borde `rgba(255,255,255,0.08)`, borde superior `rgba(255,255,255,0.14)` | Paneles |
| `glows` | lavanda `rgba(189,180,255,0.08)` arriba-izq · durazno `rgba(255,184,110,0.045)` arriba-der | Fondo |
| `fonts.display` | Hanken Grotesk 600–700 | Títulos |
| `fonts.body` | Geist Sans 400 | Texto |
| `fonts.numeric` | Geist Mono 500 | Cifras y gráficos |
| `radius.card` / `radius.panel` | 12 / 16 | Botones pill |
| `wordmark` | `{ text: "LUMUS", tracking: 0.18 }` | Tracking en em |
| `footer.url` | `gestorlumus.site` | |
| `heroAsset` | id de `brand_assets` → `lumus-orb.png` | Protagonista en `cover` y `cta` |
| `logoAsset` | id de `brand_assets` → `logoLumus.png` (192px; redibujar en SVG si se usa grande) | Se prefiere el wordmark |

### Comportamiento del preset (código)

- Títulos en oración normal (no mayúsculas), tracking -0.01em, interlineado 1.08, `balance`. Escala: 92 / 78 / 66 según el largo (hasta 24 y 48 caracteres); portada 108 / 92 / 80.
- Énfasis más medido que en `bold`: solo color de acento. En títulos, un énfasis de hasta 20 caracteres no se parte en dos líneas ("Tu plata, / por fin clara.").
- Etiquetas: mayúsculas, tracking 0.18em, color `muted`.
- Marco: wordmark arriba a la izquierda (`colors.wordmark`, tracking del token); abajo, `footer.url` a la izquierda y el indicador de página ("03 / 07", o "Deslizá →" en lavanda en la portada), en `fonts.numeric`. Sin líneas ni etiquetas de esquina.
- Decoraciones: glows radiales de los tokens, grilla sutil `rgba(255,255,255,0.025)` que se desvanece hacia abajo, hero asset en portada y cierre (nunca en slides de datos). Si la marca no tiene hero, ese espacio queda vacío.
- `cover`: kicker en acento, título, el hero (400 px) centrado en la slide con un halo de acento y el subtítulo abajo. `cta`: columna centrada en la slide (760 de ancho, dentro de `x < 930`): hero (260 px), título, subtítulo y botón.
- Tarjetas y paneles con estilo `glass` (sin brillo en los bordes). Las cajas destacadas (callout de `question`, total de `costBreakdown`, centro de `hubDiagram`) usan `elevated`. Íconos sobre un cuadrado redondeado con un tinte suave; en acento los de destino o destacados. Botón de `cta`: pill con fondo `text` y texto `bg`.
- Conectores de diagramas: 1,5 px en acento al 55 %, puntitos chicos en los extremos y flecha abierta. Misma geometría que `bold` (`presets/shared/layout.ts`).
- `comparison`: la columna derecha con borde teñido de acento y viñetas en acento. `steps`: números en círculos con tinte de acento, unidos por una línea fina en `line`.
- Cifras: tablas y gráficos en `fonts.numeric`; la cifra enorme de `bigNumber`, en `fonts.display` con dígitos tabulares (Geist Mono tacha el cero y a ese tamaño domina la slide).
- Gráficos: línea en acento, área con degradado suave, grilla en `line`, valores en `fonts.numeric`, último valor en una pill `elevated`.
- Toda slide con datos muestra su `source` en `muted`.

## 9. Control de calidad del render

1. **Desborde**: ningún elemento `data-qa="text"` con overflow.
2. **Zona segura**: ningún elemento `data-qa="content"` fuera de la zona segura.
3. **Fuentes y assets cargados**: se espera `document.fonts.ready` y la carga de imágenes; si algo falla, el render falla.
4. **Contraste mínimo** entre `text` y `bg` en el editor de identidad: advertencia (no bloquea) si queda debajo de 4,5:1 (WCAG AA; `contrastRatio` en `packages/core`).
5. **Énfasis**: máximo 2 por slide (validado en el schema).
