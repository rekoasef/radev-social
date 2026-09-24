import type { CSSProperties, ReactNode } from "react";
import { parseEmphasis } from "../../content/emphasis";
import { SAFE_AREA } from "../../frame/geometry";
import { SlideIcon } from "../../icons";

import { fitTextSize, type GlyphWidths } from "../shared/fit";

export { fitFontSize } from "../shared/fit";

// Building blocks shared by the `bold` templates (docs/DESIGN-SYSTEM.md §7). Colors and fonts
// come from the CSS variables set by BoldFrame; nothing here is brand-specific.

/** The title may take the full safe width (920); everything below it stays at 850. */
export const TITLE_WIDTH = SAFE_AREA.width;

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

/**
 * Inter Tight 900 in capitals with the title's tracking (-0.02em letters, +0.12em spaces),
 * measured in the browser on long Spanish words (T11), with ~5% margin.
 */
export const TITLE_GLYPHS: GlyphWidths = { char: 0.64, space: 0.37 };

/** Visible text of a title (without emphasis marks). */
export const plainOf = (text: string) => {
  const parsed = parseEmphasis(text);
  return parsed.ok ? parsed.plain : text;
};

/**
 * Title size: the biggest that keeps the title in 3 lines at its width (calibrated in T11). Long
 * words weigh more than the character count: "MANTENIMIENTO" takes a line of its own.
 */
export function titleSize(text: string, width = TITLE_WIDTH): number {
  return fitTextSize(plainOf(text), {
    width,
    sizes: [100, 84, 70, 60],
    maxLines: 3,
    glyphs: TITLE_GLYPHS,
  });
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

/** Where a figure comes from. Every data slide shows it (docs/DESIGN-SYSTEM.md §5). */
export function Source({ text }: { text: string }) {
  return (
    <p
      data-qa="text"
      style={{ margin: 0, ...labelText(15), letterSpacing: "0.2em", color: "var(--muted)" }}
    >
      Fuente: {text}
    </p>
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
