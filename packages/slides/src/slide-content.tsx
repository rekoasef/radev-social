import type { ReactNode } from "react";
import type { Datasets } from "./content/datasets";
import type { Slide, SlideOf, SlideType } from "./content/slides";
import type { SlideAssets } from "./frame/types";
import { boldTemplates } from "./presets/bold/templates";
import type { BoldTokens } from "./presets/bold/tokens";
import type { BrandTheme, StylePreset } from "./presets/registry";
import { softTemplates } from "./presets/soft/templates";
import type { SoftTokens } from "./presets/soft/tokens";

// Picks the template of the brand's preset for a slide. Goes inside SlideFrame, which sets the
// CSS variables the templates read. Templates also get the tokens, for what CSS variables cannot
// carry (texts such as the tagline), the datasets that `chart` slides point to and the brand's
// files (the hero asset).

export type TemplateProps<T extends SlideType, Tokens> = {
  slide: SlideOf<T>;
  tokens: Tokens;
  datasets: Datasets;
  assets: SlideAssets;
};

export type TemplateSet<Tokens> = {
  [T in SlideType]?: (props: TemplateProps<T, Tokens>) => ReactNode;
};

const templates: { bold: TemplateSet<BoldTokens>; soft: TemplateSet<SoftTokens> } = {
  bold: boldTemplates,
  soft: softTemplates,
};

export function hasTemplate(preset: StylePreset, type: SlideType): boolean {
  return templates[preset][type] !== undefined;
}

export function SlideContent({
  theme,
  slide,
  datasets = {},
  assets = {},
}: {
  theme: BrandTheme;
  slide: Slide;
  datasets?: Datasets;
  assets?: SlideAssets;
}) {
  const Template = templates[theme.preset][slide.type] as
    | ((props: {
        slide: Slide;
        tokens: BrandTheme["tokens"];
        datasets: Datasets;
        assets: SlideAssets;
      }) => ReactNode)
    | undefined;
  if (!Template) {
    throw new Error(`El preset ${theme.preset} todavía no tiene plantilla ${slide.type}.`);
  }
  return <Template slide={slide} tokens={theme.tokens} datasets={datasets} assets={assets} />;
}
