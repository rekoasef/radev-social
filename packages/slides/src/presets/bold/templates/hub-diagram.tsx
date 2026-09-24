import type { SlideOf } from "../../../content/slides";
import { SlideIcon } from "../../../icons";
import { HUB_CHIP, hubLayout, type Point } from "../../shared/layout";
import { BOLD_CONTENT_BOX } from "../frame";
import {
  ArrowMarker,
  boxStyle,
  ConnectorDot,
  fitFontSize,
  glowShadow,
  Support,
  TemplateLayout,
} from "../parts";

const CHIP_ICON = 38;
const CHIP_PADDING = 24;
const CHIP_GAP = 16;
/** Chip width taken by everything but the label: padding, icon, gap and borders. */
const CHIP_CHROME = 2 * CHIP_PADDING + CHIP_ICON + CHIP_GAP + 3;

// `hubDiagram` (ref-hubdiagram): chips (icon and label on one line) whose connectors converge,
// with an arrow, on a center box with the icon in accent.

/** Curve that leaves the chip horizontally (or vertically, for top/bottom) and enters the center the same way. */
function curve(from: Point, to: Point): string {
  if (from.x === to.x) return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  const mid = (from.x + to.x) / 2;
  return `M ${from.x} ${from.y} C ${mid} ${from.y}, ${mid} ${to.y}, ${to.x} ${to.y}`;
}

export function HubDiagramTemplate({ slide }: { slide: SlideOf<"hubDiagram"> }) {
  const layout = hubLayout(slide.nodes.length, BOLD_CONTENT_BOX.width);
  const { center } = layout;
  const labelSize = fitFontSize(
    slide.nodes.map((node) => node.label),
    HUB_CHIP.width - CHIP_CHROME,
    { base: 26, min: 19, oneLine: true },
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
          <defs>
            <ArrowMarker id="hub-arrow" />
          </defs>
          {layout.chips.map(({ slot, from, to }) => (
            <g key={slot}>
              <path
                d={curve(from, to)}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.6}
                opacity={0.85}
                markerEnd="url(#hub-arrow)"
              />
              <ConnectorDot {...from} />
            </g>
          ))}
        </svg>

        <div
          data-qa="content"
          style={{
            ...boxStyle(),
            position: "absolute",
            left: center.x,
            top: center.y,
            width: center.width,
            height: center.height,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent)",
            boxShadow: glowShadow(40),
          }}
        >
          <SlideIcon name={slide.center.icon} size={56} />
        </div>

        {layout.chips.map(({ slot, box }, i) => {
          const node = slide.nodes[i];
          if (!node) return null;
          return (
            <div
              key={slot}
              data-qa="content"
              style={{
                ...boxStyle(),
                position: "absolute",
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                display: "flex",
                alignItems: "center",
                gap: CHIP_GAP,
                padding: `0 ${CHIP_PADDING}px`,
                color: "var(--text)",
              }}
            >
              <span style={{ display: "inline-flex", flexShrink: 0 }}>
                <SlideIcon name={node.icon} size={CHIP_ICON} />
              </span>
              <span
                data-qa="text"
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 400,
                  fontSize: labelSize,
                  lineHeight: 1.1,
                  whiteSpace: "nowrap",
                }}
              >
                {node.label}
              </span>
            </div>
          );
        })}
      </div>
      {(slide.body || slide.closing) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {slide.body && <Support text={slide.body} size={29} />}
          {slide.closing && <Support text={slide.closing} size={29} balance />}
        </div>
      )}
    </TemplateLayout>
  );
}
