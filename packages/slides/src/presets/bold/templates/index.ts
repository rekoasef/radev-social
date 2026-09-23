import type { TemplateSet } from "../../../slide-content";
import type { BoldTokens } from "../tokens";
import { CardGridTemplate } from "./card-grid";
import { CoverTemplate } from "./cover";
import { CtaTemplate } from "./cta";
import { FlowTemplate } from "./flow";
import { HubDiagramTemplate } from "./hub-diagram";
import { QuestionTemplate } from "./question";
import { StatementTemplate } from "./statement";

// Templates of the `bold` preset. The data ones arrive in phase 1, T6 (comparison,
// costBreakdown, steps, bigNumber, chart).

export const boldTemplates: TemplateSet<BoldTokens> = {
  cover: CoverTemplate,
  statement: StatementTemplate,
  question: QuestionTemplate,
  cardGrid: CardGridTemplate,
  flow: FlowTemplate,
  hubDiagram: HubDiagramTemplate,
  cta: CtaTemplate,
};
