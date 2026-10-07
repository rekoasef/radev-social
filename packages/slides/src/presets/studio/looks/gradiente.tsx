import { createRandom } from "../../../frame/random";
import { SlideIcon } from "../../../icons";
import { type Look, type LookContext, RichText, twoDigits } from "../kit";
import { ART_LOOK_SURFACES } from "../surfaces";
import { brandLine, MetaHeader, WordmarkFooter } from "./common";

// `gradiente`: light and friendly. Soft color clouds over paper (one panorama across the
// carousel, like `atmosfera` but in daylight), white rounded cards and gradient pills.

const card = {
  background: "color-mix(in srgb, white 72%, transparent)",
  border: "1px solid color-mix(in srgb, white 90%, transparent)",
  borderRadius: 34,
  boxShadow: "0 20px 50px color-mix(in srgb, var(--ink) 10%, transparent)",
  backdropFilter: "blur(24px)",
} as const;

const gradient =
  "linear-gradient(120deg, var(--accent), color-mix(in srgb, var(--accent) 45%, var(--glow)) 55%, var(--glow))";

function Clouds({ ctx }: { ctx: LookContext }) {
  const random = createRandom(`${ctx.seed}:clouds`);
  const width = ctx.page.total * 1080;
  const blobs = Array.from({ length: 9 }, (_, i) => ({
    x: (i / 9) * width + random.int(-150, 150),
    y: random.int(0, 1350),
    r: random.int(500, 800),
    color:
      i % 2 === 0
        ? "color-mix(in srgb, var(--accent) 38%, transparent)"
        : "color-mix(in srgb, var(--glow) 30%, transparent)",
  }));
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
              filter: "blur(120px)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export const gradiente: Look = {
  id: "gradiente",
  title: { weight: 700, caps: false, tracking: -0.035, lineHeight: 1.03 },
  surface: ART_LOOK_SURFACES.gradiente,
  Backdrop: (ctx) => <Clouds ctx={ctx} />,
  Header: (ctx) => <MetaHeader left={brandLine(ctx)} color="var(--fg)" />,
  Footer: (ctx) => <WordmarkFooter ctx={ctx} color="var(--fg)" />,
  emphasis: (_ctx, where) =>
    where === "title"
      ? {
          backgroundImage: gradient,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }
      : { fontWeight: 700, color: "var(--fg)" },
  Panel: ({ strong, children }) => (
    <div
      style={
        strong
          ? {
              ...card,
              padding: "34px 40px",
              border: "2px solid color-mix(in srgb, var(--accent) 60%, white)",
            }
          : { ...card, padding: "34px 40px" }
      }
    >
      {children}
    </div>
  ),
  List: ({ ctx, items, numbered }) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: items.length > 3 ? "1fr 1fr" : "1fr",
        gap: 18,
      }}
    >
      {items.map((item, i) => (
        <div
          key={item.title}
          style={{
            ...card,
            padding: "26px 28px",
            display: "flex",
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              flex: "none",
              width: 58,
              height: 58,
              borderRadius: 999,
              background: gradient,
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: 24,
            }}
          >
            {numbered
              ? twoDigits(i + 1)
              : item.icon && <SlideIcon name={item.icon} size={28} color="white" />}
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
                lineHeight: 1.15,
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
  ),
  Button: ({ text, icon }) => (
    <span
      data-qa="text"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 16,
        padding: "30px 48px",
        borderRadius: 999,
        background: gradient,
        color: "white",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 32,
        boxShadow: "0 18px 40px color-mix(in srgb, var(--accent) 35%, transparent)",
      }}
    >
      {icon && <SlideIcon name={icon} size={30} color="white" />}
      {text} →
    </span>
  ),
  compose: { cover: "center", question: "center", cta: "center" },
};
