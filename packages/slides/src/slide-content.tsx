import type { ReactNode } from "react";
import type { Slide, SlideOf, SlideType } from "./content/slides";
import { boldTemplates } from "./presets/bold/templates";
import type { BoldTokens } from "./presets/bold/tokens";
import type { BrandTheme, StylePreset } from "./presets/registry";
import type { SoftTokens } from "./presets/soft/tokens";

// Picks the template of the brand's preset for a slide. Goes inside SlideFrame, which sets the
// CSS variables the templates read. Templates also get the tokens, for what CSS variables cannot
// carry (texts such as the tagline).

export type TemplateSet<Tokens> = {
  [T in SlideType]?: (props: { slide: SlideOf<T>; tokens: Tokens }) => ReactNode;
};

const templates: { bold: TemplateSet<BoldTokens>; soft: TemplateSet<SoftTokens> } = {
  bold: boldTemplates,
  soft: {}, // Phase 1, T8.
};

export function hasTemplate(preset: StylePreset, type: SlideType): boolean {
  return templates[preset][type] !== undefined;
}

export function SlideContent({ theme, slide }: { theme: BrandTheme; slide: Slide }) {
  const Template = templates[theme.preset][slide.type] as
    | ((props: { slide: Slide; tokens: BrandTheme["tokens"] }) => ReactNode)
    | undefined;
  if (!Template) {
    throw new Error(`El preset ${theme.preset} todavía no tiene plantilla ${slide.type}.`);
  }
  return <Template slide={slide} tokens={theme.tokens} />;
}
