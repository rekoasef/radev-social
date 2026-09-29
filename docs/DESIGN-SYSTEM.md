# Design System — Carruseles

Reglas visuales escritas para que el código las cumpla siempre. El carrusel número 300 tiene que verse tan de la marca como el primero.

## 1. Principios

Aplican a todas las marcas:

- Estética editorial tecnológica, **premium y minimalista**.
- **Mucho espacio negativo.** Tipografía fuerte y composición limpia.
- **Sin personas, sin fotos, sin ilustraciones infantiles, sin 3D innecesario.** Las plantillas solo aceptan íconos (Lucide), diagramas propios y assets de la marca.
- **Layout consistente dentro de un carrusel**: todas sus slides comparten estilo (en `studio`, el look del post). **Entre posts, variedad**: con `studio` cada post tiene su look (§10, ADR 0015).
- Lo que en un prompt de IA era un deseo, acá es una restricción del código.

## 2. Presets y tokens: qué es código y qué es dato

Una identidad visual = **preset de estilo** (código) + **tokens** (datos editables en el panel).

- El **preset** define la personalidad: cómo se ven las tarjetas, qué decoraciones existen y cómo se ubican, comportamiento tipográfico (mayúsculas, interlineados), estilo del énfasis, componentes de encabezado y pie. Vive en `packages/slides/presets/<preset>/`.
- Los **tokens** son los valores que el preset expone para configurar: colores, tipografías, radios, textos, assets, intensidades. Viven en `brands.theme_tokens` (JSON) y se editan desde el panel con vista previa en vivo.
- Cada preset exporta un **schema Zod de sus tokens** (con valores por defecto neutros: los de cada marca viven en la base). Los assets se guardan como id de `brand_assets`. El panel genera el formulario desde ese schema y valida todo lo que se guarda.
- Las plantillas nunca usan colores ni fuentes literales: consumen el preset y los tokens vía CSS variables.
- **Marca nueva = elegir preset + cargar tokens y assets. Cero código.** Un estilo visual completamente distinto = un preset nuevo (código), que queda disponible para todas las marcas.

### Tipografías disponibles (lista curada)
Todas libres, auto-hospedadas en el proyecto (no se cargan de internet al renderizar): Inter, Inter Tight, Hanken Grotesk, Geist Sans, Geist Mono, Space Grotesk, Manrope, DM Sans, JetBrains Mono y Fraunces (serif, con itálicas; la usa el look `revista`). Vienen de paquetes `@fontsource-variable` (fuentes variables). Para sumar una: instalar su paquete en `packages/slides`, registrarla en `src/fonts/registry.ts` y `src/fonts/load.ts`, y correr `pnpm --filter @radev/slides fonts:measure` (mide el ancho de sus letras en cada peso: `src/fonts/metrics.json`).

- **Ancho de las tipografías**: los títulos se calculan con la tipografía de referencia de cada preset (Inter Tight 900 en `bold`, Hanken Grotesk 600 en `soft`). Si la marca elige una más ancha, el título se achica en la misma proporción (`--title-scale`, entre 0,7 y 1), así ocupa las líneas previstas. Probado con las 9 tipografías en los dos presets y los 12 tipos, con textos normales y al límite (T12).
- **Monoespaciadas (Geist Mono, JetBrains Mono) como texto: no recomendadas.** Son un 20–25 % más anchas: en `flow` con 4 nodos las etiquetas no entran ni al tamaño mínimo, y en algunos extremos el texto no entra. El editor de identidad lo avisa ("Probar con textos al límite"). Para cifras (`fonts.numeric` de `soft`) sí se usan.

### Presets de la v1

| Preset | Personalidad | Marca inicial |
|---|---|---|
| `bold` | Fuerte y directa: títulos enormes en mayúsculas, acento brillante, tarjetas con borde luminoso, lenguaje de workflows | RAdev |
| `soft` | Calma y premium: títulos en oración normal, mucho aire, paneles de vidrio, glows radiales, elemento protagonista (hero) | Lumus |
| `studio` | 16 looks sobre una paleta de 4 colores: cada post usa uno distinto (§10, ADR 0015) | RAdev (a pasar desde el panel) |

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

### Capas movibles (ADR 0013)

El contenido de cada slide se arma en hasta tres capas que el operador puede arrastrar en el editor: **título** (con su etiqueta), **contenido** (todo lo demás, como un bloque) y **elemento gráfico** (`heroAsset`, solo en las plantillas que lo usan). El campo opcional `layout` de la slide guarda cuánto se corrió cada una desde donde la pone la plantilla, y el tamaño del título (0,6–1,5: agranda la letra, las líneas se reacomodan) y del elemento gráfico (0,4–2). Encabezado, pie y decoraciones no se mueven.

- Las plantillas envuelven cada capa en `Layer` (`frame/layer.tsx`); `TemplateLayout` ya lo hace para título y contenido. Toda plantilla nueva tiene que tener al menos las capas título y contenido (hay test).
- El ajuste se aplica con `transform`: no mueve a las demás capas y el control del render (§9) mide la posición real.
- En el editor, las guías imantan al centro de la slide y a los márgenes seguros, y ninguna capa sale del área segura. La columna de TikTok no es un límite duro: si una capa queda debajo, el control del render lo marca.

## 5. Catálogo de slides

La estructura (campos) es común a todos los presets. Schemas en `packages/slides/src/content/`; límites centralizados en `limits.ts`, calibrados en la Fase 1 (T11) con los casos extremos de `content/extremes.ts`: cada slide con todos sus textos al límite pasa el control del render (§9) en los dos presets. Los límites cuentan caracteres **visibles** (sin los asteriscos del énfasis). Todo texto admite énfasis (§6) salvo que se indique. **No admiten énfasis** (texto plano, `*` prohibido): las etiquetas dentro de tarjetas, chips y nodos (`label`, `lead`), el `kicker` de `cover`, `value` y `source` de `bigNumber`, `source` de `chart`, los rangos y etiquetas de `costBreakdown`, `name` de `comparison` y `button` de `cta`. Los íconos son nombres de Lucide en kebab-case y se valida que existan.

### v1

**`cover`** — portada con el hook.
- `kicker?` (≤24, sin énfasis) · `title` (≤60) · `subtitle?` (≤90)

Las slides sin referencia (`statement`, `question`, `cta` y las demás) se diseñan en código con las reglas del preset y el operador las aprueba sobre capturas del render real.

**`statement`** — afirmación fuerte con apoyo.
- `title` (≤70) · `body?` (≤160) · `visual?`: `{ from: {icon, label≤16}, to: {icon, label≤16} }`

**`question`** — pregunta con caja de callout.
- `title` (≤80) · `callout`: `{ icon, lead≤30, text≤80 }`

**`cardGrid`** — grilla de tarjetas con ícono, **sin orden** entre ellas (opciones, ejemplos). Ref: `ref-cardgrid.png`
- `title` (≤60) · `intro?` (≤40) · `cards`: 3–6 × `{ icon, lead?≤14, label≤24 }` · `footer?` (≤80)
- `lead` es la línea liviana sobre la etiqueta ("una" → "automatización"): da los dos tonos de la referencia sin gastar énfasis.

**`flow`** — tarjetas unidas por conectores, **en orden** (un proceso, un recorrido). Refs: `ref-flow-1.png`, `ref-flow-2.png`
- `title` (≤60) · `nodes`: 3–5 × `{ icon, label≤22, palabras de hasta 16 letras }` · `body?` (≤180) · `closing?` (≤90)
- Las etiquetas no cortan palabras: con 4 nodos las tarjetas dejan ~164 px, y una palabra de más de 16 letras ("Internacionalización") no entra ni al tamaño mínimo. La validación la rechaza.
- Hasta 4 nodos: una fila (como `ref-flow-2`). 5 nodos: dos filas, 3 + 2 (como `ref-flow-1`), la segunda centrada. Las dos filas se leen de izquierda a derecha: el conector sale de abajo del tercer nodo, cruza por el espacio entre filas y entra por arriba al cuarto.
- A diferencia de `steps`, los nodos no llevan texto propio: el recorrido se entiende de un vistazo.

**`hubDiagram`** — fuentes que confluyen en un centro. Ref: `ref-hubdiagram.png`
- `title` (≤60) · `nodes`: 3–6 × `{ icon, label≤16 }` · `center`: `{ icon }` · `body?` (≤180) · `closing?` (≤70)

**`comparison`** — X contra Y.
- `title` (≤60) · `left` / `right`: `{ name≤18, icon?, points: 2–4 × ≤40 }` · `verdict` (≤90)
- `right` es la opción hacia la que se inclina el veredicto: el preset la destaca. Si ninguna gana, el veredicto lo dice igual; va a la derecha la que se recomienda en la mayoría de los casos.

**`costBreakdown`** — desglose de costos (serie "¿Cuánto cuesta realmente...?").
- `title` (≤60) · `items`: 3–6 × `{ label≤30, range≤20 }` · `total`: `{ label≤20, range≤24 }` · `note?` (≤100)
- Rangos **solo** del documento de precios de la marca, copiados tal cual: en la generación con IA se valida en código (Fase 3, T10).

**`steps`** — pasos numerados.
- `title` (≤60) · `steps`: 3–5 × `{ title≤32, text≤90 }`

**`bigNumber`** — cifra enorme con contexto.
- `kicker?` (≤30) · `value` (≤10, sin énfasis) · `label` (≤80) · `context?` (≤140) · `source` (≤90, obligatorio)
- `value` debe existir en `data.json` (`figures`, se controla al validar); nunca inventado. La `source` la pone el código (la de la cifra).

**`chart`** — gráfico simple de líneas o barras en SVG.
- `title` (≤60) · `kind`: `line` | `bar` · `datasetRef` · `caption?` (≤100) · `source` (≤90)
- La IA elige el dataset; los puntos los inyecta el código. Cada dataset (`chartDatasetSchema`) tiene `unit?`, `unitPosition` y 2–60 puntos `{ label≤10, value }`. El render recibe los datasets **congelados en la versión** (`post_versions.datasets`: un render nuevo dibuja los mismos números con los que se escribió el texto); si falta el de `datasetRef`, falla (nunca se dibuja un gráfico sin datos reales). La `source` la pone el código (la del dataset).
- Números con "." de miles y "," decimal (`formatNumber`, sin `Intl` para no depender del runtime). Sin decimales si todos los valores son enteros o desde 100; nunca más decimales que los que traen los datos (1,4 → "1,4", no "1,40").

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
- `costBreakdown`: con 5 o 6 filas, letra y espaciado más chicos, para que cada fila siga en una línea con tipografías anchas. Filas concepto / rango separadas por líneas finas, rangos en `fonts.label` 700 con números tabulares; el total en una caja destacada (radio `callout`) con el rango grande en acento. La nota, chica abajo.
- `steps`: badges cuadrados "01", "02"… en acento, unidos por un riel vertical; título del paso en 700 y texto en apoyo.
- `bigNumber`: la cifra enorme en acento con brillo, en una línea (el tamaño se ajusta al largo, hasta 260 px); etiqueta en 600, contexto y fuente.
- `chart`: SVG propio. Grilla punteada en `line`, ejes en `muted`. Línea en acento con brillo y área con degradado; barras en acento al 42 % salvo la última, sólida. El último valor va en una etiqueta en acento. Con ≤ 8 puntos se rotulan todos; si hay más, el primero, el del medio y el último.
- Toda slide con datos (`bigNumber`, `chart`) muestra "Fuente: …" en `muted`.
- Tamaño del título: el más grande de 100 / 84 / 70 / 60 con el que entra en 3 líneas a 920 de ancho (portada: 124 / 104 / 88 / 76 / 66 en 4 líneas a 850). Se estima simulando el corte entre palabras con anchos de letra medidos en el navegador (Inter Tight 900 en mayúsculas: 0,64 em por letra con margen), así una palabra larga pesa más que la cuenta de caracteres. Una palabra que no entra en la línea obliga a bajar el tamaño.
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

- Títulos en oración normal (no mayúsculas), tracking -0.01em, interlineado 1.08, `balance`. Tamaño: el más grande de 92 / 78 / 66 / 58 que entra en 3 líneas (portada: 108 / 92 / 80 / 70 / 62 en 4 líneas), con la misma estimación que `bold` (Hanken Grotesk: 0,47 em por letra).
- El hero se achica (hasta 400 px en la portada, 260 en el cierre) cuando título y subtítulo ocupan mucho, en vez de empujarlos fuera del área segura.
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

1. **Desborde**: ningún `data-qa="text"` con overflow ni fuera de su caja (`data-qa="content"`).
2. **Zona segura**: ningún `data-qa="content"` ni `data-qa="text"` fuera del área segura o debajo de la columna de botones de TikTok.

Hacia abajo se toleran hasta media altura de letra: la caja de algunas fuentes (Manrope, DM Sans) pasa unos píxeles el interlineado sin cortar nada; una línea de más sí es un desborde. A lo ancho, cualquier píxel cuenta.

**Antes** de los puntos 1 y 2, en `studio`, el ajuste de densidad (`fitSlide`, `packages/slides/src/fit.ts`) achica con `zoom` el bloque de contenido que no entra (pasos de 0,04, hasta 0,6, con 28 px de tolerancia para piezas rotadas y sombras) y el texto se reacomoda. Si ni al mínimo entra, el control lo marca igual.

Los puntos 1 y 2 los hace `checkRender` (`packages/slides/src/qa.ts`), autocontenida para poder pasarla a Playwright tal cual. La usan la preview (`?qa=1` marca y lista los problemas), `pnpm capture --check`, el editor de identidad (aviso bajo la vista previa, con la opción de probar textos al límite) y, desde la Fase 2, el render del worker.
3. **Fuentes y assets cargados**: se espera `document.fonts.ready` y la carga de imágenes; si algo falla, el render falla.
4. **Contraste mínimo** entre `text` y `bg` en el editor de identidad: advertencia (no bloquea) si queda debajo de 4,5:1 (WCAG AA; `contrastRatio` en `packages/core`).
5. **Énfasis**: máximo 2 por slide (validado en el schema).
6. **Capas encimadas** (solo en el editor, ADR 0013): si una capa movida a mano queda encima de otra, aviso bajo la vista previa. Mide líneas de texto, cajas con fondo o borde e imágenes sin su margen transparente. No bloquea ni hace fallar el render (`checkRender(frame, mark, { overlap: true })`).

## 10. Preset `studio` — looks por post

ADR 0015. Una paleta de marca, 16 direcciones de arte en código, una por post.

### Tokens

| Token | Uso |
|---|---|
| `colors.ink` / `colors.paper` | Oscuro y claro: fondo o texto según la superficie |
| `colors.accent` | Énfasis, números, botones; fondo de las slides de acento |
| `colors.glow` | Segundo acento para luces y degradados (atmósfera, neón, gradiente, bauhaus) |
| `fonts.display` / `body` / `mono` / `serif` | Títulos, texto, datos y etiquetas, títulos serif (revista) |
| `wordmark` (`text`, `dot`) · `logoAsset` · `handle.site` | Firma (el logo reemplaza al wordmark) |
| `looks.<id>` | Qué looks usa la marca (al menos uno) |
| `heroAsset` · `heroAlways` | Elemento de marca (la orbe de Lumus): en portada y cierre de los looks con imagen cuando el post no tiene imagen generada; con `heroAlways`, siempre y sin imágenes generadas |

Valores de RAdev (sugeridos, se cargan en el panel): ink `#0B0B0B`, paper `#EFECE6`, accent `#FF7A00`, glow `#7C3AED`.

### Superficies

Cada slide cae en una superficie: `ink` (fondo oscuro, texto claro), `paper` (al revés) o `accent` (fondo de acento, texto oscuro; el énfasis pasa a oscuro). El look decide la superficie según la posición (portada y cierre fijos, el medio con un ritmo) y las slides de datos nunca caen en `accent`. El marco convierte la superficie en variables CSS (`--bg`, `--fg`, `--hl`, `--muted`, `--line`, `--panel`); plantillas y looks solo leen esas variables. Una pieza sobre otro color (una tarjeta naranja en una slide negra) usa `onSurface`.

### Kit de un look

`packages/slides/src/presets/studio/kit.tsx` (tipo `Look`): tipografía del título (fuente, peso, mayúsculas, tracking, interlineado), `surface`, `Backdrop` (fondo a sangre: grillas, luces, texturas), `Header`, `Footer`, `emphasis`, `Panel` (recuadros; `strong` = destacado), `List` (pasos, tarjetas, nodos), `Button`, `Decor` (elementos grandes por tipo: un "?" gigante, un sticker), `vars` (variables propias, ej. monocromo sin acento), `wrapTitle` (ej. el título en una burbuja de chat) y `compose` (cómo se ordenan portada, pregunta y cierre).

Las plantillas (`templates.tsx`) son comunes: una por tipo de slide, con las capas título y contenido (ADR 0013) y los textos marcados para el control del render. Las slides de listas y datos se centran en vertical como grupo (sin franja vacía en el medio). Tamaños de título por rol (`hero`, `statement`, `title`, `small`), estimados con las métricas de la fuente (§2).

### Catálogo

| Look | Qué es | Para qué (lo lee la IA) |
|---|---|---|
| `editorial` | Papel y tinta, títulos enormes, listas con filetes, fondos que alternan | Reflexiones, opiniones, temas serios |
| `bloques` | Color a sangre, mayúsculas gigantes, sticker, tarjetas de colores | Hooks fuertes, advertencias, errores |
| `atmosfera` | Luces difusas en panorama continuo, grano, vidrio, aro protagonista | Aspiracional, visión, tecnología |
| `plano` | Grilla, cruces, tablas con casillas, rótulo de plano | Procesos, arquitecturas, checklists |
| `terminal` | Ventanas de editor, prompt, el CTA como comando | Técnico, desarrollo, seguridad, IA |
| `recorte` | Papel rasgado, cinta, resaltador, notas rotadas | Historias, detrás de escena, casos |
| `suizo` | Grilla estricta, barra de acento, números de sección gigantes | Guías ordenadas, listas |
| `revista` | Serif con itálicas, cabecera con filete doble, números romanos | Ensayos, tendencias |
| `neon` | Trazos que brillan, grilla retro en perspectiva | Novedades, trucos, curiosidades |
| `monocromo` | Solo blanco y negro, centrado, énfasis subrayado | Frases fuertes, mitos |
| `bauhaus` | Círculos, semicírculos, triángulos en color plano | Conceptos, comparaciones |
| `recibo` | Ticket con bordes dentados, mono, renglones punteados, código de barras | Costos, precios, presupuestos |
| `chat` | Barra de contacto, burbujas, el CTA como caja de mensaje | WhatsApp, atención, preguntas frecuentes |
| `documento` | Página sobre escritorio, casillas, resaltados, callouts | Planes, procesos internos, productividad |
| `gradiente` | Nubes de color claras, tarjetas blancas, botón con degradé | Beneficios, primeros pasos, educación |
| `brutalista` | Bordes gruesos, sombras duras, resaltado invertido | Opiniones filosas, comparaciones sin filtro |

La descripción que lee la IA es `LOOK_GUIDE` (`look-ids.ts`).

### Elección del look

- La IA lo elige entre los activos de la marca menos los de los **2** últimos posts (`lookChoices`, `LOOK_COOLDOWN`); una revisión conserva el suyo. Se valida con Zod.
- El editor del post tiene un selector de look; la galería de la marca (Marcas → Slides) muestra cada look activo.
- Sin `look` guardado, se toma uno de los activos por el id del post (`resolveLook`): siempre el mismo para ese post.

### Imágenes generadas (ADR 0016)

- Looks con imagen (`LOOK_ART`): atmósfera, neón, gradiente, revista, editorial y monocromo; solo en **portada y cierre**. El fondo que se le pide al modelo es el de la superficie de esa slide (oscura → negro puro, clara → blanco puro).
- Con imagen, la portada pone el objeto arriba y el título abajo (tamaño `title`); el cierre baja su contenido (`low`) y su título a `title`. La imagen reemplaza la decoración propia del look en esa slide.
- Se dibuja a 760 px (portada) o 520 px (cierre), centrada, con mezcla `screen` (oscuro) o `multiply` con un leve aumento de brillo (claro, para que el "blanco" del modelo desaparezca), máscara radial que desvanece los bordes y escala de grises en monocromo. Es la capa "elemento gráfico": se mueve y escala en el editor.
- Reglas del objeto: uno solo, sin personas, caras ni manos, sin nada con texto (carteles, pantallas, libros, gráficos). Lo controla el esquema.
- Prioridad en portada y cierre: imagen generada del post → elemento de marca (`heroAsset`, dibujado tal cual: 420 px en portada, 280 en cierre, sin mezcla) → decoración propia del look. Con `heroAlways`, el elemento de marca siempre y la IA no describe imágenes (`brandMakesArt`).
- Valores de Lumus en `studio` (2026-09-29): ink `#0B0B12`, paper `#F0EDF7`, accent `#6E5CE8` (el lavanda `#BDB4FF` daba 1,6:1 sobre el claro; `#6E5CE8` da 4,2:1 sobre claro y 4,1:1 sobre oscuro), glow `#FFB86E`, Hanken Grotesk 600 / Geist Sans / Geist Mono; looks sin bloques, brutalista, neón, terminal ni bauhaus; la orbe como elemento de marca.
- Previsualizar: `pnpm --filter @radev/slides preview <dir> --art-dir <carpeta>` (y `--hero <png>` para el elemento de marca) con `cover-dark.jpg`, `cover-light.jpg`, `cta-dark.jpg` y `cta-light.jpg`.

### Sumar un look

1. Agregar el id, el nombre y la guía en `look-ids.ts`.
2. Escribir el kit en `looks/<id>.tsx` y registrarlo en `looks/index.ts`.
3. `pnpm --filter @radev/slides preview <dir> --tokens <paleta.json> --looks <id> --set examples` y `--set extremes`: tiene que dar 0 problemas.
4. Capturas para aprobar (un carrusel real). Los tests de `studio.test.tsx` recorren todos los looks solos.

