import { SlideIcon } from "../../../icons";
import { type Look, type LookContext, onSurface, RichText, type Surface, twoDigits } from "../kit";
import { rhythm, WordmarkFooter } from "./common";

// `bloques`: pop. Full-bleed color, giant capitals, solid tiles and stickers. Stops the scroll.

/** Tiles take turns: accent, paper, a panel of the surface, and an outline. */
function tileSurface(ctx: LookContext, i: number): Surface | "panel" | "outline" {
  const order: (Surface | "panel" | "outline")[] =
    ctx.surface === "accent"
      ? ["ink", "paper", "outline", "panel"]
      : ["accent", "paper", "panel", "outline"];
  const pick = order[i % order.length] ?? "panel";
  return pick === ctx.surface ? "panel" : pick;
}

export const bloques: Look = {
  id: "bloques",
  title: { weight: 900, caps: true, tracking: -0.04, lineHeight: 1.02 },
  surface: rhythm("accent", ["ink", "paper", "ink", "accent"], "paper"),
  Header: () => null,
  Footer: (ctx) => <WordmarkFooter ctx={ctx} color="var(--fg)" />,
  emphasis: (ctx, where) =>
    where === "title"
      ? ctx.surface === "accent"
        ? { background: "var(--ink)", color: "var(--accent)", padding: "0 0.08em" }
        : { color: "var(--accent)" }
      : { fontWeight: 800, color: "var(--hl)" },
  Panel: ({ ctx, strong, children }) => (
    <div
      style={{
        borderRadius: 28,
        padding: "34px 38px",
        ...(strong
          ? onSurface(ctx, ctx.surface === "accent" ? "ink" : "accent")
          : { background: "var(--panel)" }),
      }}
    >
      {children}
    </div>
  ),
  List: ({ ctx, items, numbered }) => {
    const small = items.length > 4;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: small && items.length > 4 ? "1fr 1fr 1fr" : "1fr 1fr",
          gap: 18,
        }}
      >
        {items.map((item, i) => {
          const tone = tileSurface(ctx, i);
          const paint =
            tone === "panel"
              ? { background: "var(--panel)" }
              : tone === "outline"
                ? { border: "3px solid var(--accent)" }
                : onSurface(ctx, tone);
          return (
            <div
              key={item.title}
              style={{
                borderRadius: 26,
                padding: small ? "26px 24px" : "32px 32px",
                minHeight: small ? 220 : 280,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 18,
                ...paint,
              }}
            >
              {numbered ? (
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 900,
                    fontSize: small ? 72 : 108,
                    lineHeight: 0.9,
                    letterSpacing: "-0.04em",
                    color:
                      tone === "outline"
                        ? "transparent"
                        : tone === "panel"
                          ? "var(--accent)"
                          : "var(--fg)",
                    WebkitTextStroke: tone === "outline" ? "3px var(--accent)" : undefined,
                  }}
                >
                  {twoDigits(i + 1)}
                </span>
              ) : (
                item.icon && (
                  <SlideIcon
                    name={item.icon}
                    size={small ? 44 : 56}
                    color={tone === "panel" || tone === "outline" ? "var(--accent)" : "var(--fg)"}
                    strokeWidth={2.2}
                  />
                )
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {item.lead && (
                  <span
                    data-qa="text"
                    style={{ fontFamily: "var(--font-body)", fontSize: 22, opacity: 0.75 }}
                  >
                    {item.lead}
                  </span>
                )}
                <span
                  data-qa="text"
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: small ? 27 : 33,
                    lineHeight: 1.1,
                    letterSpacing: "-0.01em",
                  }}
                >
                  <RichText text={item.title} ctx={ctx} />
                </span>
                {item.text && (
                  <span
                    data-qa="text"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 22,
                      lineHeight: 1.3,
                      color: "var(--muted)",
                    }}
                  >
                    <RichText text={item.text} ctx={ctx} />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  },
  Button: ({ ctx, text, icon }) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 40,
        borderRadius: 999,
        padding: "18px 18px 18px 52px",
        ...onSurface(ctx, ctx.surface === "ink" ? "accent" : "ink"),
      }}
    >
      <span
        data-qa="text"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 34,
          textTransform: "uppercase",
          letterSpacing: "0.01em",
        }}
      >
        {text}
      </span>
      <span
        style={{
          width: 108,
          height: 108,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...onSurface(ctx, ctx.surface === "ink" ? "ink" : "accent"),
        }}
      >
        {icon ? (
          <SlideIcon name={icon} size={46} color="var(--fg)" strokeWidth={2.4} />
        ) : (
          <span style={{ fontSize: 50, fontWeight: 800 }}>→</span>
        )}
      </span>
    </span>
  ),
  Decor: (ctx) => {
    if (ctx.type === "cover") {
      return (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 110,
            top: 110,
            width: 200,
            height: 200,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: "rotate(-12deg)",
            fontFamily: "var(--font-display)",
            fontWeight: 900,
            fontSize: 30,
            lineHeight: 1.1,
            textAlign: "center",
            textTransform: "uppercase",
            ...onSurface(ctx, "ink"),
          }}
        >
          Deslizá
          <br />→
        </div>
      );
    }
    if (ctx.type === "question") {
      return (
        <div aria-hidden="true">
          <div
            style={{
              position: "absolute",
              right: -260,
              bottom: -320,
              width: 900,
              height: 900,
              borderRadius: 999,
              background: ctx.surface === "ink" ? "var(--paper)" : "var(--ink)",
              opacity: ctx.surface === "ink" ? 0.08 : 1,
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 60,
              bottom: -30,
              fontFamily: "var(--font-display)",
              fontWeight: 900,
              fontSize: 640,
              lineHeight: 1,
              color: "var(--accent)",
            }}
          >
            ?
          </div>
        </div>
      );
    }
    return null;
  },
  compose: { cover: "bottom", question: "left", cta: "left" },
};
