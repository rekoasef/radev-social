import { SlideIcon } from "../../../icons";
import { type Look, RichText, twoDigits } from "../kit";
import { ART_LOOK_SURFACES } from "../surfaces";
import { brandLine, MetaHeader, WordmarkFooter } from "./common";

// `neon`: night signs. Strokes that glow over black, a retro perspective grid on the floor and
// outlined numbers. Catchy.

const glow = (color: string, px = 1) =>
  `0 0 ${6 * px}px ${color}, 0 0 ${18 * px}px ${color}, 0 0 ${42 * px}px color-mix(in srgb, ${color} 60%, transparent)`;

function Floor() {
  const line = "color-mix(in srgb, var(--glow) 55%, transparent)";
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 700,
          background:
            "radial-gradient(70% 60% at 50% 0%, color-mix(in srgb, var(--glow) 22%, transparent), transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: -540,
          right: -540,
          bottom: -200,
          height: 700,
          transform: "perspective(500px) rotateX(62deg)",
          transformOrigin: "50% 0%",
          backgroundImage: `linear-gradient(${line} 2px, transparent 2px), linear-gradient(90deg, ${line} 2px, transparent 2px)`,
          backgroundSize: "90px 90px",
          maskImage: "linear-gradient(transparent, #000 45%)",
          WebkitMaskImage: "linear-gradient(transparent, #000 45%)",
          opacity: 0.55,
        }}
      />
    </div>
  );
}

const tube = (strong?: boolean) => {
  const color = strong ? "var(--glow)" : "var(--accent)";
  return {
    border: `2px solid ${color}`,
    borderRadius: 26,
    boxShadow: `${glow(`color-mix(in srgb, ${color} 70%, transparent)`, 0.8)}, inset 0 0 22px color-mix(in srgb, ${color} 35%, transparent)`,
    background: "color-mix(in srgb, var(--bg) 70%, transparent)",
  };
};

export const neon: Look = {
  id: "neon",
  title: { weight: 700, caps: false, tracking: -0.03, lineHeight: 1.02 },
  surface: ART_LOOK_SURFACES.neon,
  Backdrop: () => <Floor />,
  Header: (ctx) => (
    <MetaHeader left={brandLine(ctx)} color="color-mix(in srgb, var(--glow) 80%, white)" />
  ),
  Footer: (ctx) => <WordmarkFooter ctx={ctx} />,
  emphasis: (_ctx, where) =>
    where === "title"
      ? { color: "color-mix(in srgb, var(--accent) 45%, white)", textShadow: glow("var(--accent)") }
      : {
          color: "color-mix(in srgb, var(--accent) 40%, white)",
          textShadow: glow("var(--accent)", 0.5),
        },
  Panel: ({ strong, children }) => (
    <div style={{ ...tube(strong), padding: "32px 38px" }}>{children}</div>
  ),
  List: ({ ctx, items, numbered }) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: items.length > 3 ? "1fr 1fr" : "1fr",
        gap: 20,
      }}
    >
      {items.map((item, i) => (
        <div
          key={item.title}
          style={{
            ...tube(i % 2 === 1),
            padding: "26px 28px",
            display: "flex",
            gap: 22,
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              flex: "none",
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 54,
              lineHeight: 1,
              color: "transparent",
              WebkitTextStroke: `2px ${i % 2 === 1 ? "var(--glow)" : "var(--accent)"}`,
              textShadow: glow(
                `color-mix(in srgb, ${i % 2 === 1 ? "var(--glow)" : "var(--accent)"} 60%, transparent)`,
                0.6,
              ),
            }}
          >
            {numbered
              ? twoDigits(i + 1)
              : item.icon && <SlideIcon name={item.icon} size={46} color="var(--accent)" />}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {item.lead && (
              <span
                data-qa="text"
                style={{ fontFamily: "var(--font-body)", fontSize: 21, color: "var(--muted)" }}
              >
                {item.lead}
              </span>
            )}
            <span
              data-qa="text"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: items.length > 3 ? 28 : 34,
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
                  fontSize: 22,
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
  ),
  Button: ({ text, icon }) => (
    <span
      data-qa="text"
      style={{
        ...tube(),
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        gap: 16,
        padding: "30px 46px",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 32,
        color: "color-mix(in srgb, var(--accent) 35%, white)",
        textShadow: glow("var(--accent)", 0.5),
      }}
    >
      {icon && <SlideIcon name={icon} size={30} color="var(--accent)" />}
      {text} →
    </span>
  ),
  Decor: (ctx) =>
    ctx.type === "cover" ? (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 540 - 190,
          top: 170,
          width: 380,
          height: 380,
          borderRadius: 999,
          border: "5px solid var(--accent)",
          boxShadow: `${glow("var(--accent)", 1.2)}, inset ${glow("color-mix(in srgb, var(--accent) 60%, transparent)", 0.8)}`,
        }}
      />
    ) : null,
  compose: { cover: "bottom", coverTitle: "statement", question: "center", cta: "center" },
};
