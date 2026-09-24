import { limits as L } from "./limits";
import type { SlideOf, SlideType } from "./slides";

// Worst cases for the render (phase 1, T11): every text at its limit, the most nodes or cards,
// and long words. Realistic Spanish words, not "MMMM": the goal is the longest content the AI or
// the operator could plausibly write. The render QA must pass all of them in every preset.

const WORDS = [
  "información",
  "organización",
  "presupuesto",
  "mantenimiento",
  "comunicación",
  "herramientas",
  "administración",
  "automatización",
  "seguimiento",
  "planificación",
  "facturación",
  "rendimiento",
];

/**
 * Text with exactly `max` visible characters, from long words starting at `seed`. With
 * `emphasis`, the second and third words go between asterisks (they do not count).
 */
export function fillText(max: number, seed = 0, { emphasis = false, capital = true } = {}): string {
  const words: string[] = [];
  let length = 0;
  for (let i = seed; ; i++) {
    const word = WORDS[i % WORDS.length] as string;
    const extra = words.length === 0 ? word.length : word.length + 1;
    if (length + extra > max) break;
    words.push(word);
    length += extra;
  }
  // Fill up to exactly `max` with the start of the next word (or letters, for tiny limits).
  const missing = max - length - (words.length > 0 ? 1 : 0);
  if (missing > 0)
    words.push((WORDS[(seed + words.length) % WORDS.length] as string).slice(0, missing));
  else if (words.length === 0) words.push("a".repeat(max));
  if (capital && words[0]) words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  if (emphasis && words.length >= 3) {
    words[1] = `*${words[1]}`;
    words[2] = `${words[2]}*`;
  }
  return words.join(" ");
}

const t = fillText;

/** One worst case per slide type (validated against the schemas in the tests). */
export const extremeSlides: { [T in SlideType]: SlideOf<T> } = {
  cover: {
    type: "cover",
    kicker: t(L.cover.kicker, 1),
    title: t(L.cover.title, 0, { emphasis: true }),
    subtitle: t(L.cover.subtitle, 3, { emphasis: true }),
  },
  statement: {
    type: "statement",
    title: t(L.statement.title, 0, { emphasis: true }),
    body: t(L.statement.body, 4, { emphasis: true }),
    visual: {
      from: { icon: "code", label: t(L.statement.visualLabel, 1) },
      to: { icon: "server", label: t(L.statement.visualLabel, 7) },
    },
  },
  question: {
    type: "question",
    title: `${t(L.question.title - 1, 0, { emphasis: true })}?`,
    callout: {
      icon: "search",
      lead: t(L.question.calloutLead, 5),
      text: t(L.question.calloutText, 6, { emphasis: true, capital: false }),
    },
  },
  cardGrid: {
    type: "cardGrid",
    title: t(L.cardGrid.title, 0, { emphasis: true }),
    intro: t(L.cardGrid.intro, 2),
    cards: Array.from({ length: L.cardGrid.cards.max }, (_, i) => ({
      icon: "settings",
      lead: t(L.cardGrid.cardLead, i + 3),
      label: t(L.cardGrid.cardLabel, i),
    })),
    footer: t(L.cardGrid.footer, 5, { emphasis: true }),
  },
  flow: {
    type: "flow",
    title: t(L.flow.title, 0, { emphasis: true }),
    // Four nodes: the narrowest cards (one row), the worst case for long words.
    nodes: [
      // The longest word allowed (limits.flow.nodeWord).
      { icon: "clock", label: "Comercialización" },
      ...Array.from({ length: 3 }, (_, i) => ({
        icon: "file-text",
        label: t(L.flow.nodeLabel, i + 1),
      })),
    ],
    body: t(L.flow.body, 2, { emphasis: true }),
    closing: t(L.flow.closing, 6),
  },
  hubDiagram: {
    type: "hubDiagram",
    title: t(L.hubDiagram.title, 0, { emphasis: true }),
    nodes: Array.from({ length: L.hubDiagram.nodes.max }, (_, i) => ({
      icon: "mail",
      label: t(L.hubDiagram.nodeLabel, i),
    })),
    center: { icon: "database" },
    body: t(L.hubDiagram.body, 3, { emphasis: true }),
    closing: t(L.hubDiagram.closing, 8),
  },
  comparison: {
    type: "comparison",
    title: t(L.comparison.title, 0, { emphasis: true }),
    left: {
      name: t(L.comparison.name, 1),
      icon: "sheet",
      points: Array.from({ length: L.comparison.points.max }, (_, i) =>
        t(L.comparison.point, i + 2),
      ),
    },
    right: {
      name: t(L.comparison.name, 4),
      icon: "database",
      points: Array.from({ length: L.comparison.points.max }, (_, i) =>
        t(L.comparison.point, i + 5),
      ),
    },
    verdict: t(L.comparison.verdict, 3, { emphasis: true }),
  },
  costBreakdown: {
    type: "costBreakdown",
    title: t(L.costBreakdown.title, 0, { emphasis: true }),
    items: Array.from({ length: L.costBreakdown.items.max }, (_, i) => ({
      label: t(L.costBreakdown.itemLabel, i),
      range: "USD 1.200–12.500/mes".slice(0, L.costBreakdown.itemRange),
    })),
    total: {
      label: t(L.costBreakdown.totalLabel, 2),
      range: "USD 12.500–125.000/mes".slice(0, L.costBreakdown.totalRange),
    },
    note: t(L.costBreakdown.note, 4, { emphasis: true }),
  },
  steps: {
    type: "steps",
    title: t(L.steps.title, 0, { emphasis: true }),
    steps: Array.from({ length: L.steps.steps.max }, (_, i) => ({
      title: t(L.steps.stepTitle, i + 1),
      text: t(L.steps.stepText, i + 4),
    })),
  },
  bigNumber: {
    type: "bigNumber",
    kicker: t(L.bigNumber.kicker, 1),
    value: "USD 12.500".slice(0, L.bigNumber.value),
    label: t(L.bigNumber.label, 2, { emphasis: true }),
    context: t(L.bigNumber.context, 5, { emphasis: true }),
    source: t(L.bigNumber.source, 7),
  },
  chart: {
    type: "chart",
    title: t(L.chart.title, 0, { emphasis: true }),
    kind: "bar",
    datasetRef: "usd-blue-30d",
    caption: t(L.chart.caption, 3, { emphasis: true }),
    source: t(L.chart.source, 6),
  },
  cta: {
    type: "cta",
    title: t(L.cta.title, 0, { emphasis: true }),
    subtitle: t(L.cta.subtitle, 3, { emphasis: true }),
    button: t(L.cta.button, 9),
    icon: "message-circle",
  },
};
