import type { Carousel } from "./carousel";
import type { Datasets } from "./datasets";
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
  cta: {
    type: "cta",
    title: "¿Querés ordenar *tus procesos*?",
    subtitle: "Contame qué hacés hoy a mano y vemos qué se puede automatizar.",
    button: "Escribime por WhatsApp",
    icon: "message-circle",
  },
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
