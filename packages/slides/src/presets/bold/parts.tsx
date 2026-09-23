import type { CSSProperties, ReactNode } from "react";
import { parseEmphasis } from "../../content/emphasis";
import { SAFE_AREA } from "../../frame/geometry";
import { SlideIcon } from "../../icons";

// Building blocks shared by the `bold` templates (docs/DESIGN-SYSTEM.md §7). Colors and fonts
// come from the CSS variables set by BoldFrame; nothing here is brand-specific.

/** Glow around cards and connector points, scaled by the brand's glow intensity. */
export const glowShadow = (px: number) =>
  `0 0 calc(var(--glow) * ${px}px) color-mix(in srgb, var(--accent) 45%, transparent)`;

/** Text color of support copy: the text color, slightly toned down. */
const supportColor = "color-mix(in srgb, var(--text) 82%, var(--bg))";

/** Emphasis style of support copy (docs/DESIGN-SYSTEM.md §7). */
export const supportEmphasis: CSSProperties = {
  fontWeight: 700,
  color: "var(--accent)",
  textTransform: "uppercase",
};

/** Uppercase spaced label, like the corner labels of the frame. */
export function labelText(size: number): CSSProperties {
  return {
    fontFamily: "var(--font-label)",
    fontWeight: "var(--weight-label)",
    fontSize: size,
    letterSpacing: "0.3em",
    lineHeight: 1.5,
    textTransform: "uppercase",
  };
}

/** Text with `*emphasis*` rendered in the given style. */
export function Rich({ text, emphasis }: { text: string; emphasis: CSSProperties }) {
  const parsed = parseEmphasis(text);
  // Content is validated before it gets here; show it raw rather than fail the render.
  if (!parsed.ok) return <>{text}</>;
  return (
    <>
      {parsed.segments.map((segment, i) =>
        segment.emphasis ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are static and ordered
          <span key={i} style={emphasis}>
            {segment.text}
          </span>
        ) : (
          segment.text
        ),
      )}
    </>
  );
}

/** Average glyph width of the body font, in em (Inter, mixed case). Calibrated on renders. */
const AVG_GLYPH_EM = 0.56;

/**
 * One font size for a set of labels (all the nodes of a diagram share it) so each fits `width`:
 * the whole label when it must stay on one line, or its longest word when it may wrap (words
 * are never broken). Estimated from the character count, so it is deterministic and needs no
 * measuring in the browser. Never below `min`.
 */
export function fitFontSize(
  texts: string[],
  width: number,
  { base, min, oneLine = false }: { base: number; min: number; oneLine?: boolean },
): number {
  const units = oneLine ? texts : texts.flatMap((text) => text.split(/\s+/));
  const longest = Math.max(1, ...units.map((unit) => [...unit].length));
  const fits = Math.floor(width / (longest * AVG_GLYPH_EM));
  return Math.max(min, Math.min(base, fits));
}

/** Title size by visible length: short hooks get the biggest size (calibrated in T11). */
export function titleSize(text: string): number {
  const parsed = parseEmphasis(text);
  const length = [...(parsed.ok ? parsed.plain : text)].length;
  if (length <= 24) return 100;
  if (length <= 48) return 84;
  return 70;
}

export function Title({ text, size = titleSize(text) }: { text: string; size?: number }) {
  return (
    <h1
      data-qa="text"
      style={{
        margin: 0,
        // With such a tight line height the last line's descenders spill below the box; the
        // padding keeps them inside, so the overflow check (§9) stays meaningful.
        paddingBottom: "0.12em",
        fontFamily: "var(--font-display)",
        fontWeight: "var(--weight-display)",
        fontSize: size,
        // Accented capitals (DÍA, INFORMACIÓN) reach ~1em above the baseline: below 1.06 they
        // touch the line above.
        lineHeight: 1.06,
        letterSpacing: "-0.02em",
        // The negative tracking also eats the spaces: give them back.
        wordSpacing: "0.12em",
        textTransform: "uppercase",
        textWrap: "pretty",
        color: "var(--text)",
      }}
    >
      <Rich text={text} emphasis={{ color: "var(--accent)" }} />
    </h1>
  );
}

/**
 * Support copy. `\n` breaks lines; emphasis is bold, accent and uppercase. `balance` evens out
 * the lines of short one-paragraph texts (footers, closings).
 */
export function Support({
  text,
  size = 32,
  balance = false,
}: {
  text: string;
  size?: number;
  balance?: boolean;
}) {
  return (
    <p
      data-qa="text"
      style={{
        margin: 0,
        fontFamily: "var(--font-body)",
        fontWeight: "var(--weight-body)",
        fontSize: size,
        lineHeight: 1.3,
        whiteSpace: "pre-line",
        textWrap: balance ? "balance" : "pretty",
        color: supportColor,
      }}
    >
      <Rich text={text} emphasis={supportEmphasis} />
    </p>
  );
}

/** Container shared by cards and chips: surface, accent border with glow. */
export function boxStyle(radius = "var(--radius-card)"): CSSProperties {
  return {
    boxSizing: "border-box",
    background: "var(--surface)",
    border: "1.5px solid var(--accent)",
    borderRadius: radius,
    boxShadow: glowShadow(22),
  };
}

/** Icon on a small dark square, one step above the card surface. `accent` marks a destination. */
export function IconTile({
  name,
  size = 76,
  accent = false,
}: {
  name: string;
  size?: number;
  accent?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: 14,
        background: "color-mix(in srgb, var(--text) 7%, var(--surface))",
        color: accent ? "var(--accent)" : "var(--text)",
      }}
    >
      <SlideIcon name={name} size={Math.round(size * 0.5)} />
    </span>
  );
}

export const TITLE_WIDTH = SAFE_AREA.width;

/** Vertical layout shared by the templates: title on top, the rest centered below it. */
export function TemplateLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* The title may take the full safe width (920): even at 4 lines it ends well above
          y = 650, where TikTok's button column starts. Everything below it stays at 850. */}
      <div data-qa="content" style={{ paddingTop: 30, width: TITLE_WIDTH }}>
        <Title text={title} />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 48,
          paddingBottom: 10,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Arrowhead for connectors (`markerEnd="url(#id)"`). The id must be unique per template. */
export function ArrowMarker({ id }: { id: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX={9}
      refY={5}
      markerWidth={12}
      markerHeight={12}
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--accent)" />
    </marker>
  );
}

/** Accent dot with glow, used at connector ends. */
export function ConnectorDot({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={11}
        fill="var(--accent)"
        style={{ opacity: "calc(var(--glow) * 0.6)" }}
      />
      <circle cx={x} cy={y} r={6} fill="var(--accent)" />
    </g>
  );
}
