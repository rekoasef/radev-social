import type { CSSProperties, ReactNode } from "react";
import { fontStack } from "../../fonts/registry";
import { FORMAT, type Rect } from "../../frame/geometry";
import { type FrameProps, resolveAsset, type SlideAsset } from "../../frame/types";
import { BoldDecorations } from "./decorations";
import type { BoldTokens } from "./tokens";

// Frame of the `bold` preset (docs/DESIGN-SYSTEM.md §4 and §7): corner labels, footer with
// wordmark and page indicator, decorations. Measured on docs/references/radev/ (1122 px wide,
// scaled to 1080). No tagline in the footer: TikTok's button column covers its bottom right.

/**
 * Where templates lay out their content: inside the safe area, between header and footer, and
 * left of TikTok's button column (x < 930) at every height, so no template has to dodge it.
 */
export const BOLD_CONTENT_BOX: Rect = { x: 80, y: 150, width: 850, height: 1040 };

const FOOTER_TOP = 1228;
/** The page indicator ends at x = 930, where TikTok's button column starts. */
const FOOTER_RIGHT = FORMAT.width - 930;

function cssVars(t: BoldTokens): CSSProperties {
  return {
    "--bg": t.colors.bg,
    "--surface": t.colors.surface,
    "--accent": t.colors.accent,
    "--text": t.colors.text,
    "--muted": t.colors.muted,
    "--line": t.colors.line,
    "--glow": t.glow.intensity * 2,
    "--font-display": fontStack(t.fonts.display.family),
    "--weight-display": t.fonts.display.weight,
    "--font-body": fontStack(t.fonts.body.family),
    "--weight-body": t.fonts.body.weight,
    "--font-label": fontStack(t.fonts.label.family),
    "--weight-label": t.fonts.label.weight,
    "--radius-card": `${t.radius.card}px`,
    "--radius-callout": `${t.radius.callout}px`,
  } as CSSProperties;
}

const label: CSSProperties = {
  fontFamily: "var(--font-label)",
  fontWeight: "var(--weight-label)",
  fontSize: 13,
  letterSpacing: "0.3em",
  lineHeight: 1.55,
  textTransform: "uppercase",
  color: "var(--text)",
};

function CornerLabel({ text, side }: { text: string; side: "left" | "right" }) {
  if (!text) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 50,
        [side]: 78,
        display: "flex",
        flexDirection: side === "left" ? "row" : "row-reverse",
        alignItems: "stretch",
        gap: 16,
      }}
    >
      <span style={{ width: 2, background: "var(--text)", opacity: 0.85 }} />
      <span style={{ ...label, maxWidth: "11em", textWrap: "balance", textAlign: side }}>
        {text}
      </span>
    </div>
  );
}

/** The brand's logo replaces the wordmark when there is one (docs/DESIGN-SYSTEM.md §7). */
function Logo({ logo, brandName }: { logo: SlideAsset; brandName: string }) {
  return (
    <img src={logo.url} alt={brandName} style={{ display: "block", height: 44, width: "auto" }} />
  );
}

function Wordmark({ tokens, brandName }: { tokens: BoldTokens["wordmark"]; brandName: string }) {
  const empty = !tokens.strong && !tokens.light;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        fontFamily: "var(--font-label)",
        fontSize: 30,
        letterSpacing: "-0.01em",
        color: "var(--text)",
      }}
    >
      <span style={{ fontWeight: 700 }}>{empty ? brandName : tokens.strong}</span>
      {!empty && <span style={{ fontWeight: 400 }}>{tokens.light}</span>}
      {tokens.dot && (
        <span
          style={{
            width: 9,
            height: 9,
            marginLeft: 11,
            borderRadius: "50%",
            background: "var(--accent)",
            boxShadow: "0 0 12px var(--accent)",
            alignSelf: "center",
            transform: "translateY(3px)",
          }}
        />
      )}
    </span>
  );
}

function PageIndicator({ index, total }: { index: number; total: number }) {
  if (index === 0) {
    return (
      <span style={{ ...label, color: "var(--accent)", letterSpacing: "0.2em" }}>Deslizá →</span>
    );
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span style={{ ...label, letterSpacing: "0.2em" }}>
      {pad(index + 1)}
      <span style={{ color: "var(--muted)" }}> / {pad(total)}</span>
    </span>
  );
}

export function BoldFrame({
  tokens,
  brandName,
  page,
  seed,
  glow = false,
  assets = {},
  children,
}: FrameProps<BoldTokens> & { children?: ReactNode }) {
  const logo = resolveAsset(assets, tokens.logoAsset);
  const id = `f${page.index}-${seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}`;
  const background = glow
    ? `radial-gradient(900px 700px at 78% 18%, color-mix(in srgb, var(--accent) ${Math.round(
        tokens.glow.intensity * 40,
      )}%, transparent), transparent 70%), var(--bg)`
    : "var(--bg)";

  return (
    <div
      data-slide-frame=""
      style={{
        ...cssVars(tokens),
        position: "relative",
        width: FORMAT.width,
        height: FORMAT.height,
        overflow: "hidden",
        background,
        color: "var(--text)",
        fontFamily: "var(--font-body)",
      }}
    >
      <BoldDecorations seed={seed} id={id} />

      <CornerLabel text={tokens.header.left} side="left" />
      <CornerLabel text={tokens.header.right} side="right" />

      <div
        style={{
          position: "absolute",
          left: BOLD_CONTENT_BOX.x,
          top: BOLD_CONTENT_BOX.y,
          width: BOLD_CONTENT_BOX.width,
          height: BOLD_CONTENT_BOX.height,
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
          right: 80,
          top: FOOTER_TOP,
          borderTop: "1px solid color-mix(in srgb, var(--text) 30%, transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 80,
          // Ends left of TikTok's button column: "Deslizá →" must stay visible.
          right: FOOTER_RIGHT,
          top: FOOTER_TOP + 22,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {logo ? (
          <Logo logo={logo} brandName={brandName} />
        ) : (
          <Wordmark tokens={tokens.wordmark} brandName={brandName} />
        )}
        <PageIndicator index={page.index} total={page.total} />
      </div>
    </div>
  );
}
