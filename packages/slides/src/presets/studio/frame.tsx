import type { ReactNode } from "react";
import type { Datasets } from "../../content/datasets";
import type { Slide } from "../../content/slides";
import { FORMAT } from "../../frame/geometry";
import type { SlideAssets } from "../../frame/types";
import { type LookContext, STUDIO_CONTENT_BOX, surfaceVars } from "./kit";
import type { LookId } from "./look-ids";
import { LOOKS } from "./looks";
import { studioTemplates } from "./templates";
import type { StudioTokens } from "./tokens";

// A whole `studio` slide: the look's surface, backdrop, decor, header and footer, and the
// template of the slide type in the content box. Frame and content go together here because the
// look decides both (the surface of a slide changes its content's colors).

export type StudioSlideProps = {
  tokens: StudioTokens;
  look: LookId;
  slide: Slide;
  page: { index: number; total: number };
  seed: string;
  brandName: string;
  assets?: SlideAssets;
  datasets?: Datasets;
};

export function lookContext(props: StudioSlideProps): LookContext {
  const kit = LOOKS[props.look];
  return {
    look: props.look,
    kit,
    tokens: props.tokens,
    surface: kit.surface({ ...props.page, type: props.slide.type }),
    page: props.page,
    seed: props.seed,
    type: props.slide.type,
    brandName: props.brandName,
    assets: props.assets ?? {},
  };
}

export function StudioSlide(props: StudioSlideProps) {
  const ctx = lookContext(props);
  const { kit } = ctx;
  const Template = studioTemplates[props.slide.type] as (args: {
    slide: Slide;
    ctx: LookContext;
    datasets: Datasets;
  }) => ReactNode;
  const box = STUDIO_CONTENT_BOX;
  return (
    <div
      data-slide-frame=""
      data-look={ctx.look}
      data-surface={ctx.surface}
      style={{
        position: "absolute",
        inset: 0,
        width: FORMAT.width,
        height: FORMAT.height,
        overflow: "hidden",
        WebkitFontSmoothing: "antialiased",
        ...surfaceVars(ctx.tokens, ctx.surface),
        ...kit.vars?.(ctx),
      }}
    >
      {kit.Backdrop?.(ctx)}
      {kit.Decor?.(ctx)}
      {kit.Header(ctx)}
      <div
        style={{
          position: "absolute",
          left: box.x,
          top: box.y,
          width: box.width,
          height: box.height,
        }}
      >
        {/* fitSlide (fit.ts) zooms this box out in the browser when the slide does not fit. The
            zoom goes inside a positioned parent: on the positioned box it would move it too. */}
        <div
          data-fit=""
          data-fit-width={box.width}
          data-fit-height={box.height}
          style={{ width: box.width, height: box.height }}
        >
          <Template slide={props.slide} ctx={ctx} datasets={props.datasets ?? {}} />
        </div>
      </div>
      {kit.Footer(ctx)}
    </div>
  );
}
