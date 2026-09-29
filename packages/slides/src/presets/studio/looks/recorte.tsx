import type { CSSProperties, ReactNode } from "react";
import { SlideIcon } from "../../../icons";
import { type Look, type LookContext, onSurface, RichText, twoDigits } from "../kit";
import { rhythm, slideRandom, WordmarkFooter } from "./common";

// `recorte`: a collage. Textured paper, torn sheets, tape, a highlighter and sticky notes: warm
// and human, the counterpoint of the technical looks. Rotations are seeded per slide.

const TEXTURE = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.6' numOctaves='4'/><feColorMatrix values='0 0 0 0 .5  0 0 0 0 .45  0 0 0 0 .38  0 0 0 .35 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;

const TORN =
  "polygon(0 3%,4% 0,9% 2%,15% 0,22% 2.5%,30% .5%,38% 2%,46% 0,55% 2.5%,63% .5%,71% 2%,80% 0,88% 2.5%,95% .5%,100% 2%,100% 97%,95% 100%,88% 98%,80% 100%,71% 97.5%,63% 100%,55% 98%,46% 100%,38% 97.5%,30% 100%,22% 98%,15% 100%,9% 97.5%,4% 100%,0 98%)";

const sheet = "color-mix(in srgb, var(--paper) 55%, white)";
const shadow = "0 18px 30px rgba(0,0,0,.16), 0 2px 4px rgba(0,0,0,.08)";

function Tape({ style }: { style: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        width: 150,
        height: 44,
        background: "rgba(255, 236, 190, 0.72)",
        boxShadow: "0 2px 4px rgba(0,0,0,.08)",
        ...style,
      }}
    />
  );
}

/** A piece of the collage: paper, a dark card or a sticky note, slightly rotated. */
function Piece({
  ctx,
  kind,
  salt,
  tape = true,
  pad = "30px 34px",
  children,
}: {
  ctx: LookContext;
  kind: "sheet" | "dark" | "sticky";
  salt: string;
  tape?: boolean;
  pad?: string;
  children: ReactNode;
}) {
  const random = slideRandom(ctx, salt);
  const angle = (random.next() * 4 - 2).toFixed(2);
  const paint: CSSProperties =
    kind === "sheet"
      ? {
          background: sheet,
          color: "var(--ink)",
          ["--fg" as string]: "var(--ink)",
          ["--muted" as string]: "color-mix(in srgb, var(--ink) 62%, white)",
        }
      : onSurface(ctx, kind === "dark" ? "ink" : "accent");
  return (
    <div style={{ position: "relative", transform: `rotate(${angle}deg)` }}>
      <div style={{ padding: pad, boxShadow: shadow, ...paint }}>{children}</div>
      {tape && (
        <Tape
          style={{
            top: -20,
            left: `${30 + random.int(0, 40)}%`,
            transform: `rotate(${random.int(-8, 8)}deg)`,
          }}
        />
      )}
    </div>
  );
}

export const recorte: Look = {
  id: "recorte",
  title: { weight: 800, caps: false, tracking: -0.045, lineHeight: 0.98 },
  surface: rhythm("paper", ["paper", "paper", "paper", "ink"], "paper"),
  Backdrop: (ctx) => (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        opacity: ctx.surface === "ink" ? 0.12 : 0.35,
        mixBlendMode: ctx.surface === "ink" ? "screen" : "multiply",
        backgroundImage: TEXTURE,
      }}
    />
  ),
  Header: () => null,
  Footer: (ctx) => <WordmarkFooter ctx={ctx} />,
  emphasis: (ctx, where) =>
    where === "text"
      ? { fontWeight: 700, color: "var(--hl)" }
      : ctx.surface === "paper"
        ? {
            backgroundImage:
              "linear-gradient(transparent 55%, color-mix(in srgb, var(--accent) 85%, transparent) 55%, color-mix(in srgb, var(--accent) 85%, transparent) 92%, transparent 92%)",
            padding: "0 0.05em",
          }
        : { color: "var(--accent)" },
  Panel: ({ ctx, strong, children }) => (
    <Piece
      ctx={ctx}
      kind={strong ? (ctx.surface === "ink" ? "sticky" : "dark") : "sheet"}
      salt="panel"
    >
      {children}
    </Piece>
  ),
  List: ({ ctx, items, numbered }) => {
    const kinds = ["sheet", "sheet", "dark", "sticky"] as const;
    const small = items.length > 4;
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: small ? "1fr 1fr 1fr" : "1fr 1fr",
          gap: small ? 20 : 26,
        }}
      >
        {items.map((item, i) => (
          <Piece
            key={item.title}
            ctx={ctx}
            kind={kinds[i % kinds.length] ?? "sheet"}
            salt={`item${i}`}
            tape={i % 3 !== 2}
            pad={small ? "24px 22px" : "30px 30px"}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: small ? 150 : 200,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: small ? 48 : 72,
                  lineHeight: 1,
                  color: i % 4 === 3 ? "var(--fg)" : "var(--accent)",
                }}
              >
                {numbered
                  ? twoDigits(i + 1)
                  : item.icon && (
                      <SlideIcon
                        name={item.icon}
                        size={small ? 40 : 52}
                        color={i % 4 === 3 ? "var(--fg)" : "var(--accent)"}
                        strokeWidth={2.2}
                      />
                    )}
              </span>
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
                  fontWeight: 800,
                  fontSize: small ? 26 : 33,
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                  color: "var(--fg)",
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
                    lineHeight: 1.32,
                    color: "var(--muted)",
                  }}
                >
                  <RichText text={item.text} ctx={ctx} />
                </span>
              )}
            </div>
          </Piece>
        ))}
      </div>
    );
  },
  Button: ({ ctx, text, icon }) => (
    <Piece ctx={ctx} kind="dark" salt="button" pad="32px 44px">
      <span
        data-qa="text"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 16,
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 34,
        }}
      >
        {icon && <SlideIcon name={icon} size={32} color="var(--accent)" />}
        {text} <span style={{ color: "var(--accent)" }}>→</span>
      </span>
    </Piece>
  ),
  Decor: (ctx) =>
    ctx.type === "cover" ? (
      <div aria-hidden="true">
        <div
          style={{
            position: "absolute",
            left: 50,
            top: 150,
            width: 960,
            height: 700,
            background: sheet,
            boxShadow: shadow,
            clipPath: TORN,
            transform: "rotate(-1.5deg)",
          }}
        />
        <Tape style={{ left: 450, top: 132, transform: "rotate(3deg)" }} />
      </div>
    ) : null,
  compose: { cover: "top", question: "left", cta: "left" },
};
