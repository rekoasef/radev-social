import { SlideIcon } from "../../../icons";
import type { Look } from "../kit";
import { RichText, twoDigits } from "../kit";
import { brandLine, MetaHeader, rhythm, WordmarkFooter } from "./common";

// `editorial`: paper and ink like a magazine. Huge lowercase titles, thin rules instead of boxes,
// the accent as a single mark, and the background changing along the carousel.

export const editorial: Look = {
  id: "editorial",
  title: { weight: 700, caps: false, tracking: -0.045, lineHeight: 0.96 },
  surface: rhythm("paper", ["ink", "paper", "paper", "accent"], "ink"),
  Header: (ctx) => <MetaHeader left={brandLine(ctx)} />,
  Footer: (ctx) => <WordmarkFooter ctx={ctx} />,
  emphasis: (_ctx, where) =>
    where === "title" ? { color: "var(--hl)" } : { color: "var(--fg)", fontWeight: 600 },
  Panel: ({ strong, children }) => (
    <div
      style={{
        borderTop: `2px solid ${strong ? "var(--hl)" : "var(--fg)"}`,
        paddingTop: 28,
      }}
    >
      {children}
    </div>
  ),
  List: ({ ctx, items, numbered }) => {
    const twoCols = items.length > 4;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: twoCols ? "1fr 1fr" : "1fr",
          columnGap: 40,
          borderTop: "2px solid var(--fg)",
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.title}
            style={{
              display: "flex",
              gap: 28,
              padding: "26px 0",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <span
              style={{
                width: numbered ? 76 : 44,
                flex: "none",
                fontFamily: "var(--font-mono)",
                fontSize: 38,
                lineHeight: 1.1,
                color: "var(--hl)",
              }}
            >
              {numbered
                ? twoDigits(i + 1)
                : item.icon && <SlideIcon name={item.icon} size={38} color="var(--hl)" />}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {item.lead && (
                <span
                  data-qa="text"
                  style={{ fontFamily: "var(--font-body)", fontSize: 24, color: "var(--muted)" }}
                >
                  {item.lead}
                </span>
              )}
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: twoCols ? 30 : 36,
                  lineHeight: 1.12,
                  letterSpacing: "-0.02em",
                }}
              >
                <RichText text={item.title} ctx={ctx} />
              </span>
              {item.text && (
                <span
                  data-qa="text"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 25,
                    lineHeight: 1.35,
                    color: "var(--muted)",
                  }}
                >
                  <RichText text={item.text} ctx={ctx} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  },
  Button: ({ text, icon }) => (
    <span
      data-qa="text"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 18,
        background: "var(--accent)",
        color: "var(--ink)",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 32,
        padding: "30px 42px",
        borderRadius: 999,
      }}
    >
      {icon && <SlideIcon name={icon} size={32} color="var(--ink)" />}
      {text} →
    </span>
  ),
  Decor: (ctx) =>
    ctx.type === "question" ? (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: -70,
          top: 420,
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 960,
          lineHeight: 1,
          letterSpacing: "-0.08em",
          color: "var(--hl)",
        }}
      >
        ?
      </div>
    ) : null,
  compose: { cover: "top", question: "left", cta: "left" },
};
