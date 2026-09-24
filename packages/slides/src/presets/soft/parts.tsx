import type { CSSProperties, ReactNode } from "react";
import { parseEmphasis } from "../../content/emphasis";
import { SAFE_AREA } from "../../frame/geometry";
import type { SlideAsset } from "../../frame/types";
import { SlideIcon } from "../../icons";
import { fitTextSize, type GlyphWidths } from "../shared/fit";

// Building blocks shared by the `soft` templates (docs/DESIGN-SYSTEM.md §8). Colors and fonts
// come from the CSS variables set by SoftFrame; nothing here is brand-specific.

/** The title may take the full safe width (920); everything below it stays at 850. */
export const TITLE_WIDTH = SAFE_AREA.width;

/** Emphasis in `soft` is color only: calmer than `bold`. */
export const emphasisStyle: CSSProperties = { color: "var(--accent)" };

/** Emphasis up to this length stays on one line in titles ("por fin clara", not "por / fin clara"). */
const KEEP_TOGETHER = 20;

/** Text with `*emphasis*` in the accent color. `keepTogether` avoids breaking short emphasis. */
export function Rich({ text, keepTogether = false }: { text: string; keepTogether?: boolean }) {
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
            style={
              keepTogether && [...segment.text].length <= KEEP_TOGETHER
                ? { ...emphasisStyle, whiteSpace: "nowrap" }
                : emphasisStyle
            }
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

/** Small uppercase label: kickers, section names. */
export function labelText(size: number): CSSProperties {
  return {
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: size,
    letterSpacing: "0.18em",
    lineHeight: 1.5,
    textTransform: "uppercase",
    color: "var(--muted)",
  };
}

/**
 * Hanken Grotesk 600 (sentence case): 0.492 em per letter in src/fonts/metrics.json, minus the
 * title's tracking (-0.01em), plus ~7% margin: lines of long words with m and n run wider than
 * the average. Other fonts are scaled to this width by --title-scale.
 */
export const TITLE_GLYPHS: GlyphWidths = { char: 0.52, space: 0.26 };

/** Visible text of a title (without emphasis marks). */
export const plainOf = (text: string) => {
  const parsed = parseEmphasis(text);
  return parsed.ok ? parsed.plain : text;
};

/**
 * Title size: the biggest that keeps the title in 3 lines at its width. A notch below `bold`:
 * `soft` leaves more air (calibrated in T11).
 */
export function titleSize(text: string, width = TITLE_WIDTH): number {
  return fitTextSize(plainOf(text), {
    width,
    sizes: [92, 78, 66, 58],
    maxLines: 3,
    glyphs: TITLE_GLYPHS,
  });
}

export function Title({
  text,
  size = titleSize(text),
  align = "left",
}: {
  text: string;
  size?: number;
  align?: "left" | "center";
}) {
  return (
    <h1
      data-qa="text"
      style={{
        margin: 0,
        paddingBottom: "0.1em",
        fontFamily: "var(--font-display)",
        fontWeight: "var(--weight-display)",
        // --title-scale (set by the frame) shrinks wider fonts to the width `size` was fit for.
        fontSize: `calc(${size}px * var(--title-scale, 1))`,
        lineHeight: 1.08,
        letterSpacing: "-0.01em",
        textWrap: "balance",
        textAlign: align,
        color: "var(--text)",
      }}
    >
      <Rich text={text} keepTogether />
    </h1>
  );
}

/** Support copy in the secondary color. `\n` breaks lines. */
export function Support({
  text,
  size = 32,
  align = "left",
}: {
  text: string;
  size?: number;
  align?: "left" | "center";
}) {
  return (
    <p
      data-qa="text"
      style={{
        margin: 0,
        fontFamily: "var(--font-body)",
        fontWeight: "var(--weight-body)",
        fontSize: size,
        lineHeight: 1.4,
        whiteSpace: "pre-line",
        textWrap: "pretty",
        textAlign: align,
        color: "var(--secondary)",
      }}
    >
      <Rich text={text} />
    </p>
  );
}

/** Glass panel: translucent surface, hairline border, brighter top edge. */
export function glassStyle(radius = "var(--radius-panel)"): CSSProperties {
  return {
    boxSizing: "border-box",
    background: "var(--glass-bg)",
    border: "1px solid var(--glass-border)",
    borderTopColor: "var(--glass-border-top)",
    borderRadius: radius,
    backdropFilter: "blur(24px)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
  };
}

/** Icon on a soft accent tint. `accent` marks the destination or the highlighted item. */
export function IconBadge({
  name,
  size = 72,
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
        borderRadius: Math.round(size * 0.3),
        background: accent
          ? "color-mix(in srgb, var(--accent) 16%, transparent)"
          : "color-mix(in srgb, var(--text) 6%, transparent)",
        color: accent ? "var(--accent)" : "var(--secondary)",
      }}
    >
      <SlideIcon name={name} size={Math.round(size * 0.46)} strokeWidth={1.8} />
    </span>
  );
}

/** The brand's hero element (e.g. Lumus's orb), with a soft glow behind it. */
export function Hero({ asset, size }: { asset: SlideAsset; size: number }) {
  // Square, `size` at most: it shrinks with the space its container leaves (a long title or
  // subtitle), instead of pushing them out of the safe area.
  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        maxHeight: size,
        aspectRatio: "1",
        flexShrink: 1,
        minHeight: 0,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-18%",
          borderRadius: "50%",
          background:
            "radial-gradient(closest-side, color-mix(in srgb, var(--accent) 22%, transparent), transparent)",
        }}
      />
      <img
        src={asset.url}
        alt=""
        style={{
          position: "relative",
          display: "block",
          width: size,
          height: size,
          objectFit: "contain",
        }}
      />
    </div>
  );
}

/** Vertical layout shared by the templates: title on top, the rest centered below it. */
export function TemplateLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
    <p data-qa="text" style={{ margin: 0, ...labelText(15) }}>
      Fuente: {text}
    </p>
  );
}

/** Stroke of diagram connectors: thin and quiet. */
export const connectorStroke = {
  stroke: "var(--accent)",
  strokeWidth: 1.5,
  opacity: 0.55,
  fill: "none",
} as const;

/** Small accent dot at connector ends, no glow. */
export function ConnectorDot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r={4.5} fill="var(--accent)" />;
}

/** Open arrowhead for connectors (`markerEnd="url(#id)"`). The id must be unique per template. */
export function ArrowMarker({ id }: { id: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX={9}
      refY={5}
      markerWidth={14}
      markerHeight={14}
      markerUnits="userSpaceOnUse"
      orient="auto"
    >
      <path
        d="M 1 1 L 9 5 L 1 9"
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </marker>
  );
}

/** Numbers: the brand's numeric font with tabular digits. */
export const numericText: CSSProperties = {
  fontFamily: "var(--font-numeric)",
  fontWeight: "var(--weight-numeric)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};
