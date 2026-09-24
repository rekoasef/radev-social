import type { CSSProperties, ReactNode } from "react";
import { fontStack } from "../../fonts/registry";
import { FORMAT, type Rect } from "../../frame/geometry";
import type { FrameProps } from "../../frame/types";
import type { SoftTokens } from "./tokens";

// Frame of the `soft` preset (docs/DESIGN-SYSTEM.md §8): calm and premium. The brand's glows and
// a faint grid on the background, the wordmark on top, the site and the page indicator at the
// bottom. No lines or corner labels: the color signals, it does not decorate.

/** Same box as `bold`: inside the safe area and left of TikTok's button column. */
export const SOFT_CONTENT_BOX: Rect = { x: 80, y: 150, width: 850, height: 1040 };

const FOOTER_TOP = 1238;
/** The page indicator ends at x = 930, where TikTok's button column starts. */
const FOOTER_RIGHT = FORMAT.width - 930;

function cssVars(t: SoftTokens): CSSProperties {
  return {
    "--bg": t.colors.bg,
    "--surface": t.colors.surface,
    "--elevated": t.colors.elevated,
    "--line": t.colors.line,
    "--text": t.colors.text,
    "--secondary": t.colors.secondary,
    "--muted": t.colors.muted,
    "--accent": t.colors.accent,
    "--wordmark": t.colors.wordmark,
    "--accent2": t.colors.accent2,
    "--positive": t.colors.positive,
    "--negative": t.colors.negative,
    "--glass-bg": t.glass.background,
    "--glass-border": t.glass.border,
    "--glass-border-top": t.glass.borderTop,
    "--font-display": fontStack(t.fonts.display.family),
    "--weight-display": t.fonts.display.weight,
    "--font-body": fontStack(t.fonts.body.family),
    "--weight-body": t.fonts.body.weight,
    "--font-numeric": fontStack(t.fonts.numeric.family),
    "--weight-numeric": t.fonts.numeric.weight,
    "--radius-card": `${t.radius.card}px`,
    "--radius-panel": `${t.radius.panel}px`,
  } as CSSProperties;
}

const GLOW_AT: Record<SoftTokens["glows"][number]["position"], string> = {
  "top-left": "8% 4%",
  "top-right": "92% 4%",
  "bottom-left": "8% 96%",
  "bottom-right": "92% 96%",
  center: "50% 50%",
};

function background(glows: SoftTokens["glows"], glow: boolean): string {
  const layers = glows.map(
    (g) => `radial-gradient(900px 760px at ${GLOW_AT[g.position]}, ${g.color}, transparent 70%)`,
  );
  // Cover and cta: a wider accent glow around the hero asset.
  if (glow) {
    layers.unshift(
      "radial-gradient(640px 640px at 50% 58%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 70%)",
    );
  }
  return [...layers, "var(--bg)"].join(", ");
}

/** Faint grid that fades out toward the bottom, like the brand's landing sections. */
function Grid() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        backgroundPosition: "36px 36px",
        maskImage: "linear-gradient(180deg, black 0%, black 35%, transparent 85%)",
      }}
    />
  );
}

const small: CSSProperties = {
  fontFamily: "var(--font-numeric)",
  fontWeight: "var(--weight-numeric)",
  fontSize: 18,
  letterSpacing: "0.04em",
  color: "var(--muted)",
};

function PageIndicator({ index, total }: { index: number; total: number }) {
  if (index === 0) {
    return (
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize: 20,
          color: "var(--accent)",
        }}
      >
        Deslizá →
      </span>
    );
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span style={small}>
      <span style={{ color: "var(--text)" }}>{pad(index + 1)}</span> / {pad(total)}
    </span>
  );
}

export function SoftFrame({
  tokens,
  brandName,
  page,
  glow = false,
  children,
}: FrameProps<SoftTokens> & { children?: ReactNode }) {
  return (
    <div
      data-slide-frame=""
      style={{
        ...cssVars(tokens),
        position: "relative",
        width: FORMAT.width,
        height: FORMAT.height,
        overflow: "hidden",
        background: background(tokens.glows, glow),
        color: "var(--text)",
        fontFamily: "var(--font-body)",
      }}
    >
      <Grid />

      <div
        style={{
          position: "absolute",
          left: 80,
          top: 70,
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 24,
          letterSpacing: `${tokens.wordmark.tracking}em`,
          color: "var(--wordmark)",
        }}
      >
        {tokens.wordmark.text || brandName}
      </div>

      <div
        style={{
          position: "absolute",
          left: SOFT_CONTENT_BOX.x,
          top: SOFT_CONTENT_BOX.y,
          width: SOFT_CONTENT_BOX.width,
          height: SOFT_CONTENT_BOX.height,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>

      <div
        style={{
          position: "absolute",
          left: 80,
          // Ends left of TikTok's button column: "Deslizá →" must stay visible.
          right: FOOTER_RIGHT,
          top: FOOTER_TOP,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={small}>{tokens.footer.url}</span>
        <PageIndicator index={page.index} total={page.total} />
      </div>
    </div>
  );
}
