import type { ReactNode } from "react";
import type { Datasets } from "../../content/datasets";
import type { Slide } from "../../content/slides";
import { FORMAT } from "../../frame/geometry";
import { Layer } from "../../frame/layer";
import type { SlideAssets } from "../../frame/types";
import { type LookContext, STUDIO_CONTENT_BOX, surfaceVars } from "./kit";
import { LOOK_ART, type LookId } from "./look-ids";
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
  /** URLs of the post's generated images (ADR 0016): the cover's and the close's. */
  art?: { cover?: string; cta?: string };
};

export function lookContext(props: StudioSlideProps): LookContext {
  const kit = LOOKS[props.look];
  const spec = LOOK_ART[props.look];
  const type = props.slide.type;
  const slot = type === "cover" || type === "cta" ? type : undefined;
  // The post's generated image; the brand's element when there is none, or always if asked.
  const hero = props.tokens.heroAsset ? props.assets?.[props.tokens.heroAsset] : undefined;
  const generated = spec && slot && !props.tokens.heroAlways ? props.art?.[slot] : undefined;
  const url = generated ?? (spec && slot ? hero?.url : undefined);
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
    ...(spec &&
      url &&
      (type === "cover" || type === "cta") && {
        art: { url, background: spec[type], monochrome: spec.monochrome, brand: !generated },
      }),
  };
}

/**
 * The generated image, blended into the slide: its plain background disappears (screen over a
 * dark slide, multiply over a light one) and its edges fade, so the object floats. Movable and
 * resizable as the slide's graphic element (ADR 0013).
 */
function ArtLayer({ ctx, slide }: { ctx: LookContext; slide: Slide }) {
  if (!ctx.art) return null;
  // A generated object fills about half of its square: the image runs big and fades out. The
  // brand's element is a cut-out already: drawn as it is, at the size of soft's hero.
  const brand = ctx.art.brand === true;
  const size = brand ? (ctx.type === "cover" ? 420 : 280) : ctx.type === "cover" ? 760 : 520;
  const top = brand ? (ctx.type === "cover" ? 190 : 170) : ctx.type === "cover" ? 20 : 60;
  const light = ctx.art.background === "light";
  return (
    <Layer
      name="hero"
      layout={slide.layout}
      style={{
        position: "absolute",
        left: FORMAT.width / 2 - size / 2,
        top,
        width: size,
        height: size,
      }}
    >
      <img
        src={ctx.art.url}
        alt=""
        style={{
          display: "block",
          width: size,
          height: size,
          objectFit: "contain",
          mixBlendMode: brand ? undefined : light ? "multiply" : "screen",
          // The model's "white" is a light gray with haze: lifted to white so it disappears.
          filter:
            [
              ctx.art.monochrome ? "grayscale(1) contrast(1.1)" : "",
              light && !brand ? "brightness(1.1) contrast(1.08)" : "",
            ]
              .filter(Boolean)
              .join(" ") || undefined,
          WebkitMaskImage: brand ? undefined : "radial-gradient(circle, #000 34%, transparent 58%)",
          maskImage: brand ? undefined : "radial-gradient(circle, #000 34%, transparent 58%)",
        }}
      />
    </Layer>
  );
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
      {/* The generated image takes the place of the look's own art on its slide. */}
      {ctx.art ? <ArtLayer ctx={ctx} slide={props.slide} /> : kit.Decor?.(ctx)}
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
