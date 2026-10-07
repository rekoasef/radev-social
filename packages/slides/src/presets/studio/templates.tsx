import type { CSSProperties, ReactNode } from "react";
import type { Datasets } from "../../content/datasets";
import { screenComposition } from "../../content/screens";
import type { Slide, SlideOf, SlideType } from "../../content/slides";
import { decimalsFor, formatNumber, withUnit } from "../../format";
import { Layer } from "../../frame/layer";
import { SlideIcon } from "../../icons";
import { chartLayout } from "../shared/chart-layout";
import { Laptop, Phone, phoneSize } from "./devices";
import { Label, type LookContext, plainOf, Rich, STUDIO_CONTENT_BOX, Text, Title } from "./kit";

// Templates of the `studio` preset (docs/DESIGN-SYSTEM.md §10): the structure of each slide type,
// drawn with the pieces of the post's look (ctx.kit). They fill the content box the frame gives
// them (850 wide, left of TikTok's buttons) as a column, with the title and the rest as the two
// movable layers (ADR 0013).

type TemplateArgs<T extends SlideType> = {
  slide: SlideOf<T>;
  ctx: LookContext;
  datasets: Datasets;
};

const W = STUDIO_CONTENT_BOX.width;

function Column({
  justify = "space-between",
  align,
  gap = 48,
  children,
}: {
  justify?: CSSProperties["justifyContent"];
  align?: CSSProperties["alignItems"];
  gap?: number;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        alignItems: align,
        gap,
        height: "100%",
        // The box's width: wider when fitSlide zooms it out, so the text reflows.
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}

/** A movable layer that is also a QA content box. */
function Block({
  name,
  slide,
  gap = 28,
  align,
  children,
}: {
  name: "title" | "body";
  slide: Slide;
  gap?: number;
  align?: CSSProperties["alignItems"];
  children: ReactNode;
}) {
  return (
    <Layer name={name} layout={slide.layout}>
      <div
        data-qa="content"
        style={{ display: "flex", flexDirection: "column", gap, alignItems: align }}
      >
        {children}
      </div>
    </Layer>
  );
}

function Kicker({ text, ctx }: { text: string; ctx: LookContext }) {
  return (
    <Label color="var(--hl)" size={22}>
      <Rich text={text} emphasis={{}} />
      {ctx.kit.id === "editorial" ? " —" : ""}
    </Label>
  );
}

/** The post's image in the template's flow (the `giant` cover): blended like the frame's. */
function InlineArt({ slide, ctx }: { slide: Slide; ctx: LookContext }) {
  if (!ctx.art) return null;
  const light = ctx.art.background === "light";
  const brand = ctx.art.brand === true;
  return (
    <div style={{ flex: 1, minHeight: 400, display: "flex", justifyContent: "center" }}>
      <Layer name="hero" layout={slide.layout} style={{ height: "100%", display: "flex" }}>
        <img
          src={ctx.art.url}
          alt=""
          style={{
            height: "100%",
            maxHeight: 560,
            aspectRatio: "1",
            objectFit: "contain",
            mixBlendMode: brand ? undefined : light ? "multiply" : "screen",
            filter:
              [
                ctx.art.monochrome ? "grayscale(1) contrast(1.1)" : "",
                light && !brand ? "brightness(1.1) contrast(1.08)" : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined,
            WebkitMaskImage: brand
              ? undefined
              : "radial-gradient(circle, #000 46%, transparent 66%)",
            maskImage: brand ? undefined : "radial-gradient(circle, #000 46%, transparent 66%)",
          }}
        />
      </Layer>
    </div>
  );
}

function Cover({ slide, ctx }: TemplateArgs<"cover">) {
  // ADR 0026: with the image across the slide (`bleed`) or under the title (`giant`) the title
  // runs big; beside it (`split`) it takes the left column. Without an image those fall back to
  // the original: the object on top and the title at the bottom, or the look's own arrangement.
  const composition = ctx.art ? (slide.composition ?? "hero") : "hero";
  const mode =
    composition === "giant"
      ? "top"
      : composition === "split"
        ? "middle"
        : ctx.art
          ? "bottom"
          : ctx.kit.compose.cover;
  const center = mode === "center";
  const width = composition === "split" ? 520 : W;
  const size =
    composition === "split" || composition === "giant"
      ? "statement"
      : ctx.art
        ? "title"
        : (ctx.kit.compose.coverTitle ?? "hero");
  const title = (
    <Block name="title" slide={slide} gap={32} align={center ? "center" : undefined}>
      {slide.kicker && <Kicker text={slide.kicker} ctx={ctx} />}
      <Title
        text={slide.title}
        ctx={ctx}
        size={size}
        width={width}
        align={center ? "center" : undefined}
      />
    </Block>
  );
  const subtitle = slide.subtitle && (
    <Block name="body" slide={slide} align={center ? "center" : undefined}>
      <div style={{ maxWidth: Math.min(680, width) }}>
        <Text
          text={slide.subtitle}
          ctx={ctx}
          size={34}
          color="var(--fg)"
          style={{ textAlign: center ? "center" : undefined, opacity: 0.86 }}
        />
      </div>
    </Block>
  );
  if (composition === "giant" && ctx.art) {
    // The title first, as big as it gets; the object takes what is left below it.
    return (
      <Column justify="flex-start" gap={36}>
        {title}
        {subtitle}
        <InlineArt slide={slide} ctx={ctx} />
      </Column>
    );
  }
  if (mode === "bottom" || mode === "top" || mode === "middle") {
    return (
      <Column
        justify={mode === "bottom" ? "flex-end" : mode === "top" ? "flex-start" : "center"}
        gap={44}
      >
        {title}
        {subtitle}
      </Column>
    );
  }
  if (center) {
    return (
      <Column justify="center" align="center" gap={44}>
        {title}
        {subtitle}
      </Column>
    );
  }
  return (
    <Column>
      {title}
      {subtitle}
    </Column>
  );
}

function FromTo({ slide, ctx }: { slide: SlideOf<"statement">; ctx: LookContext }) {
  const visual = slide.visual;
  if (!visual) return null;
  const Side = ({ icon, label, strong }: { icon: string; label: string; strong?: boolean }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <SlideIcon name={icon} size={40} color={strong ? "var(--hl)" : "var(--fg)"} />
      <span
        data-qa="text"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 36,
          letterSpacing: "-0.02em",
        }}
      >
        {label}
      </span>
    </div>
  );
  return (
    <ctx.kit.Panel ctx={ctx}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}
      >
        <Side icon={visual.from.icon} label={visual.from.label} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 36, color: "var(--hl)" }}>→</span>
        <Side icon={visual.to.icon} label={visual.to.label} strong />
      </div>
    </ctx.kit.Panel>
  );
}

/**
 * A drawing made in code (ADR 0026): the slide's icon in a disc of the look's highlight, inside
 * thin orbits with a few dots. Movable like the slide's graphic element.
 */
function Drawing({
  slide,
  ctx,
  icon,
  size,
}: {
  slide: Slide;
  ctx: LookContext;
  icon: string;
  size: number;
}) {
  const c = size / 2;
  const orbits = [0.48, 0.36, 0.25].map((r) => r * size);
  // Dots on the orbits at angles from the seed: the same post, the same drawing.
  const seed = [...ctx.seed].reduce((n, ch) => (n * 31 + ch.charCodeAt(0)) % 997, 7);
  const dots = orbits.map((r, i) => {
    const angle = ((seed * (i + 3) * 47) % 360) * (Math.PI / 180);
    return { x: c + r * Math.cos(angle), y: c + r * Math.sin(angle), r: 10 - i * 2 };
  });
  return (
    <Layer name="hero" layout={slide.layout}>
      <div data-qa="content" style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0 }} aria-hidden>
          {orbits.map((r) => (
            <circle key={r} cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={2} />
          ))}
          <circle cx={c} cy={c} r={size * 0.16} fill="var(--hl)" />
          {dots.map((d) => (
            <circle key={d.x} cx={d.x} cy={d.y} r={d.r} fill="var(--hl)" />
          ))}
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SlideIcon name={icon} size={Math.round(size * 0.15)} color="var(--bg)" />
        </div>
      </div>
    </Layer>
  );
}

function StatementBody({ slide, ctx }: { slide: SlideOf<"statement">; ctx: LookContext }) {
  if (!slide.visual && !slide.body) return null;
  return (
    <Block name="body" slide={slide} gap={40}>
      <FromTo slide={slide} ctx={ctx} />
      {slide.body && (
        <div style={{ maxWidth: 720 }}>
          <Text text={slide.body} ctx={ctx} size={31} />
        </div>
      )}
    </Block>
  );
}

function Statement({ slide, ctx }: TemplateArgs<"statement">) {
  // ADR 0026: the photo needs the post's middle image; without it, the drawing takes its place.
  const composition =
    slide.composition === "photo" && !ctx.art ? "drawing" : (slide.composition ?? "center");
  if (composition === "photo") {
    // The image is drawn by the frame above: the text goes to the bottom.
    return (
      <Column justify="flex-end" gap={48}>
        <Block name="title" slide={slide}>
          <Title text={slide.title} ctx={ctx} size="title" />
        </Block>
        <StatementBody slide={slide} ctx={ctx} />
      </Column>
    );
  }
  if (composition === "drawing") {
    return (
      <Column justify="center" gap={64}>
        <Drawing
          slide={slide}
          ctx={ctx}
          icon={slide.icon ?? slide.visual?.to.icon ?? "sparkles"}
          size={440}
        />
        <Block name="title" slide={slide}>
          <Title text={slide.title} ctx={ctx} size="title" />
        </Block>
        {slide.body && (
          <Block name="body" slide={slide}>
            <div style={{ maxWidth: 720 }}>
              <Text text={slide.body} ctx={ctx} size={31} />
            </div>
          </Block>
        )}
      </Column>
    );
  }
  if (composition === "quote") {
    // A quote: giant quotation marks, the title as what is said, the body after a rule.
    return (
      <Column justify="center" gap={56}>
        <Block name="title" slide={slide} gap={8}>
          <span
            aria-hidden
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: 340,
              lineHeight: 0.62,
              height: 170,
              color: "var(--hl)",
            }}
          >
            “
          </span>
          <Title text={slide.title} ctx={ctx} size="statement" />
        </Block>
        {slide.body && (
          <Block name="body" slide={slide} gap={28}>
            <div style={{ width: 120, height: 6, background: "var(--hl)" }} />
            <div style={{ maxWidth: 720 }}>
              <Text text={slide.body} ctx={ctx} size={31} />
            </div>
          </Block>
        )}
      </Column>
    );
  }
  // Centered as a group: a statement is the slide, no empty band between title and support.
  return (
    <Column justify="center" gap={72}>
      <Block name="title" slide={slide}>
        <Title text={slide.title} ctx={ctx} size={slide.visual ? "title" : "statement"} />
      </Block>
      {(slide.visual || slide.body) && (
        <Block name="body" slide={slide} gap={40}>
          <FromTo slide={slide} ctx={ctx} />
          {slide.body && (
            <div style={{ maxWidth: 720 }}>
              <Text text={slide.body} ctx={ctx} size={31} />
            </div>
          )}
        </Block>
      )}
    </Column>
  );
}

function Question({ slide, ctx }: TemplateArgs<"question">) {
  const center = ctx.kit.compose.question === "center";
  return (
    <Column
      justify={center ? "center" : "space-between"}
      align={center ? "center" : undefined}
      gap={80}
    >
      <Block name="title" slide={slide} align={center ? "center" : undefined}>
        <Title text={slide.title} ctx={ctx} size="title" align={center ? "center" : undefined} />
      </Block>
      <Block name="body" slide={slide}>
        <div style={{ width: center ? 700 : 620 }}>
          <ctx.kit.Panel ctx={ctx} strong>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                textAlign: center ? "center" : undefined,
              }}
            >
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: 40,
                  lineHeight: 1.15,
                  letterSpacing: "-0.02em",
                }}
              >
                <Rich text={slide.callout.lead} emphasis={ctx.kit.emphasis(ctx, "text")} />
              </span>
              <Text text={slide.callout.text} ctx={ctx} size={29} />
            </div>
          </ctx.kit.Panel>
        </div>
      </Block>
    </Column>
  );
}

/** A step in the `grid` and `path` compositions: number, title and text. */
function StepCell({
  ctx,
  index,
  step,
  numeral,
  align,
}: {
  ctx: LookContext;
  index: number;
  step: SlideOf<"steps">["steps"][number];
  numeral: number;
  align?: "right";
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: align }}>
      {numeral > 0 && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: ctx.kit.title.weight,
            fontSize: numeral,
            lineHeight: 0.9,
            letterSpacing: "-0.04em",
            color: "var(--hl)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
      )}
      <span
        data-qa="text"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 40,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
        }}
      >
        <Rich text={step.title} emphasis={ctx.kit.emphasis(ctx, "text")} />
      </span>
      <Text text={step.text} ctx={ctx} size={28} />
    </div>
  );
}

function Steps({ slide, ctx }: TemplateArgs<"steps">) {
  const composition = slide.composition ?? "list";
  if (composition === "grid") {
    // Two columns of cells, each led by a big number.
    return (
      <Column justify="center" gap={64}>
        <Block name="title" slide={slide}>
          <Title text={slide.title} ctx={ctx} size="small" />
        </Block>
        <Block name="body" slide={slide}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 56, rowGap: 52 }}
          >
            {slide.steps.map((step, i) => (
              <StepCell key={step.title} ctx={ctx} index={i} step={step} numeral={110} />
            ))}
          </div>
        </Block>
      </Column>
    );
  }
  if (composition === "path") {
    // A zigzag down a center line: each step on one side, its number on the line.
    const side = (W - 120) / 2;
    return (
      <Column justify="center" gap={56}>
        <Block name="title" slide={slide}>
          <Title text={slide.title} ctx={ctx} size="small" />
        </Block>
        <Block name="body" slide={slide}>
          <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 28 }}>
            <div
              style={{
                position: "absolute",
                left: W / 2 - 2,
                top: 30,
                bottom: 30,
                width: 4,
                background: "var(--line)",
              }}
            />
            {slide.steps.map((step, i) => {
              const right = i % 2 === 1;
              const cell = (
                <StepCell
                  ctx={ctx}
                  index={i}
                  step={step}
                  numeral={0}
                  align={right ? undefined : "right"}
                />
              );
              return (
                <div key={step.title} style={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
                  <div style={{ width: side }}>{right ? null : cell}</div>
                  <div style={{ width: 120, display: "flex", justifyContent: "center" }}>
                    <span
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 999,
                        background: "var(--hl)",
                        color: "var(--bg)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-mono)",
                        fontSize: 26,
                        fontWeight: 700,
                        position: "relative",
                      }}
                    >
                      {i + 1}
                    </span>
                  </div>
                  <div style={{ width: side }}>{right ? cell : null}</div>
                </div>
              );
            })}
          </div>
        </Block>
      </Column>
    );
  }
  return (
    <Column justify="center" gap={64}>
      <Block name="title" slide={slide}>
        <Title text={slide.title} ctx={ctx} size="small" />
      </Block>
      <Block name="body" slide={slide}>
        <ctx.kit.List
          ctx={ctx}
          numbered
          items={slide.steps.map((s) => ({ title: s.title, text: s.text }))}
        />
      </Block>
    </Column>
  );
}

/** A card of the `tiles` and `bento` compositions, in the look's panel. */
function Tile({
  ctx,
  card,
  big,
  narrow,
}: {
  ctx: LookContext;
  card: SlideOf<"cardGrid">["cards"][number];
  big?: boolean;
  /** In three columns: smaller type, so a 24-letter label still breaks in two lines. */
  narrow?: boolean;
}) {
  return (
    <ctx.kit.Panel ctx={ctx} strong={big}>
      <div
        style={{
          display: "flex",
          flexDirection: big ? "row" : "column",
          alignItems: big ? "center" : "flex-start",
          gap: big ? 32 : 18,
        }}
      >
        <SlideIcon name={card.icon} size={big ? 96 : 52} color="var(--hl)" />
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {card.lead && (
            <span
              data-qa="text"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: big ? 30 : 24,
                color: "var(--muted)",
              }}
            >
              {card.lead}
            </span>
          )}
          <span
            data-qa="text"
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: big ? 52 : narrow ? 26 : 32,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {card.label}
          </span>
        </div>
      </div>
    </ctx.kit.Panel>
  );
}

function CardGrid({ slide, ctx }: TemplateArgs<"cardGrid">) {
  const composition = slide.composition ?? "list";
  if (composition === "tiles" || composition === "bento") {
    // Tiles: a grid of panels. Bento: the first card big across, the rest in a grid below.
    const [first, ...rest] = slide.cards;
    const cards = composition === "bento" ? rest : slide.cards;
    const columns = cards.length === 3 || cards.length > 4 ? 3 : 2;
    return (
      <Column justify="center" gap={56}>
        <Block name="title" slide={slide} gap={20}>
          <Title text={slide.title} ctx={ctx} size="small" />
          {slide.intro && <Text text={slide.intro} ctx={ctx} size={30} />}
        </Block>
        <Block name="body" slide={slide} gap={24}>
          {composition === "bento" && first && <Tile ctx={ctx} card={first} big />}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 24 }}>
            {cards.map((card) => (
              <Tile key={card.label} ctx={ctx} card={card} narrow={columns === 3} />
            ))}
          </div>
          {slide.footer && <Text text={slide.footer} ctx={ctx} size={30} color="var(--fg)" />}
        </Block>
      </Column>
    );
  }
  return (
    <Column justify="center" gap={56}>
      <Block name="title" slide={slide} gap={20}>
        <Title text={slide.title} ctx={ctx} size="small" />
        {slide.intro && <Text text={slide.intro} ctx={ctx} size={30} />}
      </Block>
      <Block name="body" slide={slide} gap={40}>
        <ctx.kit.List
          ctx={ctx}
          numbered={false}
          items={slide.cards.map((c) => ({ title: c.label, lead: c.lead, icon: c.icon }))}
        />
        {slide.footer && <Text text={slide.footer} ctx={ctx} size={30} color="var(--fg)" />}
      </Block>
    </Column>
  );
}

function Flow({ slide, ctx }: TemplateArgs<"flow">) {
  return (
    <Column justify="center" gap={56}>
      <Block name="title" slide={slide}>
        <Title text={slide.title} ctx={ctx} size="small" />
      </Block>
      <Block name="body" slide={slide} gap={36}>
        <ctx.kit.List
          ctx={ctx}
          numbered
          items={slide.nodes.map((n) => ({ title: n.label, icon: n.icon }))}
        />
        {slide.body && <Text text={slide.body} ctx={ctx} size={29} />}
        {slide.closing && <Text text={slide.closing} ctx={ctx} size={30} color="var(--fg)" />}
      </Block>
    </Column>
  );
}

function HubDiagram({ slide, ctx }: TemplateArgs<"hubDiagram">) {
  return (
    <Column justify="center" gap={56}>
      <Block name="title" slide={slide}>
        <Title text={slide.title} ctx={ctx} size="small" />
      </Block>
      <Block name="body" slide={slide} gap={36}>
        <div style={{ display: "flex" }}>
          <span
            style={{
              width: 76,
              height: 76,
              borderRadius: 999,
              background: "var(--hl)",
              color: "var(--bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SlideIcon name={slide.center.icon} size={38} color="var(--bg)" />
          </span>
        </div>
        <ctx.kit.List
          ctx={ctx}
          numbered={false}
          items={slide.nodes.map((n) => ({ title: n.label, icon: n.icon }))}
        />
        {slide.body && <Text text={slide.body} ctx={ctx} size={29} />}
        {slide.closing && <Text text={slide.closing} ctx={ctx} size={30} color="var(--fg)" />}
      </Block>
    </Column>
  );
}

function Comparison({ slide, ctx }: TemplateArgs<"comparison">) {
  const Side = ({ side, strong }: { side: SlideOf<"comparison">["left"]; strong: boolean }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <ctx.kit.Panel ctx={ctx} strong={strong}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {side.icon && (
              <SlideIcon name={side.icon} size={34} color={strong ? "var(--hl)" : "var(--muted)"} />
            )}
            <span
              data-qa="text"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 34,
                letterSpacing: "-0.02em",
              }}
            >
              {side.name}
            </span>
          </div>
          {side.points.map((point) => (
            <div key={point} style={{ display: "flex", gap: 12 }}>
              <span
                style={{
                  color: strong ? "var(--hl)" : "var(--muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 26,
                  lineHeight: 1.35,
                }}
              >
                {strong ? "+" : "–"}
              </span>
              <Text
                text={point}
                ctx={ctx}
                size={26}
                color={strong ? "var(--fg)" : "var(--muted)"}
              />
            </div>
          ))}
        </div>
      </ctx.kit.Panel>
    </div>
  );
  return (
    <Column justify="center" gap={56}>
      <Block name="title" slide={slide}>
        <Title text={slide.title} ctx={ctx} size="small" />
      </Block>
      <Block name="body" slide={slide} gap={40}>
        <div style={{ display: "flex", gap: 22, alignItems: "stretch" }}>
          <Side side={slide.left} strong={false} />
          <Side side={slide.right} strong />
        </div>
        <Text text={slide.verdict} ctx={ctx} size={31} color="var(--fg)" />
      </Block>
    </Column>
  );
}

function CostBreakdown({ slide, ctx }: TemplateArgs<"costBreakdown">) {
  const dense = slide.items.length >= 5;
  const size = dense ? 27 : 30;
  return (
    <Column justify="center" gap={48}>
      <Block name="title" slide={slide}>
        <Title text={slide.title} ctx={ctx} size="small" />
      </Block>
      <Block name="body" slide={slide} gap={28}>
        <div>
          {slide.items.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 24,
                padding: `${dense ? 16 : 22}px 0`,
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span data-qa="text" style={{ fontFamily: "var(--font-body)", fontSize: size }}>
                {item.label}
              </span>
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: size,
                  fontVariantNumeric: "tabular-nums",
                  whiteSpace: "nowrap",
                }}
              >
                {item.range}
              </span>
            </div>
          ))}
        </div>
        <ctx.kit.Panel ctx={ctx} strong>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "baseline",
              columnGap: 24,
              rowGap: 8,
            }}
          >
            <Label size={22}>{slide.total.label}</Label>
            <span
              data-qa="text"
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: 52,
                color: "var(--hl)",
                whiteSpace: "nowrap",
                letterSpacing: "-0.02em",
              }}
            >
              {slide.total.range}
            </span>
          </div>
        </ctx.kit.Panel>
        {slide.note && <Text text={slide.note} ctx={ctx} size={24} />}
      </Block>
    </Column>
  );
}

/** The value in one line: the longer it is, the smaller (up to 300 px). */
export function studioBigNumberSize(value: string): number {
  return Math.min(300, Math.floor(W / ([...value].length * 0.62)));
}

function BigNumber({ slide, ctx }: TemplateArgs<"bigNumber">) {
  return (
    <Column justify="center" gap={40}>
      <Block name="title" slide={slide} gap={20}>
        {slide.kicker && <Kicker text={slide.kicker} ctx={ctx} />}
        <span
          data-qa="text"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: ctx.kit.title.weight,
            fontSize: studioBigNumberSize(slide.value),
            lineHeight: 1,
            letterSpacing: "-0.05em",
            color: "var(--hl)",
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
          }}
        >
          {slide.value}
        </span>
      </Block>
      <Block name="body" slide={slide} gap={24}>
        <Title text={slide.label} ctx={ctx} size="small" />
        {slide.context && <Text text={slide.context} ctx={ctx} size={29} />}
        <Label size={18}>Fuente: {slide.source}</Label>
      </Block>
    </Column>
  );
}

const CHART_H = 460;

function Chart({ slide, ctx, datasets }: TemplateArgs<"chart">) {
  const dataset = datasets[slide.datasetRef];
  if (!dataset)
    throw new Error(`No hay datos para el gráfico: falta el dataset "${slide.datasetRef}".`);
  const values = dataset.points.map((p) => p.value);
  const layout = chartLayout(values, slide.kind, W, CHART_H);
  const { plot } = layout;
  const decimals = decimalsFor(values);
  const format = (v: number) =>
    withUnit(formatNumber(v, decimals), dataset.unit, dataset.unitPosition);
  const last = values.length - 1;
  const line = layout.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const axis = { fontFamily: "var(--font-mono)", fontSize: 19, fill: "var(--muted)" } as const;
  return (
    <Column justify="center" gap={48}>
      <Block name="title" slide={slide}>
        <Title text={slide.title} ctx={ctx} size="small" />
      </Block>
      <Block name="body" slide={slide} gap={24}>
        <svg width={W} height={CHART_H} role="img" aria-label={plainOf(slide.title)}>
          {layout.yTicks.map((t) => (
            <g key={t.value}>
              <line
                x1={plot.x}
                x2={plot.x + plot.width}
                y1={t.y}
                y2={t.y}
                stroke="var(--line)"
                strokeDasharray="3 7"
              />
              <text x={plot.x - 16} y={t.y + 6} textAnchor="end" style={axis}>
                {formatNumber(t.value, 0)}
              </text>
            </g>
          ))}
          {layout.xLabels.map(({ index, x }) => (
            <text key={index} x={x} y={plot.y + plot.height + 38} textAnchor="middle" style={axis}>
              {dataset.points[index]?.label}
            </text>
          ))}
          {slide.kind === "line" ? (
            <path d={line} fill="none" stroke="var(--hl)" strokeWidth={5} strokeLinejoin="round" />
          ) : (
            layout.bars.map((b, i) => (
              <rect
                // biome-ignore lint/suspicious/noArrayIndexKey: bars follow the data order
                key={i}
                x={b.x}
                y={b.y}
                width={b.width}
                height={b.height}
                fill="var(--hl)"
                opacity={i === last ? 1 : 0.4}
              />
            ))
          )}
          <text
            x={plot.x}
            y={36}
            style={{ ...axis, fill: "var(--hl)", fontSize: 30, fontWeight: 600 }}
          >
            {format(values[last] ?? 0)} · {dataset.points[last]?.label}
          </text>
        </svg>
        {slide.caption && <Text text={slide.caption} ctx={ctx} size={28} />}
        <Label size={18}>Fuente: {slide.source}</Label>
      </Block>
    </Column>
  );
}

/** The device layer of a `screen` slide: movable and scalable like a hero image (ADR 0013). */
function Device({ slide, children }: { slide: Slide; children: ReactNode }) {
  return (
    <Layer name="hero" layout={slide.layout}>
      <div data-qa="content" style={{ display: "flex", justifyContent: "center" }}>
        {children}
      </div>
    </Layer>
  );
}

function Screen({ slide, ctx }: TemplateArgs<"screen">) {
  const shots = screenComposition(slide.screens, ctx.assets);
  const H = STUDIO_CONTENT_BOX.height;
  if (shots.kind === "phone") {
    // The phone beside the text: the text column takes what the phone leaves.
    const gap = 44;
    const phone = phoneSize(shots.phone, { width: 400, height: H - 40 });
    const column = W - phone.width - gap;
    return (
      <div style={{ display: "flex", alignItems: "center", gap, height: "100%" }}>
        <div style={{ width: column, display: "flex", flexDirection: "column", gap: 36 }}>
          <Block name="title" slide={slide}>
            <Title text={slide.title} ctx={ctx} size="small" width={column} />
          </Block>
          {slide.body && (
            <Block name="body" slide={slide}>
              <Text text={slide.body} ctx={ctx} size={28} />
            </Block>
          )}
        </div>
        <Device slide={slide}>
          <Phone shot={shots.phone} max={{ width: 400, height: H - 40 }} />
        </Device>
      </div>
    );
  }
  // A laptop (with the phone in front, when there is one of each) under the text.
  return (
    <Column justify="center" gap={56}>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <Block name="title" slide={slide}>
          <Title text={slide.title} ctx={ctx} size="small" />
        </Block>
        {slide.body && (
          <Block name="body" slide={slide}>
            <div style={{ maxWidth: 760 }}>
              <Text text={slide.body} ctx={ctx} size={28} />
            </div>
          </Block>
        )}
      </div>
      <Device slide={slide}>
        {shots.kind === "laptop" ? (
          <Laptop shot={shots.laptop} max={{ width: 780, height: 560 }} />
        ) : (
          <div style={{ position: "relative", width: W, height: 540 }}>
            <div style={{ position: "absolute", left: 0, top: 20 }}>
              <Laptop shot={shots.laptop} max={{ width: 700, height: 500 }} />
            </div>
            <div style={{ position: "absolute", right: 0, bottom: 0 }}>
              <Phone shot={shots.phone} max={{ width: 250, height: 500 }} />
            </div>
          </div>
        )}
      </Device>
    </Column>
  );
}

function Cta({ slide, ctx }: TemplateArgs<"cta">) {
  // With an image, low: the object (or the scene, `bleed`) takes the top.
  const mode = ctx.art ? "low" : ctx.kit.compose.cta;
  const center = mode !== "left";
  return (
    <Column
      justify={mode === "low" ? "flex-end" : "center"}
      align={center ? "center" : undefined}
      gap={56}
    >
      <Block name="title" slide={slide} gap={32} align={center ? "center" : undefined}>
        <Title
          text={slide.title}
          ctx={ctx}
          size={ctx.art ? "title" : "statement"}
          align={center ? "center" : undefined}
        />
        {slide.subtitle && (
          <div style={{ maxWidth: 680 }}>
            <Text
              text={slide.subtitle}
              ctx={ctx}
              size={32}
              style={{ textAlign: center ? "center" : undefined }}
            />
          </div>
        )}
      </Block>
      <Block name="body" slide={slide} align={center ? "center" : "flex-start"}>
        <ctx.kit.Button ctx={ctx} text={slide.button} icon={slide.icon} />
      </Block>
    </Column>
  );
}

export const studioTemplates: { [T in SlideType]: (args: TemplateArgs<T>) => ReactNode } = {
  cover: Cover,
  statement: Statement,
  question: Question,
  cardGrid: CardGrid,
  flow: Flow,
  hubDiagram: HubDiagram,
  comparison: Comparison,
  costBreakdown: CostBreakdown,
  steps: Steps,
  bigNumber: BigNumber,
  chart: Chart,
  screen: Screen,
  cta: Cta,
};
