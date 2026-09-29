import type { CSSProperties, ReactNode } from "react";
import type { SlideType } from "../../../content/slides";
import { createRandom } from "../../../frame/random";
import { type LookContext, pageLabel, type Surface, Wordmark } from "../kit";

// Pieces several looks share: the header and footer lines, surface rhythms and seeded variation.

/** Mono metadata line along the top (inside the safe area). */
export function MetaHeader({
  left,
  right,
  color = "var(--muted)",
}: {
  left?: ReactNode;
  right?: ReactNode;
  color?: string;
}) {
  const style: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontWeight: 500,
    fontSize: 20,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color,
  };
  return (
    <div
      style={{
        position: "absolute",
        top: 84,
        left: 80,
        width: 850,
        display: "flex",
        justifyContent: "space-between",
        ...style,
      }}
    >
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

/** Wordmark on the left, page indicator ending at x = 930 (clear of TikTok's buttons). */
export function WordmarkFooter({
  ctx,
  color = "var(--muted)",
  separator,
}: {
  ctx: LookContext;
  color?: string;
  separator?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 64,
        left: 80,
        width: 850,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "var(--font-mono)",
        fontWeight: 500,
        fontSize: 20,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color,
      }}
    >
      <Wordmark ctx={ctx} />
      <span>{pageLabel(ctx, separator)}</span>
    </div>
  );
}

/** Brand name (or handle) for metadata lines. */
export const brandLine = (ctx: LookContext) =>
  ctx.tokens.handle.site || ctx.tokens.wordmark.text || ctx.brandName;

/**
 * A surface rhythm: the cover and the cta get fixed surfaces, the slides in between cycle
 * through `middle`. Data slides never land on `accent` (a chart reads better on ink or paper).
 */
export function rhythm(
  cover: Surface,
  middle: readonly Surface[],
  cta: Surface,
): (slide: { index: number; total: number; type: SlideType }) => Surface {
  const dataTypes: readonly SlideType[] = ["chart", "bigNumber", "costBreakdown", "comparison"];
  return ({ index, total, type }) => {
    if (index === 0) return cover;
    if (index === total - 1) return cta;
    const surface = middle[(index - 1) % middle.length] ?? "ink";
    if (surface === "accent" && dataTypes.includes(type))
      return middle.find((s) => s !== "accent") ?? "ink";
    return surface;
  };
}

/** Seeded variation for a slide (same post and slide: same result). */
export const slideRandom = (ctx: LookContext, salt = "") =>
  createRandom(`${ctx.seed}:${ctx.page.index}:${salt}`);
