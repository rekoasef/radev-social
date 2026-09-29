import type { CSSProperties, ReactNode } from "react";
import { parseEmphasis } from "../../content/emphasis";
import type { SlideType } from "../../content/slides";
import { fontStack, letterWidth } from "../../fonts/registry";
import type { Rect } from "../../frame/geometry";
import type { SlideAssets } from "../../frame/types";
import { fitTextSize, type GlyphWidths } from "../shared/fit";
import type { LookId } from "./look-ids";
import type { StudioTokens } from "./tokens";

// The engine of the `studio` preset (docs/DESIGN-SYSTEM.md §10). A look is a small kit: which
// surface each slide gets, its typography, backdrop, header and footer, and a handful of pieces
// (panel, list, button) the shared templates are built from. Templates know the structure of a
// slide type; looks know how things look. Adding a look never touches the templates.

/** Every slide is painted on one of these; the frame turns it into CSS variables. */
export type Surface = "ink" | "paper" | "accent";

/**
 * Where templates lay out their content: inside the safe area, between the look's header and
 * footer, left of TikTok's button column (x < 930) at every height.
 */
export const STUDIO_CONTENT_BOX: Rect = { x: 80, y: 160, width: 850, height: 1020 };

export type LookContext = {
  look: LookId;
  /** The look's kit: templates draw with its pieces. */
  kit: Look;
  tokens: StudioTokens;
  surface: Surface;
  page: { index: number; total: number };
  /** Seed for deterministic variation: the post id (plus the slide, where it matters). */
  seed: string;
  type: SlideType;
  brandName: string;
  assets: SlideAssets;
  /** The generated image of this slide (cover or close of a look that takes one, ADR 0016). */
  art?: { url: string; background: "dark" | "light"; monochrome?: boolean };
};

export type ListItem = {
  title: string;
  text?: string;
  icon?: string;
  /** A lighter line above the title (cardGrid's `lead`). */
  lead?: string;
};

export type TitleSpec = {
  /** Which of the brand's fonts sets the titles (default: display). */
  font?: "display" | "serif" | "mono";
  weight: number;
  caps: boolean;
  /** Letter spacing in em. */
  tracking: number;
  lineHeight: number;
};

export type Look = {
  id: LookId;
  title: TitleSpec;
  /** Surface of a slide, from its position and type. */
  surface(slide: { index: number; total: number; type: SlideType }): Surface;
  /** Full-bleed art behind everything (grids, lights, textures). */
  Backdrop?(ctx: LookContext): ReactNode;
  Header(ctx: LookContext): ReactNode;
  Footer(ctx: LookContext): ReactNode;
  /** Style of `*emphasized*` words. */
  emphasis(ctx: LookContext, where: "title" | "text"): CSSProperties;
  /** A box for secondary content (callouts, notes). `strong` is the highlighted variant. */
  Panel(props: { ctx: LookContext; strong?: boolean; children: ReactNode }): ReactNode;
  /** Items of a list: steps (numbered), cards, nodes of a flow. */
  List(props: { ctx: LookContext; items: ListItem[]; numbered: boolean }): ReactNode;
  Button(props: { ctx: LookContext; text: string; icon?: string }): ReactNode;
  /** Big decorative elements of a slide type, behind the content (a giant "?", a stamp). */
  Decor?(ctx: LookContext): ReactNode;
  /** CSS variables the look changes on top of the surface's (e.g. no accent at all). */
  vars?(ctx: LookContext): CSSProperties;
  /** Wraps the title (e.g. in a chat bubble); `titleInset` is the width it takes from it. */
  wrapTitle?(title: ReactNode, ctx: LookContext): ReactNode;
  titleInset?: number;
  /** How the shared templates arrange some slide types. */
  compose: {
    cover: "top" | "bottom" | "center";
    /** Size of the cover title (default `hero`); smaller leaves room for the look's art. */
    coverTitle?: TitleRole;
    question: "left" | "center";
    /** `low`: centered in the lower part, leaving the top to the look's decor. */
    cta: "left" | "center" | "low";
  };
};

/** Colors of each surface as CSS variables: templates and looks only read these. */
export function surfaceVars(tokens: StudioTokens, surface: Surface): CSSProperties {
  const { ink, paper, accent, glow } = tokens.colors;
  const [bg, fg, hl] =
    surface === "ink"
      ? [ink, paper, accent]
      : surface === "paper"
        ? [paper, ink, accent]
        : [accent, ink, ink];
  return {
    "--ink": ink,
    "--paper": paper,
    "--accent": accent,
    "--glow": glow,
    "--bg": bg,
    "--fg": fg,
    /** Emphasis and highlights: the accent, or ink on an accent surface. */
    "--hl": hl,
    "--muted": `color-mix(in srgb, ${fg} 62%, ${bg})`,
    "--line": `color-mix(in srgb, ${fg} 18%, ${bg})`,
    "--panel": `color-mix(in srgb, ${fg} 7%, ${bg})`,
    "--font-display": fontStack(tokens.fonts.display.family),
    "--font-body": fontStack(tokens.fonts.body.family),
    "--weight-body": tokens.fonts.body.weight,
    "--font-mono": fontStack(tokens.fonts.mono.family),
    "--font-serif": fontStack(tokens.fonts.serif.family),
    "--weight-mono": tokens.fonts.mono.weight,
    background: bg,
    color: fg,
  } as CSSProperties;
}

/** A piece painted on another surface (a tile, a sticker): its own colors for what it holds. */
export const onSurface = (ctx: LookContext, surface: Surface): CSSProperties =>
  surfaceVars(ctx.tokens, surface);

/** Visible text (without emphasis marks). */
export const plainOf = (text: string) => {
  const parsed = parseEmphasis(text);
  return parsed.ok ? parsed.plain : text;
};

/** Text with `*emphasis*` in the look's style. */
export function Rich({ text, emphasis }: { text: string; emphasis: CSSProperties }) {
  const parsed = parseEmphasis(text);
  // Content is validated before it gets here; show it raw rather than fail the render.
  if (!parsed.ok) return <>{text}</>;
  return (
    <>
      {parsed.segments.map((segment, i) =>
        segment.emphasis ? (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: segments are static and ordered
            key={i}
            style={{ boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone", ...emphasis }}
          >
            {segment.text}
          </span>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}

/** Letter and space widths of the brand's display font as the look sets it, with a margin. */
export function titleGlyphs(tokens: StudioTokens, spec: TitleSpec): GlyphWidths {
  const letter = letterWidth(tokens.fonts[spec.font ?? "display"].family, spec.weight, spec.caps);
  return { char: (letter + spec.tracking) * 1.07, space: 0.28 + spec.tracking };
}

/** Title sizes by role, largest first; the fit takes the biggest that stays in `lines`. */
export const TITLE_SIZES = {
  hero: { sizes: [168, 150, 132, 116, 100, 88, 76], lines: 5 },
  statement: { sizes: [132, 116, 100, 88, 76, 66], lines: 4 },
  title: { sizes: [104, 92, 80, 70, 62, 54], lines: 4 },
  small: { sizes: [84, 74, 66, 58, 52], lines: 3 },
} as const;

export type TitleRole = keyof typeof TITLE_SIZES;

export function titleSize(
  text: string,
  ctx: LookContext,
  role: TitleRole,
  width = STUDIO_CONTENT_BOX.width,
): number {
  const spec = ctx.kit.title;
  const { sizes, lines } = TITLE_SIZES[role];
  const plain = plainOf(text);
  return fitTextSize(spec.caps ? plain.toUpperCase() : plain, {
    width,
    sizes,
    maxLines: lines,
    glyphs: titleGlyphs(ctx.tokens, spec),
  });
}

/** The look's title: display font, sized to fit, emphasis in the look's style. */
export function Title({
  text,
  ctx,
  size: role = "title",
  width = STUDIO_CONTENT_BOX.width,
  align,
  style,
}: {
  text: string;
  ctx: LookContext;
  /** Size role of the title (TITLE_SIZES). */
  size?: TitleRole;
  width?: number;
  align?: "left" | "center";
  style?: CSSProperties;
}) {
  const spec = ctx.kit.title;
  const size = titleSize(text, ctx, role, width - (ctx.kit.titleInset ?? 0));
  const title = (
    <h1
      data-qa="text"
      style={{
        margin: 0,
        maxWidth: width,
        fontFamily: `var(--font-${spec.font ?? "display"})`,
        fontWeight: spec.weight,
        fontSize: `calc(${size}px * var(--title-adjust, 1))`,
        lineHeight: spec.lineHeight,
        letterSpacing: `${spec.tracking}em`,
        textTransform: spec.caps ? "uppercase" : "none",
        textAlign: align,
        textWrap: "balance",
        color: "var(--fg)",
        ...style,
      }}
    >
      {text && <Rich text={text} emphasis={ctx.kit.emphasis(ctx, "title")} />}
    </h1>
  );
  return ctx.kit.wrapTitle ? ctx.kit.wrapTitle(title, ctx) : title;
}

/** Rich text (with `*emphasis*`) in the look's text style, for the pieces of a look. */
export function RichText({ text, ctx }: { text: string; ctx: LookContext }) {
  return <Rich text={text} emphasis={ctx.kit.emphasis(ctx, "text")} />;
}

/** Support copy in the body font. */
export function Text({
  text,
  ctx,
  size = 32,
  color = "var(--muted)",
  style,
}: {
  text: string;
  ctx: LookContext;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <p
      data-qa="text"
      style={{
        margin: 0,
        fontFamily: "var(--font-body)",
        fontWeight: "var(--weight-body)" as unknown as number,
        fontSize: size,
        lineHeight: 1.38,
        color,
        textWrap: "pretty",
        ...style,
      }}
    >
      <Rich text={text} emphasis={ctx.kit.emphasis(ctx, "text")} />
    </p>
  );
}

/** Small uppercase label in the mono font (kickers, metadata). */
export function Label({
  children,
  size = 20,
  color = "var(--muted)",
  style,
}: {
  children: ReactNode;
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      data-qa="text"
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: "var(--weight-mono)" as unknown as number,
        fontSize: size,
        lineHeight: 1.2,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/** The brand's name as a wordmark: the tokens' text (or the brand name) and an accent dot. */
export function Wordmark({
  ctx,
  size = 30,
  color = "var(--fg)",
}: {
  ctx: LookContext;
  size?: number;
  color?: string;
}) {
  const { wordmark, logoAsset } = ctx.tokens;
  const logo = logoAsset ? ctx.assets[logoAsset] : undefined;
  if (logo) {
    return (
      <img
        src={logo.url}
        alt={ctx.brandName}
        style={{ display: "block", height: size * 1.3, width: "auto" }}
      />
    );
  }
  return (
    <span
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: size,
        letterSpacing: "-0.03em",
        lineHeight: 1,
        textTransform: "none",
        color,
      }}
    >
      {wordmark.text || ctx.brandName}
      {wordmark.dot && (
        <span style={{ color: ctx.surface === "accent" ? "var(--paper)" : "var(--accent)" }}>
          .
        </span>
      )}
    </span>
  );
}

/** "03 / 06", or "Deslizá →" on the cover. */
export function pageLabel(ctx: LookContext, separator = " / "): string {
  if (ctx.page.index === 0) return "Deslizá →";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(ctx.page.index + 1)}${separator}${pad(ctx.page.total)}`;
}

/** Two digits for list numbers: 01, 02… */
export const twoDigits = (n: number) => String(n).padStart(2, "0");
