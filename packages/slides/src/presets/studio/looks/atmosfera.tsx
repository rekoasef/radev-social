import { createRandom } from "../../../frame/random";
import { SlideIcon } from "../../../icons";
import { type Look, type LookContext, RichText, twoDigits } from "../kit";
import { brandLine, MetaHeader, WordmarkFooter } from "./common";

// `atmosfera`: cinematic. Soft lights, grain and glass over ink. The lights are one panorama cut
// into the slides, so they keep moving as you swipe; every post gets its own.

const PANORAMA_BLOBS = 10;

/** Film grain: SVG noise blended over the lights. */
const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

function Lights({ ctx }: { ctx: LookContext }) {
  const random = createRandom(`${ctx.seed}:lights`);
  const width = ctx.page.total * 1080;
  const blobs = Array.from({ length: PANORAMA_BLOBS }, (_, i) => {
    const warm = i % 3 !== 2;
    return {
      x: (i / PANORAMA_BLOBS) * width + random.int(-200, 200),
      y: random.int(150, 1200),
      r: random.int(380, 680),
      color: warm
        ? `color-mix(in srgb, var(--accent) ${random.int(35, 60)}%, transparent)`
        : `color-mix(in srgb, var(--glow) ${random.int(18, 30)}%, transparent)`,
    };
  });
  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <div
        style={{ position: "absolute", top: 0, left: -ctx.page.index * 1080, width, height: 1350 }}
      >
        {blobs.map((b) => (
          <div
            key={`${b.x}-${b.y}`}
            style={{
              position: "absolute",
              left: b.x - b.r / 2,
              top: b.y - b.r / 2,
              width: b.r,
              height: b.r,
              borderRadius: 999,
              background: b.color,
              filter: "blur(110px)",
            }}
          />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(120% 90% at 50% 40%, transparent 50%, rgba(0,0,0,.55))",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.2,
          mixBlendMode: "overlay",
          backgroundImage: GRAIN,
        }}
      />
    </div>
  );
}

const glass = {
  background: "linear-gradient(180deg, rgba(255,255,255,.09), rgba(255,255,255,.035))",
  border: "1px solid rgba(255,255,255,.12)",
  borderTopColor: "rgba(255,255,255,.22)",
  backdropFilter: "blur(30px)",
  borderRadius: 28,
} as const;

const strongGlass = {
  ...glass,
  border: "1px solid color-mix(in srgb, var(--accent) 55%, transparent)",
  boxShadow: "0 0 70px color-mix(in srgb, var(--accent) 28%, transparent)",
} as const;

/** The protagonist: a ring of light (the AI image will take this place when there is one). */
function Ring({ size, top }: { size: number; top: number }) {
  const conic =
    "conic-gradient(from 200deg, var(--accent), color-mix(in srgb, var(--accent) 35%, white), color-mix(in srgb, var(--accent) 70%, var(--glow)), color-mix(in srgb, var(--accent) 25%, black), var(--accent))";
  return (
    <div
      aria-hidden="true"
      style={{ position: "absolute", left: 540 - size / 2, top, width: size, height: size }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: conic,
          filter: "blur(2px)",
          WebkitMaskImage:
            "radial-gradient(circle, transparent 58%, #000 59%, #000 70%, transparent 71%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 999,
          background: conic,
          filter: "blur(40px)",
          opacity: 0.7,
          WebkitMaskImage:
            "radial-gradient(circle, transparent 50%, #000 60%, #000 72%, transparent 85%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: size * 0.29,
          borderRadius: 999,
          background: "radial-gradient(circle at 40% 35%, #2a2a30, #0a0a0d 70%)",
          boxShadow:
            "inset 0 2px 1px rgba(255,255,255,.2), 0 0 80px color-mix(in srgb, var(--accent) 40%, transparent)",
        }}
      />
    </div>
  );
}

function Sphere({ size, top }: { size: number; top: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 540 - size / 2,
        top,
        width: size,
        height: size,
        borderRadius: 999,
        background:
          "radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--accent) 30%, white), var(--accent) 45%, color-mix(in srgb, var(--accent) 35%, black) 90%)",
        boxShadow: "0 0 120px color-mix(in srgb, var(--accent) 60%, transparent)",
      }}
    />
  );
}

export const atmosfera: Look = {
  id: "atmosfera",
  title: { weight: 600, caps: false, tracking: -0.04, lineHeight: 1.0 },
  surface: () => "ink",
  Backdrop: (ctx) => <Lights ctx={ctx} />,
  Header: (ctx) => <MetaHeader left={brandLine(ctx)} />,
  Footer: (ctx) => <WordmarkFooter ctx={ctx} separator=" / " />,
  emphasis: (_ctx, where) =>
    where === "title"
      ? {
          backgroundImage:
            "linear-gradient(90deg, color-mix(in srgb, var(--accent) 55%, white), var(--accent) 60%, color-mix(in srgb, var(--accent) 70%, var(--glow)))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }
      : { color: "var(--fg)", fontWeight: 600 },
  Panel: ({ strong, children }) => (
    <div style={{ ...(strong ? strongGlass : glass), padding: "34px 40px" }}>{children}</div>
  ),
  List: ({ ctx, items, numbered }) =>
    numbered || items.length <= 3 ? (
      <div style={{ ...glass, padding: "8px 40px" }}>
        {items.map((item, i) => (
          <div
            key={item.title}
            style={{
              display: "flex",
              gap: 26,
              padding: "26px 0",
              borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,.08)" : undefined,
            }}
          >
            <span
              style={{
                width: 56,
                flex: "none",
                fontFamily: "var(--font-mono)",
                fontSize: 28,
                color: "var(--accent)",
                lineHeight: 1.3,
              }}
            >
              {numbered
                ? twoDigits(i + 1)
                : item.icon && <SlideIcon name={item.icon} size={32} color="var(--accent)" />}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: 35,
                  lineHeight: 1.15,
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
    ) : (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {items.map((item) => (
          <div
            key={item.title}
            style={{
              ...glass,
              padding: "28px 30px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {item.icon && <SlideIcon name={item.icon} size={38} color="var(--accent)" />}
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
                fontWeight: 600,
                fontSize: 30,
                lineHeight: 1.15,
              }}
            >
              <RichText text={item.title} ctx={ctx} />
            </span>
          </div>
        ))}
      </div>
    ),
  Button: ({ text, icon }) => (
    <span
      data-qa="text"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 16,
        background: "var(--paper)",
        color: "var(--ink)",
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        fontSize: 32,
        padding: "30px 46px",
        borderRadius: 999,
        boxShadow: "0 0 60px color-mix(in srgb, var(--accent) 35%, transparent)",
      }}
    >
      {icon && <SlideIcon name={icon} size={30} color="var(--ink)" />}
      {text} →
    </span>
  ),
  Decor: (ctx) =>
    ctx.type === "cover" ? (
      <Ring size={400} top={150} />
    ) : ctx.type === "cta" ? (
      <Sphere size={240} top={200} />
    ) : null,
  compose: { cover: "bottom", coverTitle: "statement", question: "center", cta: "low" },
};
