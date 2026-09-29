import { SlideIcon } from "../../../icons";
import { type Look, type LookContext, RichText } from "../kit";
import { brandLine } from "./common";

// `documento`: a working document. A white page on a desk, a breadcrumb, headings, check boxes,
// callouts with a colored edge and highlighted words. Plans, processes and productivity.

const page = "color-mix(in srgb, var(--paper) 45%, white)";
const tint = (pct: number) => `color-mix(in srgb, var(--accent) ${pct}%, ${page})`;

function Desk() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        background: "color-mix(in srgb, var(--paper) 80%, var(--ink))",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 40,
          width: 930,
          top: 40,
          bottom: 0,
          background: page,
          borderRadius: "18px 18px 0 0",
          boxShadow: "0 10px 40px rgba(0,0,0,.12)",
        }}
      />
    </div>
  );
}

function Breadcrumb({ ctx }: { ctx: LookContext }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 84,
        left: 80,
        width: 850,
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "var(--font-body)",
        fontSize: 21,
        color: "var(--muted)",
      }}
    >
      <SlideIcon name="file-text" size={24} color="var(--muted)" />
      <span>{brandLine(ctx)}</span>
      <span>/</span>
      <span style={{ color: "var(--fg)" }}>
        Página {ctx.page.index + 1} de {ctx.page.total}
      </span>
    </div>
  );
}

export const documento: Look = {
  id: "documento",
  title: { weight: 700, caps: false, tracking: -0.035, lineHeight: 1.05 },
  surface: () => "paper",
  Backdrop: () => <Desk />,
  Header: (ctx) => <Breadcrumb ctx={ctx} />,
  Footer: (ctx) => (
    <div
      style={{
        position: "absolute",
        bottom: 64,
        left: 80,
        fontFamily: "var(--font-body)",
        fontSize: 20,
        color: "var(--muted)",
      }}
    >
      {ctx.page.index === 0
        ? "Deslizá →"
        : `Editado por ${ctx.tokens.wordmark.text || ctx.brandName}`}
    </div>
  ),
  emphasis: (_ctx, where) => ({
    background: tint(30),
    borderRadius: 6,
    padding: "0 0.1em",
    ...(where === "text" ? { fontWeight: 600, color: "var(--fg)" } : {}),
  }),
  Panel: ({ strong, children }) => (
    <div
      style={{
        display: "flex",
        gap: 20,
        padding: "28px 32px",
        borderRadius: 14,
        background: tint(strong ? 16 : 8),
        borderLeft: `6px solid ${strong ? "var(--accent)" : "var(--line)"}`,
      }}
    >
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  ),
  List: ({ ctx, items, numbered }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: items.length > 4 ? 18 : 26 }}>
      {items.map((item) => (
        <div key={item.title} style={{ display: "flex", gap: 22, alignItems: "flex-start" }}>
          <span
            style={{
              flex: "none",
              width: 40,
              height: 40,
              marginTop: 2,
              borderRadius: numbered ? 8 : 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: numbered ? "var(--accent)" : tint(18),
              color: "var(--ink)",
              fontWeight: 800,
              fontSize: 26,
            }}
          >
            {numbered
              ? "✓"
              : item.icon && <SlideIcon name={item.icon} size={24} color="var(--ink)" />}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              data-qa="text"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: items.length > 4 ? 29 : 34,
                lineHeight: 1.18,
              }}
            >
              {item.lead ? `${item.lead} ` : ""}
              <RichText text={item.title} ctx={ctx} />
            </span>
            {item.text && (
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 24,
                  lineHeight: 1.4,
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
        gap: 14,
        padding: "26px 36px",
        borderRadius: 14,
        background: "var(--accent)",
        color: "var(--ink)",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 30,
      }}
    >
      <SlideIcon name={icon ?? "arrow-up-right"} size={30} color="var(--ink)" />
      {text}
    </span>
  ),
  compose: { cover: "top", question: "left", cta: "left" },
};
