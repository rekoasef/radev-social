import type { SlideOf } from "../../../content/slides";
import { BOLD_CONTENT_BOX } from "../frame";
import { boxStyle, IconTile, Rich, Support, supportEmphasis, TemplateLayout } from "../parts";

// `comparison`: two columns, X on the left and Y on the right. The right one is the option the
// verdict leans to: accent border and markers; the left one stays neutral (line color, no glow).

type Side = SlideOf<"comparison">["left"];

const GAP = 24;

function Column({ side, favored }: { side: Side; favored: boolean }) {
  const marker = favored ? "var(--accent)" : "var(--muted)";
  return (
    <div
      data-qa="content"
      style={{
        ...boxStyle(),
        ...(favored ? {} : { border: "1.5px solid var(--line)", boxShadow: "none" }),
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 28,
        padding: "32px 30px 34px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {side.icon && <IconTile name={side.icon} size={64} accent={favored} />}
        <span
          data-qa="text"
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            fontSize: 32,
            lineHeight: 1.25,
            color: "var(--text)",
          }}
        >
          {side.name}
        </span>
      </div>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {side.points.map((point) => (
          <li
            key={point}
            data-qa="text"
            style={{
              display: "flex",
              gap: 14,
              fontFamily: "var(--font-body)",
              fontWeight: "var(--weight-body)",
              fontSize: 27,
              lineHeight: 1.25,
              color: "color-mix(in srgb, var(--text) 82%, var(--bg))",
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 9,
                height: 9,
                marginTop: 12,
                borderRadius: "50%",
                background: marker,
              }}
            />
            <span>
              <Rich text={point} emphasis={supportEmphasis} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComparisonTemplate({ slide }: { slide: SlideOf<"comparison"> }) {
  return (
    <TemplateLayout title={slide.title}>
      <div
        style={{ display: "flex", alignItems: "stretch", gap: GAP, width: BOLD_CONTENT_BOX.width }}
      >
        <Column side={slide.left} favored={false} />
        <Column side={slide.right} favored />
      </div>
      <Support text={slide.verdict} size={32} balance />
    </TemplateLayout>
  );
}
