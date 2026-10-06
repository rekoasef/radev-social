import type { Carousel } from "./carousel";
import type { Datasets } from "./datasets";
import { SAMPLE_SCREENS } from "./screens";
import type { SlideOf, SlideType } from "./slides";

// Sample content for previews and tests. Texts from docs/references/radev/ where one exists.
// Figures are placeholders, flagged as such: real ones come from brand data (CLAUDE.md, rule 9).

export const exampleSlides: { [T in SlideType]: SlideOf<T> } = {
  cover: {
    type: "cover",
    kicker: "Serie · Costos",
    title: "¿Cuánto cuesta *realmente* tener una app?",
    subtitle: "Programarla no es el único costo.",
  },
  statement: {
    type: "statement",
    title: "Una app no se termina *el día que se lanza*.",
    body: "Después vienen el hosting, el dominio, los mails y el mantenimiento. Si no lo contás desde el principio, el presupuesto no cierra.",
    visual: {
      from: { icon: "code", label: "Desarrollo" },
      to: { icon: "server", label: "Operación" },
    },
  },
  question: {
    type: "question",
    title: "¿Cuánto tiempo perdés por día *buscando información*?",
    callout: {
      icon: "search",
      lead: "Pensalo así:",
      text: "cada búsqueda parece corta, pero sumadas se llevan un pedazo de tu día.",
    },
  },
  cardGrid: {
    type: "cardGrid",
    title: "No necesitás una app gigante *para mejorar esto.*",
    intro: "A veces alcanza con:",
    cards: [
      { icon: "settings", lead: "una", label: "automatización" },
      { icon: "chart-column", lead: "un", label: "dashboard" },
      { icon: "link", lead: "una", label: "integración" },
      { icon: "file-text", lead: "un", label: "sistema interno" },
      { icon: "globe", lead: "una web con", label: "funciones específicas" },
    ],
    footer: "*La solución depende del problema.* No al revés.",
  },
  flow: {
    type: "flow",
    title: "Respondés las *mismas preguntas* una y otra vez.",
    nodes: [
      { icon: "clock", label: "Horarios" },
      { icon: "tag", label: "Precios" },
      { icon: "calendar", label: "Disponibilidad" },
      { icon: "box", label: "Estado de un pedido" },
      { icon: "file-text", label: "Información básica" },
    ],
    body: "No significa sacar a una persona del medio.\nSignifica evitar que empiece *desde cero* cada vez.",
  },
  hubDiagram: {
    type: "hubDiagram",
    title: "Tenés información repartida en *5 lugares.*",
    nodes: [
      { icon: "message-circle", label: "WhatsApp" },
      { icon: "sheet", label: "Excel" },
      { icon: "mail", label: "Mail" },
      { icon: "sticky-note", label: "Nota" },
      { icon: "settings", label: "Otro sistema" },
    ],
    center: { icon: "database" },
    body: "Un dato en WhatsApp.\nOtro en Excel.\nOtro en un mail.\nOtro en una nota.\n\nY cuando necesitás encontrar algo: hay que empezar a buscar.",
    closing: "*Centralizar* también es automatizar mejor.",
  },
  comparison: {
    type: "comparison",
    title: "¿Excel o *sistema propio*?",
    left: {
      name: "Excel",
      icon: "sheet",
      points: ["Arrancás hoy mismo", "Depende de quien lo armó", "Se complica al crecer"],
    },
    right: {
      name: "Sistema propio",
      icon: "database",
      points: ["Lleva unas semanas", "Reglas claras para todos", "Crece con el negocio"],
    },
    verdict: "Excel sirve para empezar. Cuando el equipo crece, *un sistema ordena*.",
  },
  costBreakdown: {
    type: "costBreakdown",
    title: "¿Cuánto cuesta *mantener* una app?",
    items: [
      { label: "Hosting", range: "USD 0–00" },
      { label: "Dominio", range: "USD 0–00" },
      { label: "Mails transaccionales", range: "USD 0–00" },
      { label: "Mantenimiento", range: "a medida" },
    ],
    total: { label: "Total mensual", range: "USD 00–000" },
    note: "Valores de ejemplo: los reales salen del documento de precios de la marca.",
  },
  steps: {
    type: "steps",
    title: "Cómo *automatizar* un proceso",
    steps: [
      {
        title: "Mapear",
        text: "Escribir cómo se hace hoy, paso a paso, quién lo hace y con qué herramienta.",
      },
      { title: "Simplificar", text: "Sacar lo que no suma antes de automatizar nada." },
      {
        title: "Automatizar",
        text: "Conectar las herramientas para que lo repetitivo se haga solo.",
      },
    ],
  },
  bigNumber: {
    type: "bigNumber",
    kicker: "Dato de ejemplo",
    value: "0.000",
    label: "pesos por dólar *blue*",
    context: "Cifra de relleno para la preview: la real sale de los datos de la marca.",
    source: "Bluelytics (ejemplo)",
  },
  chart: {
    type: "chart",
    title: "Cómo se movió *el dólar*",
    kind: "line",
    datasetRef: "usd-blue-30d",
    caption: "Últimos 30 días.",
    source: "Bluelytics (ejemplo)",
  },
  screen: {
    type: "screen",
    title: "Los pedidos entran *solos* al sistema.",
    body: "El cliente completa el formulario y el pedido aparece ordenado, con su estado, sin copiar nada a mano.",
    screens: [SAMPLE_SCREENS.laptop],
  },
  cta: {
    type: "cta",
    title: "¿Querés ordenar *tus procesos*?",
    subtitle: "Contame qué hacés hoy a mano y vemos qué se puede automatizar.",
    button: "Escribime por WhatsApp",
    icon: "message-circle",
  },
};

/**
 * Sample content for the `soft` preset, on personal money (the topics of its first brand). Only
 * the types that differ; `bigNumber` and `chart` (the dollar) reuse `exampleSlides`. Same rule:
 * no real figures.
 */
const softOverrides: { [T in SlideType]?: SlideOf<T> } = {
  cover: {
    type: "cover",
    kicker: "Serie · Tu plata",
    title: "Ahorraste en pesos. ¿Cuánto ahorraste *de verdad*?",
    subtitle: "Lo que queda quieto pierde valor, aunque el número no cambie.",
  },
  statement: {
    type: "statement",
    title: "Tu sueldo no bajó. *Rinde menos.*",
    body: "Cuando los precios suben más rápido que tu sueldo, cobrás lo mismo pero comprás menos. Mirarlo en dólares ayuda a verlo claro.",
    visual: {
      from: { icon: "wallet", label: "Tu sueldo" },
      to: { icon: "shopping-cart", label: "Lo que comprás" },
    },
  },
  question: {
    type: "question",
    title: "¿Sabés en qué se te fue la plata *el mes pasado*?",
    callout: {
      icon: "receipt",
      lead: "Hacé la prueba:",
      text: "anotá de memoria tus gastos y compará con el resumen de la tarjeta.",
    },
  },
  cardGrid: {
    type: "cardGrid",
    title: "Los gastos que *no ves* también suman",
    intro: "Los más comunes:",
    cards: [
      { icon: "coffee", lead: "el", label: "café de todos los días" },
      { icon: "tv", lead: "las", label: "suscripciones olvidadas" },
      { icon: "bike", lead: "el", label: "delivery del finde" },
      { icon: "credit-card", lead: "las", label: "cuotas chicas" },
    ],
    footer: "Chicos por separado, *grandes a fin de mes.*",
  },
  flow: {
    type: "flow",
    title: "Cómo se arma *tu informe del mes*",
    nodes: [
      { icon: "pencil", label: "Cargás tus gastos" },
      { icon: "calculator", label: "Lumus hace las cuentas" },
      { icon: "sparkles", label: "La IA te lo explica" },
      { icon: "file-text", label: "Recibís el informe" },
    ],
    body: "Las cuentas las hace Lumus. La IA solo las explica: *nunca inventa una cifra*.",
  },
  hubDiagram: {
    type: "hubDiagram",
    title: "Tu plata está en *varios lados*",
    nodes: [
      { icon: "wallet", label: "Efectivo" },
      { icon: "landmark", label: "Cuenta sueldo" },
      { icon: "smartphone", label: "App de pagos" },
      { icon: "dollar-sign", label: "Dólares" },
      { icon: "credit-card", label: "Tarjeta" },
    ],
    center: { icon: "chart-pie" },
    body: "Cuando cada cosa está en un lugar distinto, es difícil saber cuánto tenés de verdad.",
    closing: "*Verlo junto* es el primer paso.",
  },
  comparison: {
    type: "comparison",
    title: "¿Planilla o *app de gastos*?",
    left: {
      name: "Planilla",
      icon: "sheet",
      points: ["La armás a tu medida", "Cargar lleva tiempo", "Las cuentas las hacés vos"],
    },
    right: {
      name: "App de gastos",
      icon: "smartphone",
      points: ["Cargás en segundos", "Te avisa si te pasás", "Hace las cuentas por vos"],
    },
    verdict: "La planilla sirve si sos constante. Si no, *una app te ahorra el esfuerzo*.",
  },
  costBreakdown: {
    type: "costBreakdown",
    title: "¿Cuánto te cuestan *los gastos fijos*?",
    items: [
      { label: "Alquiler", range: "$ 000.000" },
      { label: "Servicios", range: "$ 00.000" },
      { label: "Transporte", range: "$ 00.000" },
      { label: "Suscripciones", range: "$ 00.000" },
    ],
    total: { label: "Total del mes", range: "$ 000.000" },
    note: "Valores de ejemplo: los reales salen de tus datos.",
  },
  steps: {
    type: "steps",
    title: "Armá tu presupuesto *en 3 pasos*",
    steps: [
      {
        title: "Anotá lo que entra",
        text: "Sueldo, changas y cualquier ingreso del mes, en pesos y en dólares.",
      },
      { title: "Separá los fijos", text: "Alquiler, servicios y cuotas: lo que pagás sí o sí." },
      {
        title: "Poné un tope al resto",
        text: "Lo que queda se reparte con un límite por categoría, y te avisa si te pasás.",
      },
    ],
  },
  screen: {
    type: "screen",
    title: "Anotás el gasto *antes de guardar el ticket*.",
    body: "Monto, categoría y listo. Lo hacés en la fila del súper, sin abrir ninguna planilla.",
    screens: [SAMPLE_SCREENS.phone],
  },
  cta: {
    type: "cta",
    title: "Tu plata, *por fin clara.*",
    subtitle:
      "Cargá tus gastos en segundos y cada mes recibí un informe que te explica en qué se fue.",
    button: "Probalo gratis 30 días",
    icon: "arrow-right",
  },
};

/** Example slides for each preset, one per slide type. */
export const exampleSlidesByPreset = {
  bold: exampleSlides,
  soft: { ...exampleSlides, ...softOverrides } as typeof exampleSlides,
  studio: exampleSlides,
};

/**
 * Datasets for the example `chart`. Made-up values that only give the chart a shape: the real
 * ones come from the brand's data.
 */
export const exampleDatasets: Datasets = {
  "usd-blue-30d": {
    unit: "$",
    unitPosition: "before",
    points: Array.from({ length: 30 }, (_, i) => ({
      label: `Día ${i + 1}`,
      value: Math.round(1000 + 40 * Math.sin(i / 4) + 3 * i),
    })),
  },
};

export const exampleCarousel: Carousel = {
  hook: "No necesitás una app gigante para mejorar tus procesos",
  pillarKey: "automatizacion",
  hookType: "myth",
  slides: [
    exampleSlides.cover,
    exampleSlides.hubDiagram,
    exampleSlides.flow,
    exampleSlides.cardGrid,
    exampleSlides.steps,
    exampleSlides.cta,
  ],
  caption: "A veces la solución es más chica de lo que pensás. ¿Cuál de estas te sirve?",
  hashtags: ["automatizacion", "pymes", "procesos"],
};

/** Example carousel of the `soft` preset (personal money). */
export const softExampleCarousel: Carousel = {
  hook: "Tu plata está en varios lados y así es difícil saber cuánto tenés",
  pillarKey: "money-habits",
  hookType: "howto",
  slides: [
    exampleSlidesByPreset.soft.cover,
    exampleSlidesByPreset.soft.hubDiagram,
    exampleSlidesByPreset.soft.cardGrid,
    exampleSlidesByPreset.soft.steps,
    exampleSlidesByPreset.soft.bigNumber,
    exampleSlidesByPreset.soft.cta,
  ],
  caption:
    "Antes de ahorrar, hay que saber dónde está la plata. ¿Cuál de estos gastos te pasa a vos?",
  hashtags: ["finanzaspersonales", "ahorro", "presupuesto"],
};

/** Example carousel for each preset. */
export const exampleCarouselByPreset = {
  bold: exampleCarousel,
  soft: softExampleCarousel,
  studio: exampleCarousel,
};
