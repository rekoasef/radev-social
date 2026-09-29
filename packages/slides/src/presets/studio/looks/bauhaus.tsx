import type { CSSProperties } from "react";
import { SlideIcon } from "../../../icons";
import { type Look, type LookContext, onSurface, RichText, twoDigits } from "../kit";
import { rhythm, slideRandom, WordmarkFooter } from "./common";

// `bauhaus`: geometry. Circles, half circles, squares and triangles in flat color frame every
// slide (a seeded strip along the top, big shapes on the cover and the close).

type Shape = "circle" | "half" | "square" | "triangle" | "quarter";
const SHAPES: Shape[] = ["circle", "half", "square", "triangle", "quarter"];

function shapeStyle(shape: Shape, size: number, color: string): CSSProperties {
  const base: CSSProperties = { width: size, height: size, background: color, flex: "none" };
  switch (shape) {
    case "circle":
      return { ...base, borderRadius: 999 };
    case "half":
      return { ...base, height: size / 2, borderRadius: `${size}px ${size}px 0 0` };
    case "square":
      return base;
    case "triangle":
      return { ...base, clipPath: "polygon(50% 0, 100% 100%, 0 100%)" };
    case "quarter":
      return { ...base, borderRadius: `0 ${size}px 0 0` };
  }
}

/** Colors a shape can take on this surface (never the surface's own). */
function palette(ctx: LookContext): string[] {
  const all = ["var(--accent)", "var(--ink)", "var(--paper)", "var(--glow)"];
  const own =
    ctx.surface === "accent"
      ? "var(--accent)"
      : ctx.surface === "ink"
        ? "var(--ink)"
        : "var(--paper)";
  return all.filter((c) => c !== own);
}

function Strip({ ctx }: { ctx: LookContext }) {
  const random = slideRandom(ctx, "strip");
  const colors = palette(ctx);
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 70,
        right: 80,
        display: "flex",
        alignItems: "flex-end",
        gap: 14,
      }}
    >
      {Array.from({ length: 4 }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of four seeded shapes
          key={i}
          style={shapeStyle(
            random.pick(SHAPES),
            46,
            colors[(i + random.int(0, 2)) % colors.length] ?? "var(--accent)",
          )}
        />
      ))}
    </div>
  );
}

/** Big shapes over the top of the slide; smaller on the close, where the title sits higher. */
function Composition({ ctx }: { ctx: LookContext }) {
  const scale = ctx.type === "cta" ? 0.62 : 1;
  const random = slideRandom(ctx, "big");
  const colors = palette(ctx);
  const pick = (i: number) => colors[i % colors.length] ?? "var(--accent)";
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 1080,
        height: 560,
        overflow: "hidden",
        transform: `scale(${scale})`,
        transformOrigin: "50% 0",
      }}
    >
      <span
        style={{ position: "absolute", left: 560, top: 60, ...shapeStyle("circle", 420, pick(0)) }}
      />
      <span
        style={{
          position: "absolute",
          left: 80,
          top: 140,
          ...shapeStyle(random.pick(["half", "quarter"] as Shape[]), 360, pick(1)),
        }}
      />
      <span
        style={{
          position: "absolute",
          left: 420,
          top: 300,
          ...shapeStyle("triangle", 220, pick(2)),
        }}
      />
      <span
        style={{ position: "absolute", left: 860, top: 390, ...shapeStyle("square", 120, pick(1)) }}
      />
    </div>
  );
}

export const bauhaus: Look = {
  id: "bauhaus",
  title: { weight: 800, caps: false, tracking: -0.045, lineHeight: 0.96 },
  surface: rhythm("paper", ["paper", "ink", "paper", "accent"], "ink"),
  Header: (ctx) => (ctx.type === "cover" || ctx.type === "cta" ? null : <Strip ctx={ctx} />),
  Footer: (ctx) => <WordmarkFooter ctx={ctx} />,
  Decor: (ctx) => (ctx.type === "cover" || ctx.type === "cta" ? <Composition ctx={ctx} /> : null),
  emphasis: (_ctx, where) =>
    where === "title" ? { color: "var(--hl)" } : { fontWeight: 700, color: "var(--fg)" },
  Panel: ({ ctx, strong, children }) => (
    <div
      style={{
        position: "relative",
        padding: "34px 40px 34px 110px",
        ...(strong
          ? onSurface(ctx, ctx.surface === "accent" ? "ink" : "accent")
          : { background: "var(--panel)" }),
      }}
    >
      <span
        style={{
          position: "absolute",
          left: 34,
          top: 36,
          ...shapeStyle("circle", 44, strong ? "var(--fg)" : "var(--hl)"),
        }}
      />
      {children}
    </div>
  ),
  List: ({ ctx, items, numbered }) => {
    const colors = palette(ctx);
    const grid = items.length > 3;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: grid ? "1fr 1fr" : "1fr",
          gap: grid ? 30 : 30,
        }}
      >
        {items.map((item, i) => {
          const shape = SHAPES[i % SHAPES.length] ?? "circle";
          const color = colors[i % colors.length] ?? "var(--accent)";
          return (
            <div key={item.title} style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
              <span
                style={{
                  position: "relative",
                  flex: "none",
                  width: 84,
                  height: 84,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    ...shapeStyle(shape, 84, color),
                    ...(shape === "half" ? { top: 42 } : {}),
                  }}
                />
                <span
                  style={{
                    position: "relative",
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: 30,
                    color: color === "var(--ink)" ? "var(--paper)" : "var(--ink)",
                    marginTop: shape === "triangle" ? 22 : shape === "half" ? 42 : 0,
                  }}
                >
                  {numbered
                    ? twoDigits(i + 1)
                    : item.icon && (
                        <SlideIcon
                          name={item.icon}
                          size={30}
                          color={color === "var(--ink)" ? "var(--paper)" : "var(--ink)"}
                          strokeWidth={2.2}
                        />
                      )}
                </span>
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 6 }}>
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
          );
        })}
      </div>
    );
  },
  Button: ({ ctx, text, icon }) => (
    <span style={{ display: "inline-flex", alignItems: "stretch" }}>
      <span
        data-qa="text"
        style={{
          display: "flex",
          alignItems: "center",
          padding: "30px 40px",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 32,
          ...onSurface(ctx, ctx.surface === "accent" ? "ink" : "accent"),
        }}
      >
        {text}
      </span>
      <span
        style={{
          width: 100,
          borderRadius: "0 999px 999px 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...onSurface(ctx, ctx.surface === "paper" ? "ink" : "paper"),
        }}
      >
        {icon ? (
          <SlideIcon name={icon} size={36} color="var(--fg)" strokeWidth={2.4} />
        ) : (
          <span style={{ fontSize: 40, fontWeight: 800 }}>→</span>
        )}
      </span>
    </span>
  ),
  compose: { cover: "bottom", coverTitle: "statement", question: "left", cta: "low" },
};
