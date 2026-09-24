import type { Datasets } from "../../../content/datasets";
import type { SlideOf } from "../../../content/slides";
import { decimalsFor, formatNumber, withUnit } from "../../../format";
import { chartLayout } from "../../shared/chart-layout";
import { SOFT_CONTENT_BOX } from "../frame";
import { Source, Support, TemplateLayout } from "../parts";

// `chart`: line or bar chart in SVG, calm version: accent line with a soft area, axes and grid
// in the line color, values in the numeric font. Points come from `datasets` (injected by the
// code); without the dataset the render fails, so no chart goes out without real numbers.

const W = SOFT_CONTENT_BOX.width;
const H = 440;

const axisText = {
  fontFamily: "var(--font-numeric)",
  fontSize: 18,
  fill: "var(--muted)",
} as const;

/** Decimals for the axis: enough to tell the ticks apart. */
const tickDecimals = (ticks: number[]) => {
  const step = Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0));
  return step >= 1 || step === 0 ? 0 : Math.ceil(-Math.log10(step));
};

export function ChartTemplate({
  slide,
  datasets,
}: {
  slide: SlideOf<"chart">;
  datasets: Datasets;
}) {
  const dataset = datasets[slide.datasetRef];
  if (!dataset)
    throw new Error(`No hay datos para el gráfico: falta el dataset "${slide.datasetRef}".`);

  const values = dataset.points.map((p) => p.value);
  const layout = chartLayout(values, slide.kind, W, H);
  const { plot } = layout;
  const decimals = decimalsFor(values);
  const format = (v: number, d = decimals) =>
    withUnit(formatNumber(v, d), dataset.unit, dataset.unitPosition);
  const yDecimals = tickDecimals(layout.yTicks.map((t) => t.value));
  const last = values.length - 1;

  // Latest value above the last point or bar, kept inside the chart.
  const lastX =
    slide.kind === "line"
      ? (layout.points[last]?.x ?? 0)
      : (layout.bars[last]?.x ?? 0) + (layout.bars[last]?.width ?? 0) / 2;
  const lastY = slide.kind === "line" ? (layout.points[last]?.y ?? 0) : (layout.bars[last]?.y ?? 0);
  const badgeText = format(values[last] ?? 0);
  const badgeWidth = [...badgeText].length * 13 + 40;
  const badgeX = Math.min(W - badgeWidth, Math.max(plot.x, lastX - badgeWidth + 18));
  const badgeY = Math.max(0, lastY - 64);

  const line = layout.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const area = layout.points.length
    ? `${line} L ${plot.x + plot.width} ${plot.y + plot.height} L ${plot.x} ${plot.y + plot.height} Z`
    : "";

  return (
    <TemplateLayout title={slide.title}>
      <div data-qa="content" style={{ width: W, height: H }}>
        <svg aria-hidden="true" width={W} height={H} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="soft-chart-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>

          {layout.yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={plot.x}
                x2={plot.x + plot.width}
                y1={tick.y}
                y2={tick.y}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text x={plot.x - 18} y={tick.y} dy="0.35em" textAnchor="end" {...axisText}>
                {formatNumber(tick.value, yDecimals)}
              </text>
            </g>
          ))}

          {layout.xLabels.map(({ index, x }) => {
            const edge = slide.kind === "line" && (index === 0 || index === last);
            return (
              <text
                key={index}
                x={x}
                y={plot.y + plot.height + 38}
                textAnchor={edge ? (index === 0 ? "start" : "end") : "middle"}
                {...axisText}
              >
                {dataset.points[index]?.label}
              </text>
            );
          })}

          {slide.kind === "line" && (
            <>
              <path d={area} fill="url(#soft-chart-area)" />
              <path
                d={line}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle
                cx={lastX}
                cy={lastY}
                r={12}
                fill="color-mix(in srgb, var(--accent) 22%, transparent)"
              />
              <circle cx={lastX} cy={lastY} r={5.5} fill="var(--accent)" />
            </>
          )}

          {layout.bars.map((bar, i) => (
            <g key={bar.x}>
              <rect {...bar} rx={8} fill="var(--accent)" opacity={i === last ? 1 : 0.32} />
              {values.length <= 8 && i !== last && (
                <text
                  x={bar.x + bar.width / 2}
                  y={bar.y - 14}
                  textAnchor="middle"
                  {...axisText}
                  fill="var(--secondary)"
                >
                  {format(values[i] ?? 0)}
                </text>
              )}
            </g>
          ))}

          <g>
            <rect
              x={badgeX}
              y={badgeY}
              width={badgeWidth}
              height={44}
              rx={22}
              fill="var(--elevated)"
              stroke="color-mix(in srgb, var(--accent) 45%, transparent)"
            />
            <text
              x={badgeX + badgeWidth / 2}
              y={badgeY + 22}
              dy="0.35em"
              textAnchor="middle"
              style={{
                fontFamily: "var(--font-numeric)",
                fontWeight: 500,
                fontSize: 21,
                fill: "var(--accent)",
              }}
            >
              {badgeText}
            </text>
          </g>
        </svg>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {slide.caption && <Support text={slide.caption} size={28} />}
        <Source text={slide.source} />
      </div>
    </TemplateLayout>
  );
}
