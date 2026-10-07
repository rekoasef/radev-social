import type { CSSProperties, ReactNode } from "react";
import { createRandom } from "../../../frame/random";
import { type LookContext, pageLabel, Wordmark } from "../kit";

export { rhythm } from "../surfaces";

// Pieces several looks share: the header and footer lines and seeded variation. Surface rhythms
// live in ../surfaces.ts (no React: the worker reads them too).

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

/** Seeded variation for a slide (same post and slide: same result). */
export const slideRandom = (ctx: LookContext, salt = "") =>
  createRandom(`${ctx.seed}:${ctx.page.index}:${salt}`);
