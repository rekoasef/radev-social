import type { ReactNode } from "react";
import type { SlideOf, SlideType } from "../../../content/slides";
import { CardGridTemplate } from "./card-grid";
import { FlowTemplate } from "./flow";
import { HubDiagramTemplate } from "./hub-diagram";

// Templates of the `bold` preset. The rest arrive in phase 1: T5 (cover, statement, question,
// cta) and T6 (comparison, costBreakdown, steps, bigNumber, chart).

export const boldTemplates: { [T in SlideType]?: (props: { slide: SlideOf<T> }) => ReactNode } = {
  cardGrid: CardGridTemplate,
  flow: FlowTemplate,
  hubDiagram: HubDiagramTemplate,
};
