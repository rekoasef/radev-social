import { SlideIcon } from "../../../icons";
import { type Look, pageLabel, RichText } from "../kit";
import { brandLine, rhythm } from "./common";

// `revista`: a classic magazine. Serif titles with italic emphasis, a centered masthead over a
// double rule, roman numerals and an underlined call to action. Weight and elegance.

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

const doubleRule = (color = "var(--fg)") => `4px double ${color}`;

export const revista: Look = {
  id: "revista",
  title: { font: "serif", weight: 500, caps: false, tracking: -0.025, lineHeight: 1.02 },
  surface: rhythm("paper", ["paper", "ink", "paper", "paper"], "ink"),
  Header: (ctx) => (
    <div style={{ position: "absolute", top: 70, left: 80, width: 850, textAlign: "center" }}>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 600,
          fontSize: 26,
          letterSpacing: "0.32em",
          textTransform: "uppercase",
          paddingBottom: 14,
          borderBottom: doubleRule(),
        }}
      >
        {brandLine(ctx)}
      </div>
    </div>
  ),
  Footer: (ctx) => (
    <div
      style={{
        position: "absolute",
        bottom: 64,
        left: 80,
        width: 850,
        textAlign: "center",
        fontFamily: "var(--font-serif)",
        fontStyle: "italic",
        fontSize: 24,
        color: "var(--muted)",
      }}
    >
      — {pageLabel(ctx)} —
    </div>
  ),
  emphasis: (_ctx, where) =>
    where === "title"
      ? { fontStyle: "italic", color: "var(--hl)" }
      : { fontStyle: "italic", color: "var(--fg)" },
  Panel: ({ strong, children }) => (
    <div
      style={{
        borderTop: doubleRule(strong ? "var(--hl)" : "var(--fg)"),
        borderBottom: `1px solid ${strong ? "var(--hl)" : "var(--line)"}`,
        padding: "28px 0",
      }}
    >
      {children}
    </div>
  ),
  List: ({ ctx, items, numbered }) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: items.length > 4 ? "1fr 1fr" : "1fr",
        columnGap: 44,
        borderTop: doubleRule(),
      }}
    >
      {items.map((item, i) => (
        <div
          key={item.title}
          style={{
            display: "flex",
            gap: 26,
            padding: "24px 0",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span
            style={{
              flex: "none",
              width: 64,
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              fontSize: 40,
              lineHeight: 1.05,
              color: "var(--hl)",
            }}
          >
            {numbered
              ? ROMAN[i]
              : item.icon && (
                  <SlideIcon name={item.icon} size={34} color="var(--hl)" strokeWidth={1.5} />
                )}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {item.lead && (
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  fontSize: 22,
                  color: "var(--muted)",
                }}
              >
                {item.lead}
              </span>
            )}
            <span
              data-qa="text"
              style={{
                fontFamily: "var(--font-serif)",
                fontWeight: 600,
                fontSize: items.length > 4 ? 30 : 36,
                lineHeight: 1.12,
              }}
            >
              <RichText text={item.title} ctx={ctx} />
            </span>
            {item.text && (
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 24,
                  lineHeight: 1.4,
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
  ),
  Button: ({ text }) => (
    <span
      data-qa="text"
      style={{
        fontFamily: "var(--font-serif)",
        fontStyle: "italic",
        fontSize: 44,
        lineHeight: 1.2,
        color: "var(--fg)",
        textDecoration: "underline",
        textDecorationColor: "var(--hl)",
        textDecorationThickness: 3,
        textUnderlineOffset: 10,
      }}
    >
      {text} →
    </span>
  ),
  Decor: (ctx) =>
    ctx.type === "question" ? (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 150,
          textAlign: "center",
          fontFamily: "var(--font-serif)",
          fontStyle: "italic",
          fontWeight: 300,
          fontSize: 900,
          lineHeight: 1,
          color: "color-mix(in srgb, var(--hl) 16%, transparent)",
        }}
      >
        ?
      </div>
    ) : ctx.type === "cover" ? (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 80,
          width: 850,
          top: 1140,
          borderTop: "1px solid var(--line)",
        }}
      />
    ) : null,
  compose: { cover: "center", question: "center", cta: "center" },
};
