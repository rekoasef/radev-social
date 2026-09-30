"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatCompact, niceTicks } from "./format";

// Columns from one baseline (dataviz: ≤ 24 px thick, 4 px rounded end, hairline grid, one axis).
// Each column is its own hover and focus target; the tooltip repeats what the table shows.

export type ColumnTone = "ours" | "rest" | "single";

export type ColumnItem = {
  key: string;
  value: number;
  tone: ColumnTone;
  /** Under the axis, only where it fits (the chart thins them out). */
  axisLabel: string;
  tooltip: { title: string; subtitle?: string; rows: { label: string; value: string }[] };
  href?: string;
};

const HEIGHT = 240;
const PAD = { top: 12, right: 12, bottom: 26, left: 44 };
const MAX_THICKNESS = 24;
const TONE_FILL: Record<ColumnTone, string> = {
  ours: "var(--chart-ours)",
  rest: "var(--chart-rest)",
  single: "var(--chart-ours)",
};

/** A column with a 4 px rounded top and a square foot on the baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function ColumnChart({
  items,
  reference,
  label,
  height = HEIGHT,
}: {
  items: ColumnItem[];
  /** A hairline across the plot, e.g. the median, with its label at the right. */
  reference?: { value: number; label: string };
  /** What the chart shows, for screen readers. */
  label: string;
  height?: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const max = Math.max(1, ...items.map((item) => item.value), reference?.value ?? 0);
  const ticks = niceTicks(max);
  const top = ticks.at(-1) ?? max;
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;
  const band = plotW / Math.max(1, items.length);
  const thickness = Math.max(2, Math.min(MAX_THICKNESS, band - 2));
  const y = (value: number) => PAD.top + plotH - (value / top) * plotH;
  // Axis labels only every few columns, so they never collide (~56 px each).
  const every = Math.max(1, Math.ceil(56 / band));

  const current = active === null ? null : items[active];
  // Beside the column, never over it: to its right, or to its left near the right edge.
  const TIP_WIDTH = 220;
  const columnRight = PAD.left + band * ((active ?? 0) + 0.5) + thickness / 2;
  const columnLeft = columnRight - thickness;
  const tipLeft =
    columnRight + 12 + TIP_WIDTH <= width
      ? columnRight + 12
      : Math.max(0, columnLeft - 12 - TIP_WIDTH);

  return (
    <div ref={frame} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={label}
        className="block overflow-visible"
        onPointerLeave={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="timecode fill-ink-faint text-[10px]"
            >
              {formatCompact(tick)}
            </text>
          </g>
        ))}

        {items.map((item, index) => {
          const x = PAD.left + band * index + (band - thickness) / 2;
          const h = Math.max(item.value > 0 ? 2 : 0, y(0) - y(item.value));
          return (
            <path
              key={item.key}
              d={columnPath(x, y(0) - h, thickness, h)}
              fill={TONE_FILL[item.tone]}
              opacity={active === null || active === index ? 1 : 0.45}
            />
          );
        })}

        {reference && reference.value > 0 && (
          <g>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(reference.value)}
              y2={y(reference.value)}
              stroke="var(--color-ink-dim)"
              strokeWidth={1}
            />
            <text
              x={width - PAD.right}
              y={y(reference.value) - 6}
              textAnchor="end"
              className="fill-ink-dim text-[11px]"
            >
              {reference.label}
            </text>
          </g>
        )}

        {items.map((item, index) =>
          index % every === 0 ? (
            <text
              key={item.key}
              x={PAD.left + band * (index + 0.5)}
              y={height - 8}
              textAnchor="middle"
              className="timecode fill-ink-faint text-[10px]"
            >
              {item.axisLabel}
            </text>
          ) : null,
        )}

        {/* Hit targets: the whole band, taller than the column (dataviz: bigger than the mark). */}
        {items.map((item, index) => (
          // biome-ignore lint/a11y/useSemanticElements: an SVG area can't be a <button>
          <rect
            key={item.key}
            x={PAD.left + band * index}
            y={PAD.top}
            width={band}
            height={plotH}
            fill="transparent"
            role="button"
            tabIndex={0}
            aria-label={`${item.tooltip.title}: ${item.tooltip.rows[0]?.value ?? ""}`}
            className={cn("outline-none", item.href && "cursor-pointer")}
            onPointerEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            onClick={() => item.href && window.open(item.href, "_blank", "noopener")}
            onKeyDown={(event) => {
              if (event.key === "Enter" && item.href) window.open(item.href, "_blank", "noopener");
            }}
          />
        ))}
      </svg>

      {current && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 w-[220px] rounded-md border border-bezel-strong bg-panel-raised px-3 py-2.5 shadow-lg"
          style={{ left: tipLeft }}
        >
          <p className="text-xs text-ink-dim">{current.tooltip.title}</p>
          {current.tooltip.subtitle && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-faint">{current.tooltip.subtitle}</p>
          )}
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
            {current.tooltip.rows.map((row, index) => (
              <div key={row.label} className="contents">
                <dt className="flex items-center gap-2 text-xs text-ink-dim">
                  {index === 0 && (
                    <span
                      aria-hidden="true"
                      className="h-0.5 w-3 rounded-full"
                      style={{ background: TONE_FILL[current.tone] }}
                    />
                  )}
                  {row.label}
                </dt>
                <dd
                  className={cn(
                    "timecode text-right",
                    index === 0 ? "text-sm font-semibold text-ink" : "text-xs text-ink",
                  )}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
