import type { SlideOf } from "../../../content/slides";
import { SlideIcon } from "../../../icons";
import { BOLD_CONTENT_BOX } from "../frame";
import { glowShadow, labelText, Support, TemplateLayout } from "../parts";
import type { BoldTokens } from "../tokens";

// `cta`: the closing. Title, subtitle and a solid accent button with the action; below it, the
// brand's tagline (tokens.footer.tagline), which left the footer because TikTok covers it there.
// The frame adds the glow.

export function CtaTemplate({ slide, tokens }: { slide: SlideOf<"cta">; tokens: BoldTokens }) {
  const tagline = tokens.footer.tagline;
  return (
    <TemplateLayout title={slide.title} layout={slide.layout}>
      {slide.subtitle && (
        <div style={{ maxWidth: 760 }}>
          <Support text={slide.subtitle} size={36} />
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 56 }}>
        <div
          data-qa="content"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 20,
            maxWidth: BOLD_CONTENT_BOX.width,
            boxSizing: "border-box",
            padding: "28px 44px",
            borderRadius: "var(--radius-callout)",
            background: "var(--accent)",
            color: "var(--bg)",
            boxShadow: glowShadow(44),
          }}
        >
          {slide.icon && (
            <span style={{ display: "inline-flex", flexShrink: 0 }}>
              <SlideIcon name={slide.icon} size={38} strokeWidth={2.2} />
            </span>
          )}
          <span
            data-qa="text"
            style={{
              fontFamily: "var(--font-label)",
              fontWeight: 700,
              fontSize: 32,
              lineHeight: 1.15,
              textWrap: "balance",
            }}
          >
            {slide.button}
          </span>
        </div>
        {tagline.length > 0 && (
          <div data-qa="content" style={{ display: "flex", alignItems: "stretch", gap: 16 }}>
            <span style={{ width: 2, background: "var(--accent)", opacity: 0.9 }} />
            <span data-qa="text" style={{ ...labelText(16), color: "var(--muted)" }}>
              {tagline.map((line) => (
                <span key={line} style={{ display: "block" }}>
                  {line}
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
    </TemplateLayout>
  );
}
