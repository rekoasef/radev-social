import { SlideIcon } from "../../../icons";
import { type Look, onSurface, pageLabel, RichText, twoDigits } from "../kit";
import { brandLine } from "./common";

// `recibo`: a till receipt. A paper ticket with zigzag edges over ink, mono capitals, dotted
// leaders and a barcode. Made for prices, costs and "what you really pay".

const ZIGZAG = (() => {
  const teeth = 36;
  const top = Array.from(
    { length: teeth },
    (_, i) => `${((i + 0.5) / teeth) * 100}% 0, ${((i + 1) / teeth) * 100}% 14px`,
  ).join(", ");
  const bottom = Array.from({ length: teeth }, (_, i) => {
    const x = 100 - ((i + 0.5) / teeth) * 100;
    const x2 = 100 - ((i + 1) / teeth) * 100;
    return `${x}% 100%, ${x2}% calc(100% - 14px)`;
  }).join(", ");
  return `polygon(0 14px, ${top}, 100% calc(100% - 14px), ${bottom})`;
})();

const dashed = "3px dashed color-mix(in srgb, var(--fg) 45%, transparent)";

function Ticket() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: "var(--ink)" }}>
      <div
        style={{
          position: "absolute",
          left: 40,
          width: 930,
          top: 30,
          bottom: 30,
          background: "var(--paper)",
          clipPath: ZIGZAG,
          boxShadow: "0 30px 60px rgba(0,0,0,.4)",
        }}
      />
    </div>
  );
}

function Barcode() {
  return (
    <span
      style={{
        display: "block",
        width: 260,
        height: 46,
        backgroundImage:
          "repeating-linear-gradient(90deg, var(--fg) 0 3px, transparent 3px 6px, var(--fg) 6px 7px, transparent 7px 11px, var(--fg) 11px 15px, transparent 15px 17px)",
      }}
    />
  );
}

export const recibo: Look = {
  id: "recibo",
  title: { font: "mono", weight: 700, caps: true, tracking: -0.02, lineHeight: 1.08 },
  surface: () => "paper",
  Backdrop: () => <Ticket />,
  Header: (ctx) => (
    <div
      style={{
        position: "absolute",
        top: 72,
        left: 80,
        width: 850,
        paddingBottom: 16,
        borderBottom: dashed,
        display: "flex",
        justifyContent: "space-between",
        fontFamily: "var(--font-mono)",
        fontSize: 20,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      <span>*** {brandLine(ctx)} ***</span>
      <span style={{ color: "var(--muted)" }}>Ticket {twoDigits(ctx.page.index + 1)}</span>
    </div>
  ),
  Footer: (ctx) => (
    <div
      style={{
        position: "absolute",
        bottom: 66,
        left: 80,
        width: 850,
        paddingTop: 18,
        borderTop: dashed,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 20,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--muted)",
      }}
    >
      <Barcode />
      <span>{pageLabel(ctx)}</span>
    </div>
  ),
  emphasis: (_ctx, where) =>
    where === "title"
      ? { background: "var(--fg)", color: "var(--bg)", padding: "0 0.12em" }
      : {
          fontWeight: 700,
          color: "var(--fg)",
          textDecoration: "underline",
          textUnderlineOffset: 5,
        },
  Panel: ({ ctx, strong, children }) => (
    <div
      style={
        strong
          ? { padding: "28px 32px", ...onSurface(ctx, "ink") }
          : { border: dashed, padding: "28px 32px" }
      }
    >
      {children}
    </div>
  ),
  List: ({ ctx, items, numbered }) => (
    <div style={{ display: "flex", flexDirection: "column", fontFamily: "var(--font-mono)" }}>
      {items.map((item, i) => (
        <div
          key={item.title}
          style={{ padding: items.length > 4 ? "14px 0" : "20px 0", borderBottom: dashed }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <span style={{ flex: "none", fontSize: 26, color: "var(--muted)" }}>
              {numbered ? (
                `${twoDigits(i + 1)}x`
              ) : item.icon ? (
                <SlideIcon name={item.icon} size={26} color="var(--fg)" />
              ) : (
                "·"
              )}
            </span>
            <span
              data-qa="text"
              style={{
                fontSize: items.length > 4 ? 25 : 28,
                fontWeight: 700,
                textTransform: "uppercase",
                lineHeight: 1.3,
              }}
            >
              {item.lead && <span style={{ opacity: 0.55, fontWeight: 400 }}>{item.lead} </span>}
              <RichText text={item.title} ctx={ctx} />
            </span>
            <span
              style={{
                flex: 1,
                borderBottom: "3px dotted color-mix(in srgb, var(--fg) 40%, transparent)",
                transform: "translateY(-6px)",
              }}
            />
            <span style={{ fontSize: 26 }}>✓</span>
          </div>
          {item.text && (
            <span
              data-qa="text"
              style={{
                display: "block",
                marginTop: 6,
                paddingLeft: 58,
                fontSize: 21,
                lineHeight: 1.4,
                color: "var(--muted)",
              }}
            >
              <RichText text={item.text} ctx={ctx} />
            </span>
          )}
        </div>
      ))}
    </div>
  ),
  Button: ({ ctx, text }) => (
    <span
      data-qa="text"
      style={{
        display: "inline-block",
        padding: "28px 36px",
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: 28,
        textTransform: "uppercase",
        ...onSurface(ctx, "ink"),
      }}
    >
      [ {text} ]
    </span>
  ),
  compose: { cover: "top", question: "left", cta: "left" },
};
