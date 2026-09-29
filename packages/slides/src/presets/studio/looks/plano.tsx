import { SlideIcon } from "../../../icons";
import { type Look, type LookContext, RichText, twoDigits, Wordmark } from "../kit";
import { brandLine, MetaHeader, rhythm } from "./common";

// `plano`: an engineering drawing. Grid, a frame, crosshairs, tables with check boxes and a title
// block along the bottom, like the sheet of a blueprint.

function Grid() {
  const fine = "color-mix(in srgb, var(--fg) 7%, transparent)";
  const coarse = "color-mix(in srgb, var(--fg) 12%, transparent)";
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${fine} 1px, transparent 1px), linear-gradient(90deg, ${fine} 1px, transparent 1px)`,
          backgroundSize: "54px 54px",
          backgroundPosition: "-1px -1px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `linear-gradient(${coarse} 1px, transparent 1px), linear-gradient(90deg, ${coarse} 1px, transparent 1px)`,
          backgroundSize: "270px 270px",
          backgroundPosition: "-1px -1px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 40,
          border: "1px solid color-mix(in srgb, var(--fg) 22%, transparent)",
        }}
      />
    </div>
  );
}

function Cross({ x, y }: { x: number; y: number }) {
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: x - 15, top: y - 15, width: 30, height: 30 }}
    >
      <span
        style={{
          position: "absolute",
          left: 14,
          top: 0,
          width: 2,
          height: 30,
          background: "var(--hl)",
        }}
      />
      <span
        style={{
          position: "absolute",
          top: 14,
          left: 0,
          height: 2,
          width: 30,
          background: "var(--hl)",
        }}
      />
    </div>
  );
}

/** Title block of the sheet. The page cell ends at x = 930, left of TikTok's buttons. */
function TitleBlock({ ctx }: { ctx: LookContext }) {
  const cell = {
    padding: "16px 22px",
    borderRight: "1px solid color-mix(in srgb, var(--fg) 22%, transparent)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: 6,
  } as const;
  const strong = { color: "var(--fg)" };
  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        right: 40,
        bottom: 40,
        height: 92,
        borderTop: "1px solid color-mix(in srgb, var(--fg) 22%, transparent)",
        display: "grid",
        gridTemplateColumns: "250px 1fr 170px 110px",
        fontFamily: "var(--font-mono)",
        fontSize: 17,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--muted)",
      }}
    >
      <div style={cell}>
        <Wordmark ctx={ctx} size={24} />
      </div>
      <div style={cell}>
        <span>Lámina</span>
        <span style={strong}>{brandLine(ctx)}</span>
      </div>
      <div style={cell}>
        <span>Hoja</span>
        <span style={strong}>
          {ctx.page.index === 0
            ? "Deslizá →"
            : `${twoDigits(ctx.page.index + 1)}/${twoDigits(ctx.page.total)}`}
        </span>
      </div>
      <div />
    </div>
  );
}

const border = "color-mix(in srgb, var(--fg) 25%, transparent)";

export const plano: Look = {
  id: "plano",
  title: { weight: 600, caps: false, tracking: -0.04, lineHeight: 1.0 },
  surface: rhythm("ink", ["ink", "ink", "ink", "accent", "ink"], "ink"),
  Backdrop: () => <Grid />,
  Header: (ctx) => (
    <MetaHeader
      left={`[ ${brandLine(ctx)} ]`}
      right={`Fig. ${ctx.page.index + 1}`}
      color="var(--hl)"
    />
  ),
  Footer: (ctx) => <TitleBlock ctx={ctx} />,
  emphasis: (_ctx, where) => (where === "title" ? { color: "var(--hl)" } : { color: "var(--hl)" }),
  Panel: ({ strong, children }) => (
    <div
      style={{
        border: strong ? "2px dashed var(--hl)" : `2px solid ${border}`,
        padding: "30px 34px",
        position: "relative",
      }}
    >
      {children}
    </div>
  ),
  List: ({ ctx, items, numbered }) => (
    <div style={{ border: `1px solid ${border}` }}>
      {items.map((item, i) => (
        <div
          key={item.title}
          style={{
            display: "grid",
            gridTemplateColumns: "96px 1fr 96px",
            borderBottom: i < items.length - 1 ? `1px solid ${border}` : undefined,
          }}
        >
          <span
            style={{
              padding: "24px 20px",
              fontFamily: "var(--font-mono)",
              fontSize: 28,
              color: "var(--hl)",
            }}
          >
            {numbered
              ? twoDigits(i + 1)
              : item.icon && <SlideIcon name={item.icon} size={32} color="var(--hl)" />}
          </span>
          <div
            style={{
              padding: "20px 20px",
              borderLeft: `1px solid ${border}`,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {item.lead && (
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 18,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                }}
              >
                {item.lead}
              </span>
            )}
            <span
              data-qa="text"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: items.length > 4 ? 30 : 34,
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
                  fontSize: 23,
                  lineHeight: 1.35,
                  color: "var(--muted)",
                }}
              >
                <RichText text={item.text} ctx={ctx} />
              </span>
            )}
          </div>
          <div
            style={{
              borderLeft: `1px solid ${border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ width: 34, height: 34, border: "2px solid var(--hl)" }} />
          </div>
        </div>
      ))}
    </div>
  ),
  Button: ({ text, icon }) => (
    <span style={{ display: "inline-flex", alignItems: "stretch", border: "2px solid var(--hl)" }}>
      <span
        data-qa="text"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "28px 34px",
          background: "var(--hl)",
          color: "var(--bg)",
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 32,
        }}
      >
        {icon && <SlideIcon name={icon} size={30} color="var(--bg)" />}
        {text}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
          fontFamily: "var(--font-mono)",
          fontSize: 30,
          color: "var(--hl)",
        }}
      >
        →
      </span>
    </span>
  ),
  Decor: (ctx) => {
    if (ctx.type === "cover") return <Cross x={915} y={125} />;
    if (ctx.type === "question") {
      return (
        <div aria-hidden="true">
          <div
            style={{
              position: "absolute",
              left: 690,
              top: 600,
              width: 300,
              height: 300,
              border: "2px solid var(--hl)",
              borderRadius: 999,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 750,
              top: 660,
              width: 180,
              height: 180,
              border: "1px dashed color-mix(in srgb, var(--hl) 50%, transparent)",
              borderRadius: 999,
            }}
          />
          <Cross x={840} y={750} />
        </div>
      );
    }
    return null;
  },
  compose: { cover: "top", question: "left", cta: "left" },
};
