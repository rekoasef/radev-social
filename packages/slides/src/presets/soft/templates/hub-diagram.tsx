import type { SlideOf } from "../../../content/slides";
import { SlideIcon } from "../../../icons";
import { fitFontSize } from "../../shared/fit";
import { HUB_CHIP, hubLayout, type Point } from "../../shared/layout";
import { SOFT_CONTENT_BOX } from "../frame";
import {
  ArrowMarker,
  ConnectorDot,
  connectorStroke,
  glassStyle,
  Support,
  TemplateLayout,
} from "../parts";

const CHIP_ICON = 34;
const CHIP_PADDING = 24;
const CHIP_GAP = 14;
/** Chip width taken by everything but the label: padding, icon, gap and borders. */
const CHIP_CHROME = 2 * CHIP_PADDING + CHIP_ICON + CHIP_GAP + 2;

// `hubDiagram`: glass chips (icon and label on one line) whose thin connectors converge on an
// elevated center with the icon in accent and a soft halo. Same slots as `bold`.

function curve(from: Point, to: Point): string {
  if (from.x === to.x) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const mid = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x} ${to.y}`;
}

export function HubDiagramTemplate({ slide }: { slide: SlideOf<"hubDiagram"> }) {
  const layout = hubLayout(slide.nodes.length, SOFT_CONTENT_BOX.width);
  const { center } = layout;
  const labelSize = fitFontSize(
    slide.nodes.map((node) => node.label),
    HUB_CHIP.width - CHIP_CHROME,
    { base: 26, min: 19, oneLine: true },
  );

  return (
    <TemplateLayout title={slide.title} layout={slide.layout}>
      <div style={{ position: "relative", width: layout.width, height: layout.height }}>
        <svg
          aria-hidden="true"
          width={layout.width}
          height={layout.height}
          style={{ position: "absolute", inset: 0, overflow: "visible" }}
        >
          <defs>
            <ArrowMarker id="soft-hub-arrow" />
          </defs>
          {layout.chips.map(({ slot, from, to }) => (
            <g key={slot}>
              <path d={curve(from, to)} {...connectorStroke} markerEnd="url(#soft-hub-arrow)" />
              <ConnectorDot {...from} />
            </g>
          ))}
        </svg>

        <div
          data-qa="content"
          style={{
            ...glassStyle(),
            background: "var(--elevated)",
            position: "absolute",
            left: center.x,
            top: center.y,
            width: center.width,
            height: center.height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
            boxShadow: "0 0 48px color-mix(in srgb, var(--accent) 22%, transparent)",
          }}
        >
          <SlideIcon name={slide.center.icon} size={52} strokeWidth={1.8} />
        </div>

        {layout.chips.map(({ slot, box }, i) => {
          const node = slide.nodes[i];
          if (!node) return null;
          return (
            <div
              key={slot}
              data-qa="content"
              style={{
                ...glassStyle("var(--radius-card)"),
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                display: "flex",
                alignItems: "center",
                gap: CHIP_GAP,
                padding: `0 ${CHIP_PADDING}px`,
                color: "var(--secondary)",
              }}
            >
              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                <SlideIcon name={node.icon} size={CHIP_ICON} strokeWidth={1.8} />
              </span>
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                  fontSize: labelSize,
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  color: "var(--text)",
                }}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>
      {(slide.body || slide.closing) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {slide.body && <Support text={slide.body} size={28} />}
          {slide.closing && <Support text={slide.closing} size={28} />}
        </div>
      )}
    </TemplateLayout>
  );
}
