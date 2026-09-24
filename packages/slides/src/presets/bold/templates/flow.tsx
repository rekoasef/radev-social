import type { SlideOf } from "../../../content/slides";
import { flowLayout, isCompactFlow } from "../../shared/layout";
import { BOLD_CONTENT_BOX } from "../frame";
import { boxStyle, ConnectorDot, fitFontSize, IconTile, Support, TemplateLayout } from "../parts";

// `flow` (ref-flow-1, ref-flow-2): cards in order, joined by accent connectors with glowing
// points at both ends. Icon tile on top, label below: left aligned, or centered in the compact
// cards of a four-node row (ref-flow-2).

export function FlowTemplate({ slide }: { slide: SlideOf<"flow"> }) {
  const layout = flowLayout(slide.nodes.length, BOLD_CONTENT_BOX.width);
  const compact = isCompactFlow(slide.nodes.length);
  const padding = compact ? 12 : 26;
  const cardWidth = layout.cards[0]?.width ?? 0;
  const fontSize = fitFontSize(
    slide.nodes.map((node) => node.label),
    cardWidth - 2 * padding - 3,
    { base: compact ? 24 : 29, min: 19 },
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
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.6}
                  strokeLinejoin="round"
                  opacity={0.85}
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
                ...boxStyle(),
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
              <IconTile name={node.icon} size={compact ? 64 : 76} />
              <div
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: compact ? 500 : 400,
                  fontSize,
                  lineHeight: 1.15,
                  color: "var(--text)",
                  textWrap: "balance",
                  // Last resort for a word too long even at the minimum size: break it rather
                  // than let it leave the card.
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
          {slide.body && <Support text={slide.body} />}
          {slide.closing && <Support text={slide.closing} balance />}
        </div>
      )}
    </TemplateLayout>
  );
}
