import type { SlideOf } from "../../../content/slides";
import { fitFontSize } from "../../shared/fit";
import { SOFT_CONTENT_BOX } from "../frame";
import { glassStyle, IconBadge, Support, TemplateLayout } from "../parts";

// `statement`: a claim with support. The optional visual is a "from → to" pair: two glass panels
// joined by a thin line with an arrow; the destination's icon is in accent.

type Visual = NonNullable<SlideOf<"statement">["visual"]>;

const PANEL = { width: 300, height: 190 };
const PADDING = 22;
const GAP = SOFT_CONTENT_BOX.width - 2 * PANEL.width;

function EndPanel({
  end,
  accent,
  fontSize,
}: {
  end: Visual["from"];
  accent: boolean;
  fontSize: number;
}) {
  return (
    <div
      data-qa="content"
      style={{
        ...glassStyle(),
        width: PANEL.width,
        height: PANEL.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        padding: `0 ${PADDING}px`,
      }}
    >
      <IconBadge name={end.icon} accent={accent} />
      <span
        data-qa="text"
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          fontSize,
          // Room for descenders (p, q): tighter and they spill out of the box.
          lineHeight: 1.3,
          whiteSpace: "nowrap",
          color: accent ? "var(--text)" : "var(--secondary)",
        }}
      >
        {end.label}
      </span>
    </div>
  );
}

function FromTo({ visual }: { visual: Visual }) {
  const fontSize = fitFontSize([visual.from.label, visual.to.label], PANEL.width - 2 * PADDING, {
    base: 28,
    min: 20,
    oneLine: true,
  });
  return (
    <div style={{ display: "flex", alignItems: "center", width: SOFT_CONTENT_BOX.width }}>
      <EndPanel end={visual.from} accent={false} fontSize={fontSize} />
      <svg aria-hidden="true" width={GAP} height={24} style={{ overflow: "visible" }}>
        <path
          d={`M 32 12 H ${GAP - 32} M ${GAP - 42} 5 L ${GAP - 32} 12 L ${GAP - 42} 19`}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.75}
        />
      </svg>
      <EndPanel end={visual.to} accent fontSize={fontSize} />
    </div>
  );
}

export function StatementTemplate({ slide }: { slide: SlideOf<"statement"> }) {
  return (
    <TemplateLayout title={slide.title}>
      {slide.visual && <FromTo visual={slide.visual} />}
      {slide.body && <Support text={slide.body} size={34} />}
    </TemplateLayout>
  );
}
