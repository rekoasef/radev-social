/**
 * Content limits (docs/DESIGN-SYSTEM.md §5). Text limits count visible characters, without
 * emphasis asterisks. Calibrated in phase 1 (T11) with the worst cases of content/extremes.ts:
 * every slide at its limits must pass the render QA in every preset.
 */
export const limits = {
  cover: { kicker: 24, title: 60, subtitle: 90 },
  statement: { title: 70, body: 160, visualLabel: 16 },
  question: { title: 80, calloutLead: 30, calloutText: 80 },
  cardGrid: {
    title: 60,
    intro: 40,
    cards: { min: 3, max: 6 },
    cardLead: 14,
    cardLabel: 24,
    footer: 80,
  },
  // nodeWord: four flow cards in a row leave ~164 px; at the minimum label size a longer word
  // does not fit ("Internacionalización", 20, would need 14 px).
  flow: {
    title: 60,
    nodes: { min: 3, max: 5 },
    nodeLabel: 22,
    nodeWord: 16,
    body: 180,
    closing: 90,
  },
  hubDiagram: { title: 60, nodes: { min: 3, max: 6 }, nodeLabel: 16, body: 180, closing: 70 },
  comparison: { title: 60, name: 18, points: { min: 2, max: 4 }, point: 40, verdict: 90 },
  costBreakdown: {
    title: 60,
    items: { min: 3, max: 6 },
    itemLabel: 30,
    itemRange: 20,
    totalLabel: 20,
    totalRange: 24,
    note: 100,
  },
  steps: { title: 60, steps: { min: 3, max: 5 }, stepTitle: 32, stepText: 90 },
  bigNumber: { kicker: 30, value: 10, label: 80, context: 140, source: 90 },
  chart: { title: 60, caption: 100, source: 90 },
  /** Screens: how many screenshots a slide shows (a phone, a computer, or one of each). */
  screen: { title: 70, body: 140, screens: { min: 1, max: 2 } },
  cta: { title: 70, subtitle: 120, button: 50 },
  carousel: {
    hook: 100,
    slides: { min: 5, max: 8 },
    caption: 2000,
    hashtags: 5,
    artSubject: { min: 15, max: 300 },
  },
  /** The operator's instruction for "Rehacer con IA". */
  rewrite: { instruction: 200 },
} as const;
