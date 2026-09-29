import type { CSSProperties, ReactNode } from "react";
import type { Datasets } from "../../content/datasets";
import type { Slide, SlideOf, SlideType } from "../../content/slides";
import { decimalsFor, formatNumber, withUnit } from "../../format";
import { Layer } from "../../frame/layer";
import { SlideIcon } from "../../icons";
import { chartLayout } from "../shared/chart-layout";
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

function Cover({ slide, ctx }: TemplateArgs<"cover">) {
  // With a generated image the object takes the top and the title goes to the bottom.
  const mode = ctx.art ? "bottom" : ctx.kit.compose.cover;
  const center = mode === "center";
  const title = (
    <Block name="title" slide={slide} gap={32} align={center ? "center" : undefined}>
      {slide.kicker && <Kicker text={slide.kicker} ctx={ctx} />}
      <Title
        text={slide.title}
        ctx={ctx}
        size={ctx.art ? "title" : (ctx.kit.compose.coverTitle ?? "hero")}
        align={center ? "center" : undefined}
      />
    </Block>
  );
  const subtitle = slide.subtitle && (
    <Block name="body" slide={slide} align={center ? "center" : undefined}>
      <div style={{ maxWidth: 680 }}>
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
  if (mode === "bottom") {
    return (
      <Column justify="flex-end" gap={44}>
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

function Statement({ slide, ctx }: TemplateArgs<"statement">) {
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

function Steps({ slide, ctx }: TemplateArgs<"steps">) {
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

function CardGrid({ slide, ctx }: TemplateArgs<"cardGrid">) {
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

function Cta({ slide, ctx }: TemplateArgs<"cta">) {
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
  cta: Cta,
};
