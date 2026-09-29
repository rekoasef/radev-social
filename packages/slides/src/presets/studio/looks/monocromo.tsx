import { SlideIcon } from "../../../icons";
import { type Look, onSurface, pageLabel, RichText } from "../kit";
import { rhythm } from "./common";

// `monocromo`: extreme minimalism. Black and white only (no accent), one idea per slide, centered
// giant type, an underline for emphasis and almost nothing else.

export const monocromo: Look = {
  id: "monocromo",
  title: { weight: 800, caps: false, tracking: -0.05, lineHeight: 0.98 },
  surface: rhythm("ink", ["paper", "ink"], "paper"),
  vars: () => ({ "--hl": "var(--fg)" }) as Record<string, string>,
  Header: () => null,
  Footer: (ctx) => (
    <div
      style={{
        position: "absolute",
        bottom: 64,
        left: 80,
        width: 850,
        textAlign: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 20,
        letterSpacing: "0.1em",
        color: "var(--muted)",
      }}
    >
      {pageLabel(ctx)}
    </div>
  ),
  emphasis: (_ctx, where) => ({
    textDecoration: "underline",
    textDecorationThickness: where === "title" ? "0.07em" : 3,
    textUnderlineOffset: where === "title" ? "0.1em" : 6,
    ...(where === "text" ? { color: "var(--fg)", fontWeight: 700 } : {}),
  }),
  Panel: ({ ctx, strong, children }) => (
    <div
      style={
        strong
          ? {
              padding: "34px 40px",
              borderRadius: 4,
              ...onSurface(ctx, ctx.surface === "ink" ? "paper" : "ink"),
              ["--hl" as string]: "var(--fg)",
            }
          : { borderLeft: "4px solid var(--fg)", paddingLeft: 30 }
      }
    >
      {children}
    </div>
  ),
  List: ({ ctx, items, numbered }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: items.length > 4 ? 22 : 34 }}>
      {items.map((item, i) => (
        <div key={item.title} style={{ display: "flex", gap: 26, alignItems: "baseline" }}>
          <span
            style={{
              flex: "none",
              width: 60,
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 40,
            }}
          >
            {numbered
              ? `${i + 1}.`
              : item.icon && <SlideIcon name={item.icon} size={34} color="var(--fg)" />}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              data-qa="text"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: items.length > 4 ? 32 : 40,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
              }}
            >
              {item.lead && <span style={{ opacity: 0.55, fontWeight: 400 }}>{item.lead} </span>}
              <RichText text={item.title} ctx={ctx} />
            </span>
            {item.text && (
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 25,
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
  Button: ({ ctx, text }) => (
    <span
      data-qa="text"
      style={{
        display: "inline-block",
        padding: "30px 50px",
        borderRadius: 999,
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 32,
        ...onSurface(ctx, ctx.surface === "ink" ? "paper" : "ink"),
      }}
    >
      {text}
    </span>
  ),
  compose: { cover: "center", question: "center", cta: "center" },
};
