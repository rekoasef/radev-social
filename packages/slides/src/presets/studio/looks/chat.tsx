import type { CSSProperties, ReactNode } from "react";
import { SlideIcon } from "../../../icons";
import { type Look, type LookContext, onSurface, pageLabel, RichText, twoDigits } from "../kit";

// `chat`: a messaging conversation. The brand as the contact on top, the title as an incoming
// message, answers as outgoing bubbles, lists as a thread and the CTA as the message box.

const incoming: CSSProperties = {
  background: "color-mix(in srgb, var(--paper) 65%, white)",
  color: "var(--ink)",
  borderRadius: "34px 34px 34px 8px",
  boxShadow: "0 2px 0 rgba(0,0,0,.06)",
};

function outgoing(ctx: LookContext): CSSProperties {
  return {
    ...onSurface(ctx, "accent"),
    borderRadius: "34px 34px 8px 34px",
    boxShadow: "0 2px 0 rgba(0,0,0,.08)",
  };
}

/** The wallpaper: the paper tinted, with a faint dot pattern. */
function Wallpaper() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        background: "color-mix(in srgb, var(--paper) 88%, var(--accent))",
        backgroundImage:
          "radial-gradient(color-mix(in srgb, var(--ink) 9%, transparent) 2px, transparent 2px)",
        backgroundSize: "36px 36px",
      }}
    />
  );
}

function ContactBar({ ctx }: { ctx: LookContext }) {
  const name = ctx.tokens.wordmark.text || ctx.brandName;
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 140,
        paddingTop: 50,
        paddingLeft: 80,
        display: "flex",
        alignItems: "center",
        gap: 20,
        ...onSurface(ctx, "ink"),
      }}
    >
      <span
        style={{
          width: 64,
          height: 64,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: 28,
          ...onSurface(ctx, "accent"),
        }}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 28 }}>
          {name}
        </span>
        <span style={{ fontFamily: "var(--font-body)", fontSize: 19, color: "var(--muted)" }}>
          {ctx.tokens.handle.site || "en línea"}
        </span>
      </div>
    </div>
  );
}

function Bubble({
  style,
  align,
  children,
}: {
  style: CSSProperties;
  align: "start" | "end";
  children: ReactNode;
}) {
  return (
    <div
      style={{
        alignSelf: align === "start" ? "flex-start" : "flex-end",
        maxWidth: 760,
        padding: "26px 32px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export const chat: Look = {
  id: "chat",
  title: { weight: 700, caps: false, tracking: -0.03, lineHeight: 1.06 },
  surface: () => "paper",
  titleInset: 72,
  Backdrop: () => <Wallpaper />,
  Header: (ctx) => <ContactBar ctx={ctx} />,
  Footer: (ctx) => (
    <div
      style={{
        position: "absolute",
        bottom: 62,
        left: 80,
        width: 850,
        textAlign: "center",
        fontFamily: "var(--font-body)",
        fontSize: 20,
        color: "var(--muted)",
      }}
    >
      {pageLabel(ctx)}
    </div>
  ),
  wrapTitle: (title) => (
    <div style={{ ...incoming, padding: "34px 36px", alignSelf: "flex-start" }}>{title}</div>
  ),
  emphasis: (_ctx, where) => (where === "title" ? { color: "var(--accent)" } : { fontWeight: 700 }),
  Panel: ({ ctx, children }) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Bubble style={outgoing(ctx)} align="end">
        {children}
      </Bubble>
    </div>
  ),
  List: ({ ctx, items, numbered }) => (
    <div style={{ display: "flex", flexDirection: "column", gap: items.length > 4 ? 12 : 18 }}>
      {items.map((item, i) => (
        <Bubble
          key={item.title}
          style={i % 2 === 0 ? incoming : outgoing(ctx)}
          align={i % 2 === 0 ? "start" : "end"}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
            <span
              style={{ flex: "none", fontFamily: "var(--font-mono)", fontSize: 22, opacity: 0.6 }}
            >
              {numbered
                ? twoDigits(i + 1)
                : item.icon && <SlideIcon name={item.icon} size={26} color="currentColor" />}
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: items.length > 4 ? 26 : 30,
                  lineHeight: 1.2,
                }}
              >
                {item.lead && <span style={{ opacity: 0.55, fontWeight: 400 }}>{item.lead} </span>}
                <RichText text={item.title} ctx={ctx} />
              </span>
              {item.text && (
                <span
                  data-qa="text"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 22,
                    lineHeight: 1.35,
                    opacity: 0.75,
                  }}
                >
                  <RichText text={item.text} ctx={ctx} />
                </span>
              )}
            </div>
          </div>
        </Bubble>
      ))}
    </div>
  ),
  Button: ({ ctx, text, icon }) => (
    <span style={{ display: "flex", alignItems: "center", gap: 16, width: 850 }}>
      <span
        data-qa="text"
        style={{
          flex: 1,
          padding: "30px 36px",
          borderRadius: 999,
          background: "color-mix(in srgb, var(--paper) 65%, white)",
          color: "var(--ink)",
          fontFamily: "var(--font-body)",
          fontSize: 30,
        }}
      >
        {text}
      </span>
      <span
        style={{
          width: 104,
          height: 104,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...onSurface(ctx, "accent"),
        }}
      >
        <SlideIcon name={icon ?? "send"} size={42} color="var(--fg)" strokeWidth={2.2} />
      </span>
    </span>
  ),
  compose: { cover: "bottom", coverTitle: "statement", question: "left", cta: "low" },
};
