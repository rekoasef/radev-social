import type { SlideOf } from "../../../content/slides";
import { fitFontSize } from "../../shared/fit";
import { flowLayout, isCompactFlow } from "../../shared/layout";
import { SOFT_CONTENT_BOX } from "../frame";
import {
  ConnectorDot,
  connectorStroke,
  glassStyle,
  IconBadge,
  Support,
  TemplateLayout,
} from "../parts";

// `flow`: glass cards in order, joined by thin accent connectors with small dots at the ends.
// Same geometry as `bold` (shared layout): one row up to 4 nodes, 3 + 2 with 5.

export function FlowTemplate({ slide }: { slide: SlideOf<"flow"> }) {
  const layout = flowLayout(slide.nodes.length, SOFT_CONTENT_BOX.width);
  const compact = isCompactFlow(slide.nodes.length);
  const padding = compact ? 12 : 26;
  const cardWidth = layout.cards[0]?.width ?? 0;
  const fontSize = fitFontSize(
    slide.nodes.map((node) => node.label),
    cardWidth - 2 * padding - 3,
    { base: compact ? 24 : 28, min: 19 },
  );

  return (
    <TemplateLayout title={slide.title}>
      <div style={{ position: "relative", width: layout.width, height: layout.height }}>
        <svg
          aria-hidden="true"
          width={layout.width}
          height={layout.height}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          {layout.connectors.map((points) => {
            const first = points[0];
            const last = points[points.length - 1];
            if (!first || !last) return null;
            return (
              <g key={`${first.x}-${first.y}`}>
                <polyline
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  {...connectorStroke}
                  strokeLinejoin="round"
                />
                <ConnectorDot {...first} />
                <ConnectorDot {...last} />
              </g>
            );
          })}
        </svg>
        {slide.nodes.map((node, i) => {
          const box = layout.cards[i];
          if (!box) return null;
          return (
            <div
              key={`${box.x}-${box.y}`}
              data-qa="content"
              style={{
                ...glassStyle("var(--radius-card)"),
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                display: "flex",
                flexDirection: "column",
                justifyContent: compact ? "center" : "space-between",
                alignItems: compact ? "center" : "stretch",
                gap: compact ? 18 : 0,
                padding: `${compact ? 20 : 26}px ${padding}px`,
                textAlign: compact ? "center" : "left",
              }}
            >
              <IconBadge name={node.icon} size={compact ? 60 : 68} />
              <div
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                  fontSize,
                  lineHeight: 1.2,
                  color: "var(--text)",
                  textWrap: "balance",
                  // Last resort for a word too long even at the minimum size.
                  overflowWrap: "anywhere",
                  alignSelf: "stretch",
                }}
              >
                {node.label}
              </div>
            </div>
          );
        })}
      </div>
      {(slide.body || slide.closing) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {slide.body && <Support text={slide.body} size={30} />}
          {slide.closing && <Support text={slide.closing} size={30} />}
        </div>
      )}
    </TemplateLayout>
  );
}
