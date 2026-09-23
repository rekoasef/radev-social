import type { ReactNode } from "react";
import type { Slide, SlideOf, SlideType } from "./content/slides";
import { boldTemplates } from "./presets/bold/templates";
import type { BrandTheme, StylePreset } from "./presets/registry";

// Picks the template of the brand's preset for a slide. Goes inside SlideFrame, which sets the
// CSS variables the templates read.

type Templates = { [T in SlideType]?: (props: { slide: SlideOf<T> }) => ReactNode };

const templates: Record<StylePreset, Templates> = {
  bold: boldTemplates,
  soft: {}, // Phase 1, T8.
};

export function hasTemplate(preset: StylePreset, type: SlideType): boolean {
  return templates[preset][type] !== undefined;
}

export function SlideContent({ theme, slide }: { theme: BrandTheme; slide: Slide }) {
  const Template = templates[theme.preset][slide.type] as
    | ((props: { slide: Slide }) => ReactNode)
    | undefined;
  if (!Template) {
    throw new Error(`El preset ${theme.preset} todavía no tiene plantilla ${slide.type}.`);
  }
  return <Template slide={slide} />;
}
