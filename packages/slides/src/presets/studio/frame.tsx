import type { ReactNode } from "react";
import { compositionOf } from "../../content/compositions";
import type { Datasets } from "../../content/datasets";
import type { Slide } from "../../content/slides";
import { FORMAT } from "../../frame/geometry";
import { Layer } from "../../frame/layer";
import type { SlideAssets } from "../../frame/types";
import { type LookContext, STUDIO_CONTENT_BOX, surfaceVars } from "./kit";
import { LOOK_ART, type LookId } from "./look-ids";
import { LOOKS } from "./looks";
import { surfaceBackground } from "./surfaces";
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
  /**
   * URLs of the post's generated images (ADR 0016, 0026): the cover's, the close's and the one of
   * a middle slide with the `photo` composition.
   */
  art?: { cover?: string; cta?: string; middle?: string };
};

export function lookContext(props: StudioSlideProps): LookContext {
  const kit = LOOKS[props.look];
  const spec = LOOK_ART[props.look];
  const type = props.slide.type;
  const surface = kit.surface({ ...props.page, type });
  const composition = compositionOf(props.slide);
  const slot = type === "cover" || type === "cta" ? type : undefined;
  // The post's generated image; the brand's element when there is none, or always if asked. A
  // scene across the slide (`bleed`) is always generated: the brand's element is a cut-out.
  const hero = props.tokens.heroAsset ? props.assets?.[props.tokens.heroAsset] : undefined;
  const generated = spec && !props.tokens.heroAlways ? props.art?.[slot ?? "middle"] : undefined;
  const middle = !slot && composition === "photo";
  const url =
    slot || middle
      ? (generated ?? (spec && slot && composition !== "bleed" ? hero?.url : undefined))
      : undefined;
  // A middle slide takes the background of its own surface.
  const background = slot ? spec?.[slot] : surfaceBackground(surface);
  return {
    look: props.look,
    kit,
    tokens: props.tokens,
    surface,
    page: props.page,
    seed: props.seed,
    type,
    brandName: props.brandName,
    assets: props.assets ?? {},
    ...(spec &&
      url &&
      background && {
        art: { url, background, monochrome: spec.monochrome, brand: !generated },
      }),
  };
}

/** Where the image goes and how big, by slide type and composition. */
function artPlacement(
  ctx: LookContext,
  composition: string | undefined,
): { left: number; top: number; size: number } | "bleed" | "inline" {
  const brand = ctx.art?.brand === true;
  const centered = (size: number, top: number) => ({
    left: FORMAT.width / 2 - size / 2,
    top,
    size,
  });
  if (composition === "bleed") return "bleed";
  // Under a title of any length: the template draws it in the flow, with the room left.
  if (ctx.type === "cover" && composition === "giant") return "inline";
  if (ctx.type === "cover") {
    // Beside the title, cut by the right edge; under a title at the top; above one at the bottom.
    if (composition === "split") return { left: 500, top: 260, size: 820 };
    return brand ? centered(420, 190) : centered(760, 20);
  }
  if (ctx.type === "cta") return brand ? centered(280, 170) : centered(600, 40);
  // A middle slide's photo: above its title.
  return centered(640, 60);
}

/**
 * The generated image, blended into the slide: its plain background disappears (screen over a
 * dark slide, multiply over a light one) and its edges fade, so the object floats. A scene
 * (`bleed`) covers the whole slide instead, under a fade to the look's background where the text
 * goes. Movable and resizable as the slide's graphic element (ADR 0013).
 */
function ArtLayer({ ctx, slide }: { ctx: LookContext; slide: Slide }) {
  if (!ctx.art) return null;
  const place = artPlacement(ctx, compositionOf(slide));
  if (place === "inline") return null;
  const mono = ctx.art.monochrome ? "grayscale(1) contrast(1.1)" : "";
  if (place === "bleed") {
    return (
      <>
        <img
          src={ctx.art.url}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: FORMAT.width,
            height: FORMAT.height,
            objectFit: "cover",
            filter: mono || undefined,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, color-mix(in srgb, var(--bg) 60%, transparent) 0%, transparent 15%, transparent 44%, color-mix(in srgb, var(--bg) 92%, transparent) 68%, var(--bg) 84%)",
          }}
        />
      </>
    );
  }
  // A generated object fills about two thirds of its square on a clean background (ADR 0025):
  // the image runs big and only its edges fade. The brand's element is a cut-out already: drawn
  // as it is.
  const brand = ctx.art.brand === true;
  const light = ctx.art.background === "light";
  const { left, top, size } = place;
  return (
    <Layer
      name="hero"
      layout={slide.layout}
      style={{ position: "absolute", left, top, width: size, height: size }}
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
            [mono, light && !brand ? "brightness(1.1) contrast(1.08)" : ""]
              .filter(Boolean)
              .join(" ") || undefined,
          WebkitMaskImage: brand ? undefined : "radial-gradient(circle, #000 46%, transparent 66%)",
          maskImage: brand ? undefined : "radial-gradient(circle, #000 46%, transparent 66%)",
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
