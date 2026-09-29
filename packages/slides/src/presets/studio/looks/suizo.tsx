import { SlideIcon } from "../../../icons";
import { type Look, onSurface, RichText, twoDigits, Wordmark } from "../kit";
import { rhythm } from "./common";

// `suizo`: International Typographic Style. A strict grid, a thick accent bar, huge section
// numbers and flush-left type. Order and clarity.

export const suizo: Look = {
  id: "suizo",
  title: { weight: 800, caps: false, tracking: -0.05, lineHeight: 0.95 },
  surface: rhythm("paper", ["paper", "paper", "accent", "paper", "ink"], "ink"),
  Backdrop: () => (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 26,
          background: "var(--hl)",
        }}
      />
      {[80, 292, 505, 717, 930].map((x) => (
        <div
          key={x}
          style={{
            position: "absolute",
            left: x,
            top: 0,
            bottom: 0,
            width: 1,
            background: "color-mix(in srgb, var(--fg) 7%, transparent)",
          }}
        />
      ))}
    </div>
  ),
  Header: (ctx) => (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 80,
        width: 850,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr 1fr",
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: 20,
        color: "var(--fg)",
      }}
    >
      <Wordmark ctx={ctx} size={24} />
      <span style={{ color: "var(--muted)" }}>{ctx.tokens.handle.site}</span>
      <span />
      <span style={{ color: "var(--muted)" }}>
        {ctx.page.index === 0 ? "Deslizá →" : `${ctx.page.index + 1}/${ctx.page.total}`}
      </span>
    </div>
  ),
  Footer: () => null,
  Decor: (ctx) =>
    ctx.page.index === 0 || ctx.type === "cta" ? null : (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          right: 40,
          bottom: -40,
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: 300,
          lineHeight: 1,
          letterSpacing: "-0.06em",
          color: "color-mix(in srgb, var(--hl) 22%, transparent)",
        }}
      >
        {twoDigits(ctx.page.index + 1)}
      </div>
    ),
  emphasis: (_ctx, where) =>
    where === "title" ? { color: "var(--hl)" } : { fontWeight: 700, color: "var(--fg)" },
  Panel: ({ ctx, strong, children }) => (
    <div
      style={
        strong
          ? { padding: "30px 34px", ...onSurface(ctx, ctx.surface === "accent" ? "ink" : "accent") }
          : { borderLeft: "10px solid var(--hl)", paddingLeft: 30 }
      }
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
          columnGap: 40,
          borderTop: "8px solid var(--fg)",
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.title}
            style={{
              padding: "22px 0 26px",
              borderBottom: "2px solid var(--fg)",
              display: "flex",
              flexDirection: grid ? "column" : "row",
              gap: grid ? 10 : 30,
            }}
          >
            <span
              style={{
                flex: "none",
                width: grid ? undefined : 110,
                fontFamily: "var(--font-display)",
                fontWeight: 900,
                fontSize: grid ? 56 : 72,
                lineHeight: 0.9,
                letterSpacing: "-0.05em",
                color: "var(--hl)",
              }}
            >
              {numbered
                ? twoDigits(i + 1)
                : item.icon && (
                    <SlideIcon
                      name={item.icon}
                      size={grid ? 44 : 56}
                      color="var(--hl)"
                      strokeWidth={2.4}
                    />
                  )}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {item.lead && (
                <span
                  data-qa="text"
                  style={{ fontFamily: "var(--font-body)", fontSize: 22, color: "var(--muted)" }}
                >
                  {item.lead}
                </span>
              )}
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: grid ? 30 : 36,
                  lineHeight: 1.1,
                  letterSpacing: "-0.03em",
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
  Button: ({ ctx, text, icon }) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 60,
        padding: "32px 36px",
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: 32,
        letterSpacing: "-0.01em",
        ...onSurface(ctx, ctx.surface === "accent" ? "ink" : "accent"),
      }}
    >
      <span data-qa="text">{text}</span>
      {icon ? (
        <SlideIcon name={icon} size={34} color="var(--fg)" strokeWidth={2.4} />
      ) : (
        <span>→</span>
      )}
    </span>
  ),
  compose: { cover: "bottom", question: "left", cta: "left" },
};
