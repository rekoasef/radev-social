import type { TemplateSet } from "../../../slide-content";
import type { BoldTokens } from "../tokens";
import { BigNumberTemplate } from "./big-number";
import { CardGridTemplate } from "./card-grid";
import { ChartTemplate } from "./chart";
import { ComparisonTemplate } from "./comparison";
import { CostBreakdownTemplate } from "./cost-breakdown";
import { CoverTemplate } from "./cover";
import { CtaTemplate } from "./cta";
import { FlowTemplate } from "./flow";
import { HubDiagramTemplate } from "./hub-diagram";
import { QuestionTemplate } from "./question";
import { StatementTemplate } from "./statement";
import { StepsTemplate } from "./steps";

// Templates of the `bold` preset: one per slide type.

export const boldTemplates: TemplateSet<BoldTokens> = {
  cover: CoverTemplate,
  statement: StatementTemplate,
  question: QuestionTemplate,
  cardGrid: CardGridTemplate,
  flow: FlowTemplate,
  hubDiagram: HubDiagramTemplate,
  comparison: ComparisonTemplate,
  costBreakdown: CostBreakdownTemplate,
  steps: StepsTemplate,
  bigNumber: BigNumberTemplate,
  chart: ChartTemplate,
  cta: CtaTemplate,
};
