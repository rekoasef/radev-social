import type { ReactNode } from "react";
import { SLIDE_LABELS } from "../../../content/form";
import { SlideIcon } from "../../../icons";
import { type Look, type LookContext, RichText, twoDigits } from "../kit";
import { MetaHeader, WordmarkFooter } from "./common";

// `terminal`: a code editor and a shell. Windows with traffic lights, a prompt on top and the
// CTA as a command. The native language of a software brand.

const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const windowStyle = {
  background: "color-mix(in srgb, var(--fg) 5%, var(--bg))",
  border: "1px solid color-mix(in srgb, var(--fg) 13%, transparent)",
  borderRadius: 22,
  overflow: "hidden",
  boxShadow: "0 40px 80px rgba(0,0,0,.45)",
} as const;

function Window({
  title,
  children,
  strong,
}: {
  title?: string;
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={windowStyle}>
      <div
        style={{
          height: 54,
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "0 22px",
          background: "color-mix(in srgb, var(--fg) 8%, var(--bg))",
          borderBottom: "1px solid color-mix(in srgb, var(--fg) 12%, transparent)",
          fontFamily: "var(--font-mono)",
          fontSize: 18,
          color: "var(--muted)",
        }}
      >
        <span
          style={{
            width: 15,
            height: 15,
            borderRadius: 999,
            background: strong ? "var(--hl)" : "color-mix(in srgb, var(--fg) 25%, transparent)",
          }}
        />
        <span
          style={{
            width: 15,
            height: 15,
            borderRadius: 999,
            background: "color-mix(in srgb, var(--fg) 18%, transparent)",
          }}
        />
        <span
          style={{
            width: 15,
            height: 15,
            borderRadius: 999,
            background: "color-mix(in srgb, var(--fg) 18%, transparent)",
          }}
        />
        {title && <span style={{ marginLeft: 12 }}>{title}</span>}
      </div>
      <div style={{ padding: "32px 38px" }}>{children}</div>
    </div>
  );
}

const prompt = (ctx: LookContext) =>
  `~/${slug(ctx.tokens.wordmark.text || ctx.brandName)} ❯ cat ${twoDigits(ctx.page.index + 1)}.md`;

export const terminal: Look = {
  id: "terminal",
  title: { weight: 700, caps: false, tracking: -0.04, lineHeight: 1.0 },
  surface: () => "ink",
  Header: (ctx) => (
    <MetaHeader left={<span style={{ textTransform: "none" }}>{prompt(ctx)}</span>} />
  ),
  Footer: (ctx) => <WordmarkFooter ctx={ctx} separator="/" />,
  emphasis: () => ({ color: "var(--hl)" }),
  Panel: ({ strong, children }) => <Window strong={strong}>{children}</Window>,
  List: ({ ctx, items, numbered }) => (
    <Window strong title={`${slug(SLIDE_LABELS[ctx.type])}.log`}>
      <div style={{ display: "flex", flexDirection: "column", gap: items.length > 4 ? 16 : 24 }}>
        {items.map((item, i) => (
          <div
            key={item.title}
            style={{ display: "flex", gap: 18, fontFamily: "var(--font-mono)" }}
          >
            <span style={{ flex: "none", fontSize: 26, lineHeight: 1.4, color: "var(--hl)" }}>
              {numbered ? (
                `${twoDigits(i + 1)}`
              ) : item.icon ? (
                <SlideIcon name={item.icon} size={28} color="var(--hl)" />
              ) : (
                "›"
              )}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                data-qa="text"
                style={{
                  fontSize: items.length > 4 ? 25 : 28,
                  lineHeight: 1.35,
                  fontWeight: 600,
                  color: "var(--fg)",
                }}
              >
                {item.lead && <span style={{ opacity: 0.55, fontWeight: 400 }}>{item.lead} </span>}
                <RichText text={item.title} ctx={ctx} />
              </span>
              {item.text && (
                <span
                  data-qa="text"
                  style={{ fontSize: 22, lineHeight: 1.4, color: "var(--muted)" }}
                >
                  {"// "}
                  <RichText text={item.text} ctx={ctx} />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Window>
  ),
  Button: ({ text, icon }) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 18,
        padding: "34px 42px",
        borderRadius: 22,
        background: "var(--hl)",
        color: "var(--bg)",
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        fontSize: 30,
      }}
    >
      {icon ? <SlideIcon name={icon} size={30} color="var(--bg)" /> : "❯"}
      <span data-qa="text">{text}</span>
      <span style={{ display: "inline-block", width: 16, height: 32, background: "var(--bg)" }} />
    </span>
  ),
  compose: { cover: "top", question: "left", cta: "left" },
};
