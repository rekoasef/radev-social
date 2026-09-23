import { z } from "zod";
import { countEmphasis, MAX_EMPHASIS_PER_SLIDE } from "./emphasis";
import { iconName, key, plainText, richText } from "./fields";
import { limits as L } from "./limits";

// Slide catalog (docs/DESIGN-SYSTEM.md §5). The fields are shared by every preset. Labels inside
// cards, chips and nodes are plain text: containers get their contrast from the preset.

const iconLabel = (max: number) => z.object({ icon: iconName, label: plainText(max) });

export const coverSlide = z.object({
  type: z.literal("cover"),
  kicker: plainText(L.cover.kicker).optional(),
  title: richText(L.cover.title),
  subtitle: richText(L.cover.subtitle).optional(),
});

export const statementSlide = z.object({
  type: z.literal("statement"),
  title: richText(L.statement.title),
  body: richText(L.statement.body).optional(),
  visual: z
    .object({ from: iconLabel(L.statement.visualLabel), to: iconLabel(L.statement.visualLabel) })
    .optional(),
});

export const questionSlide = z.object({
  type: z.literal("question"),
  title: richText(L.question.title),
  callout: z.object({
    icon: iconName,
    lead: richText(L.question.calloutLead),
    text: richText(L.question.calloutText),
  }),
});

export const cardGridSlide = z.object({
  type: z.literal("cardGrid"),
  title: richText(L.cardGrid.title),
  intro: richText(L.cardGrid.intro).optional(),
  cards: z
    .array(
      z.object({
        icon: iconName,
        /** Light line above the label ("una"). */
        lead: plainText(L.cardGrid.cardLead).optional(),
        label: plainText(L.cardGrid.cardLabel),
      }),
    )
    .min(L.cardGrid.cards.min)
    .max(L.cardGrid.cards.max),
  footer: richText(L.cardGrid.footer).optional(),
});

export const flowSlide = z.object({
  type: z.literal("flow"),
  title: richText(L.flow.title),
  nodes: z.array(iconLabel(L.flow.nodeLabel)).min(L.flow.nodes.min).max(L.flow.nodes.max),
  body: richText(L.flow.body).optional(),
  closing: richText(L.flow.closing).optional(),
});

export const hubDiagramSlide = z.object({
  type: z.literal("hubDiagram"),
  title: richText(L.hubDiagram.title),
  nodes: z
    .array(iconLabel(L.hubDiagram.nodeLabel))
    .min(L.hubDiagram.nodes.min)
    .max(L.hubDiagram.nodes.max),
  center: z.object({ icon: iconName }),
  body: richText(L.hubDiagram.body).optional(),
  closing: richText(L.hubDiagram.closing).optional(),
});

const comparisonSide = z.object({
  name: plainText(L.comparison.name),
  icon: iconName.optional(),
  points: z
    .array(richText(L.comparison.point))
    .min(L.comparison.points.min)
    .max(L.comparison.points.max),
});

export const comparisonSlide = z.object({
  type: z.literal("comparison"),
  title: richText(L.comparison.title),
  left: comparisonSide,
  right: comparisonSide,
  verdict: richText(L.comparison.verdict),
});

export const costBreakdownSlide = z.object({
  type: z.literal("costBreakdown"),
  title: richText(L.costBreakdown.title),
  /** Ranges come only from the brand's pricing document. */
  items: z
    .array(
      z.object({
        label: plainText(L.costBreakdown.itemLabel),
        range: plainText(L.costBreakdown.itemRange),
      }),
    )
    .min(L.costBreakdown.items.min)
    .max(L.costBreakdown.items.max),
  total: z.object({
    label: plainText(L.costBreakdown.totalLabel),
    range: plainText(L.costBreakdown.totalRange),
  }),
  note: richText(L.costBreakdown.note).optional(),
});

export const stepsSlide = z.object({
  type: z.literal("steps"),
  title: richText(L.steps.title),
  steps: z
    .array(z.object({ title: richText(L.steps.stepTitle), text: richText(L.steps.stepText) }))
    .min(L.steps.steps.min)
    .max(L.steps.steps.max),
});

export const bigNumberSlide = z.object({
  type: z.literal("bigNumber"),
  kicker: richText(L.bigNumber.kicker).optional(),
  /** Must exist in the brand's data; never made up. */
  value: plainText(L.bigNumber.value),
  label: richText(L.bigNumber.label),
  context: richText(L.bigNumber.context).optional(),
  source: plainText(L.bigNumber.source),
});

export const chartSlide = z.object({
  type: z.literal("chart"),
  title: richText(L.chart.title),
  kind: z.enum(["line", "bar"]),
  /** The AI picks the dataset; the code injects the points. */
  datasetRef: key,
  caption: richText(L.chart.caption).optional(),
  source: plainText(L.chart.source),
});

export const ctaSlide = z.object({
  type: z.literal("cta"),
  title: richText(L.cta.title),
  subtitle: richText(L.cta.subtitle).optional(),
  button: plainText(L.cta.button),
  icon: iconName.optional(),
});

const slideOptions = [
  coverSlide,
  statementSlide,
  questionSlide,
  cardGridSlide,
  flowSlide,
  hubDiagramSlide,
  comparisonSlide,
  costBreakdownSlide,
  stepsSlide,
  bigNumberSlide,
  chartSlide,
  ctaSlide,
] as const;

export const SLIDE_TYPES = slideOptions.map((option) => option.shape.type.value);

export const slideSchema = z.discriminatedUnion("type", slideOptions).superRefine((slide, ctx) => {
  const fragments = countEmphasis(slide);
  if (fragments > MAX_EMPHASIS_PER_SLIDE) {
    ctx.addIssue({
      code: "custom",
      message: `Tiene ${fragments} fragmentos con énfasis; el máximo por slide es ${MAX_EMPHASIS_PER_SLIDE}.`,
    });
  }
});

export type Slide = z.infer<typeof slideSchema>;
export type SlideType = Slide["type"];
export type SlideOf<T extends SlideType> = Extract<Slide, { type: T }>;
