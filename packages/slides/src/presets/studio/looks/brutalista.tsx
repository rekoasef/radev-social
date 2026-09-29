import { SlideIcon } from "../../../icons";
import {
  type Look,
  type LookContext,
  onSurface,
  pageLabel,
  RichText,
  twoDigits,
  Wordmark,
} from "../kit";
import { rhythm } from "./common";

// `brutalista`: raw web. Thick borders, hard offset shadows, inverted highlights and a black
// bar on top. Sharp opinions without a filter.

const hard = (color = "var(--fg)") => ({
  border: "5px solid var(--fg)",
  boxShadow: `14px 14px 0 ${color}`,
});

function TopBar({ ctx }: { ctx: LookContext }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 50,
        left: 80,
        width: 850,
        height: 68,
        padding: "0 22px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: 20,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        ...onSurface(ctx, ctx.surface === "ink" ? "paper" : "ink"),
      }}
    >
      <Wordmark ctx={{ ...ctx, surface: ctx.surface === "ink" ? "paper" : "ink" }} size={24} />
      <span>■ ■ ■ {pageLabel(ctx, "/")}</span>
    </div>
  );
}

export const brutalista: Look = {
  id: "brutalista",
  title: { weight: 900, caps: false, tracking: -0.04, lineHeight: 0.98 },
  surface: rhythm("paper", ["paper", "accent", "paper", "ink"], "accent"),
  Header: (ctx) => <TopBar ctx={ctx} />,
  Footer: () => null,
  emphasis: (_ctx, where) =>
    where === "title"
      ? { background: "var(--fg)", color: "var(--bg)", padding: "0 0.1em" }
      : {
          fontWeight: 800,
          color: "var(--fg)",
          textDecoration: "underline",
          textDecorationThickness: 4,
          textUnderlineOffset: 5,
        },
  Panel: ({ ctx, strong, children }) => (
    <div
      style={{
        padding: "30px 34px",
        ...hard(strong ? "var(--fg)" : "var(--hl)"),
        ...(strong
          ? onSurface(ctx, ctx.surface === "accent" ? "paper" : "accent")
          : { background: "var(--bg)" }),
      }}
    >
      {children}
    </div>
  ),
  List: ({ ctx, items, numbered }) => {
    const grid = items.length > 3;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: grid ? "1fr 1fr" : "1fr",
          gap: grid ? 28 : 24,
          paddingRight: 14,
          paddingBottom: 14,
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.title}
            style={{
              position: "relative",
              padding: "26px 28px",
              background: "var(--bg)",
              ...hard(i % 2 ? "var(--fg)" : "var(--hl)"),
            }}
          >
            <span
              style={{
                position: "absolute",
                top: -5,
                right: -5,
                padding: "8px 14px",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: 22,
                ...onSurface(ctx, ctx.surface === "ink" ? "paper" : "ink"),
              }}
            >
              {numbered ? (
                twoDigits(i + 1)
              ) : item.icon ? (
                <SlideIcon name={item.icon} size={24} color="var(--fg)" />
              ) : (
                "■"
              )}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingRight: 60 }}>
              {item.lead && (
                <span
                  data-qa="text"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 20,
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  {item.lead}
                </span>
              )}
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 900,
                  fontSize: grid ? 29 : 34,
                  lineHeight: 1.1,
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
                    fontSize: 23,
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
  Button: ({ ctx, text }) => (
    <span
      data-qa="text"
      style={{
        display: "inline-block",
        padding: "30px 40px",
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: 30,
        textTransform: "uppercase",
        ...hard(),
        ...onSurface(ctx, ctx.surface === "accent" ? "paper" : "accent"),
      }}
    >
      {text} ↗
    </span>
  ),
  Decor: (ctx) =>
    ctx.type === "cover" ? (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 60,
          top: 150,
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: 420,
          lineHeight: 1,
          color: "var(--hl)",
          transform: "rotate(12deg)",
        }}
      >
        ✱
      </div>
    ) : null,
  compose: { cover: "bottom", question: "left", cta: "left" },
};
