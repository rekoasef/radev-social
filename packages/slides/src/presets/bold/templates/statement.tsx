import type { SlideOf } from "../../../content/slides";
import { BOLD_CONTENT_BOX } from "../frame";
import {
  ArrowMarker,
  boxStyle,
  ConnectorDot,
  fitFontSize,
  IconTile,
  Support,
  TemplateLayout,
} from "../parts";

// `statement`: a strong claim with support. The optional visual is a "from → to" pair: two cards
// joined by a connector with an arrow; the destination's icon is in accent.

type End = NonNullable<SlideOf<"statement">["visual"]>["from"];

const CARD = { width: 300, height: 190 };
const PADDING = 22;

function EndCard({
  end,
  x,
  accent,
  fontSize,
}: {
  end: End;
  x: number;
  accent: boolean;
  fontSize: number;
}) {
  return (
    <div
      data-qa="content"
      style={{
        ...boxStyle(),
        position: "absolute",
        left: x,
        top: 0,
        width: CARD.width,
        height: CARD.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: `0 ${PADDING}px`,
      }}
    >
      <IconTile name={end.icon} accent={accent} />
      <span
        data-qa="text"
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize,
          lineHeight: 1.1,
          color: "var(--text)",
          whiteSpace: "nowrap",
        }}
      >
        {end.label}
      </span>
    </div>
  );
}

function FromTo({ visual }: { visual: NonNullable<SlideOf<"statement">["visual"]> }) {
  const width = BOLD_CONTENT_BOX.width;
  const toX = width - CARD.width;
  const y = CARD.height / 2;
  const fontSize = fitFontSize([visual.from.label, visual.to.label], CARD.width - 2 * PADDING - 3, {
    base: 30,
    min: 20,
    oneLine: true,
  });
  return (
    <div style={{ position: "relative", width, height: CARD.height }}>
      <svg
        aria-hidden="true"
        width={width}
        height={CARD.height}
        style={{ position: "absolute", inset: 0, overflow: "visible" }}
      >
        <defs>
          <ArrowMarker id="statement-arrow" />
        </defs>
        <line
          x1={CARD.width}
          y1={y}
          x2={toX - 14}
          y2={y}
          stroke="var(--accent)"
          strokeWidth={1.6}
          strokeDasharray="6 8"
          opacity={0.85}
          markerEnd="url(#statement-arrow)"
        />
        <ConnectorDot x={CARD.width} y={y} />
      </svg>
      <EndCard end={visual.from} x={0} accent={false} fontSize={fontSize} />
      <EndCard end={visual.to} x={toX} accent fontSize={fontSize} />
    </div>
  );
}

export function StatementTemplate({ slide }: { slide: SlideOf<"statement"> }) {
  return (
    <TemplateLayout title={slide.title} layout={slide.layout}>
      {slide.visual && <FromTo visual={slide.visual} />}
      {slide.body && <Support text={slide.body} size={34} />}
    </TemplateLayout>
  );
}
