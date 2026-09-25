import { limits as L } from "./limits";
import type { Slide, SlideType } from "./slides";

// The editor's form for each slide type, as data (phase 2, T3): what fields a slide has, in
// order, with their labels and limits. A test checks it against the Zod schemas, so the form and
// the validation never drift apart. The schemas stay the source of truth.

export type FieldSpec = { key: string; label: string; optional?: boolean } & (
  | { kind: "text"; max: number; emphasis: boolean; multiline?: boolean; hint?: string }
  | { kind: "icon" }
  /** One of a fixed set of values; the first one is the default. */
  | { kind: "choice"; options: readonly { value: string; label: string }[] }
  /** A dataset of the brand's data, by key (the editor lists them). */
  | { kind: "dataset" }
  | { kind: "object"; fields: FieldSpec[] }
  | {
      kind: "list";
      min: number;
      max: number;
      itemLabel: string;
      /** Fields of each item, or "rich" for a list of texts of up to `itemMax` characters. */
      item: FieldSpec[] | "rich";
      itemMax?: number;
    }
);

const text = (
  key: string,
  label: string,
  max: number,
  extra: Partial<Extract<FieldSpec, { kind: "text" }>> & { optional?: boolean } = {},
): FieldSpec => ({
  key,
  label,
  kind: "text",
  max,
  emphasis: true,
  ...extra,
});
const plain = (
  key: string,
  label: string,
  max: number,
  extra: { optional?: boolean; hint?: string } = {},
): FieldSpec => ({
  key,
  label,
  kind: "text",
  max,
  emphasis: false,
  ...extra,
});
const icon = (key = "icon", label = "Ícono", optional = false): FieldSpec => ({
  key,
  label,
  kind: "icon",
  optional,
});

export const SLIDE_LABELS: Record<SlideType, string> = {
  cover: "Portada",
  statement: "Afirmación",
  question: "Pregunta",
  cardGrid: "Tarjetas",
  flow: "Recorrido",
  hubDiagram: "Diagrama",
  comparison: "Comparación",
  costBreakdown: "Costos",
  steps: "Pasos",
  bigNumber: "Número",
  chart: "Gráfico",
  cta: "Cierre",
};

export const SLIDE_FIELDS: Record<SlideType, FieldSpec[]> = {
  cover: [
    plain("kicker", "Antetítulo", L.cover.kicker, { optional: true }),
    text("title", "Título", L.cover.title),
    text("subtitle", "Subtítulo", L.cover.subtitle, { optional: true }),
  ],
  statement: [
    text("title", "Título", L.statement.title),
    text("body", "Texto", L.statement.body, { optional: true, multiline: true }),
    {
      key: "visual",
      label: "De → a",
      kind: "object",
      optional: true,
      fields: [
        {
          key: "from",
          label: "Desde",
          kind: "object",
          fields: [icon(), plain("label", "Etiqueta", L.statement.visualLabel)],
        },
        {
          key: "to",
          label: "Hacia",
          kind: "object",
          fields: [icon(), plain("label", "Etiqueta", L.statement.visualLabel)],
        },
      ],
    },
  ],
  question: [
    text("title", "Pregunta", L.question.title),
    {
      key: "callout",
      label: "Caja destacada",
      kind: "object",
      fields: [
        icon(),
        text("lead", "Entrada (en negrita)", L.question.calloutLead),
        text("text", "Texto", L.question.calloutText),
      ],
    },
  ],
  cardGrid: [
    text("title", "Título", L.cardGrid.title),
    text("intro", "Introducción", L.cardGrid.intro, { optional: true }),
    {
      key: "cards",
      label: "Tarjetas",
      kind: "list",
      min: L.cardGrid.cards.min,
      max: L.cardGrid.cards.max,
      itemLabel: "Tarjeta",
      item: [
        icon(),
        plain("lead", "Bajada liviana", L.cardGrid.cardLead, {
          optional: true,
          hint: "Ej.: “una”",
        }),
        plain("label", "Etiqueta", L.cardGrid.cardLabel),
      ],
    },
    text("footer", "Cierre", L.cardGrid.footer, { optional: true }),
  ],
  flow: [
    text("title", "Título", L.flow.title),
    {
      key: "nodes",
      label: "Pasos del recorrido",
      kind: "list",
      min: L.flow.nodes.min,
      max: L.flow.nodes.max,
      itemLabel: "Paso",
      item: [
        icon(),
        plain("label", "Etiqueta", L.flow.nodeLabel, {
          hint: `Palabras de hasta ${L.flow.nodeWord} letras`,
        }),
      ],
    },
    text("body", "Texto", L.flow.body, { optional: true, multiline: true }),
    text("closing", "Cierre", L.flow.closing, { optional: true }),
  ],
  hubDiagram: [
    text("title", "Título", L.hubDiagram.title),
    {
      key: "nodes",
      label: "Fuentes",
      kind: "list",
      min: L.hubDiagram.nodes.min,
      max: L.hubDiagram.nodes.max,
      itemLabel: "Fuente",
      item: [icon(), plain("label", "Etiqueta", L.hubDiagram.nodeLabel)],
    },
    { key: "center", label: "Centro", kind: "object", fields: [icon()] },
    text("body", "Texto", L.hubDiagram.body, { optional: true, multiline: true }),
    text("closing", "Cierre", L.hubDiagram.closing, { optional: true }),
  ],
  comparison: [
    text("title", "Título", L.comparison.title),
    ...(["left", "right"] as const).map(
      (side): FieldSpec => ({
        key: side,
        label: side === "left" ? "Opción A (izquierda)" : "Opción B (derecha, la que se destaca)",
        kind: "object",
        fields: [
          plain("name", "Nombre", L.comparison.name),
          icon("icon", "Ícono", true),
          {
            key: "points",
            label: "Puntos",
            kind: "list",
            min: L.comparison.points.min,
            max: L.comparison.points.max,
            itemLabel: "Punto",
            item: "rich",
            itemMax: L.comparison.point,
          },
        ],
      }),
    ),
    text("verdict", "Veredicto", L.comparison.verdict),
  ],
  costBreakdown: [
    text("title", "Título", L.costBreakdown.title),
    {
      key: "items",
      label: "Conceptos",
      kind: "list",
      min: L.costBreakdown.items.min,
      max: L.costBreakdown.items.max,
      itemLabel: "Concepto",
      item: [
        plain("label", "Concepto", L.costBreakdown.itemLabel),
        plain("range", "Rango", L.costBreakdown.itemRange, {
          hint: "Solo del documento de precios",
        }),
      ],
    },
    {
      key: "total",
      label: "Total",
      kind: "object",
      fields: [
        plain("label", "Etiqueta", L.costBreakdown.totalLabel),
        plain("range", "Rango", L.costBreakdown.totalRange),
      ],
    },
    text("note", "Nota", L.costBreakdown.note, { optional: true }),
  ],
  steps: [
    text("title", "Título", L.steps.title),
    {
      key: "steps",
      label: "Pasos",
      kind: "list",
      min: L.steps.steps.min,
      max: L.steps.steps.max,
      itemLabel: "Paso",
      item: [
        text("title", "Título del paso", L.steps.stepTitle),
        text("text", "Texto", L.steps.stepText),
      ],
    },
  ],
  bigNumber: [
    text("kicker", "Antetítulo", L.bigNumber.kicker, { optional: true }),
    plain("value", "Cifra", L.bigNumber.value, { hint: "Un dato real, con su fuente" }),
    text("label", "Qué es", L.bigNumber.label),
    text("context", "Contexto", L.bigNumber.context, { optional: true, multiline: true }),
    plain("source", "Fuente", L.bigNumber.source),
  ],
  chart: [
    text("title", "Título", L.chart.title),
    {
      key: "kind",
      label: "Tipo de gráfico",
      kind: "choice",
      options: [
        { value: "line", label: "Líneas" },
        { value: "bar", label: "Barras" },
      ],
    },
    { key: "datasetRef", label: "Datos", kind: "dataset" },
    text("caption", "Epígrafe", L.chart.caption, { optional: true }),
    plain("source", "Fuente", L.chart.source),
  ],
  cta: [
    text("title", "Título", L.cta.title),
    text("subtitle", "Subtítulo", L.cta.subtitle, { optional: true }),
    plain("button", "Botón", L.cta.button),
    icon("icon", "Ícono del botón", true),
  ],
};

/**
 * Types the manual editor offers. `cover` and `cta` are always the first and last slides; `chart`
 * only for a brand with data (the editor leaves it out otherwise).
 */
export const EDITOR_MIDDLE_TYPES: readonly SlideType[] = [
  "statement",
  "question",
  "cardGrid",
  "flow",
  "hubDiagram",
  "comparison",
  "costBreakdown",
  "steps",
  "bigNumber",
  "chart",
];

function emptyValue(field: FieldSpec): unknown {
  if (field.optional) return undefined;
  switch (field.kind) {
    case "text":
      return "";
    case "icon":
      return "circle";
    case "choice":
      return field.options[0]?.value ?? "";
    case "dataset":
      return "";
    case "object":
      return emptyObject(field.fields);
    case "list":
      return Array.from({ length: field.min }, () =>
        field.item === "rich" ? "" : emptyObject(field.item as FieldSpec[]),
      );
  }
}

function emptyObject(fields: FieldSpec[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    const value = emptyValue(field);
    if (value !== undefined) out[field.key] = value;
  }
  return out;
}

/** A new slide of a type: required texts empty, lists at their minimum, icons "circle". */
export function emptySlide(type: SlideType): Slide {
  return { type, ...emptyObject(SLIDE_FIELDS[type]) } as Slide;
}

/** An empty value for one field (the editor uses it when an optional field is turned on). */
export function emptyField(field: FieldSpec): unknown {
  return emptyValue({ ...field, optional: false } as FieldSpec);
}
