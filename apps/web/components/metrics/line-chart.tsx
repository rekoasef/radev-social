"use client";

import { useEffect, useRef, useState } from "react";
import { formatCompact, formatNumber } from "./format";

// One series over days (dataviz: 2 px line, ~10 % wash, end value labeled, crosshair tooltip that
// snaps to the nearest day). The axis starts near the data: followers move a few at a time.

export type LinePoint = { key: string; label: string; value: number };

const HEIGHT = 200;
const PAD = { top: 16, right: 56, bottom: 26, left: 44 };

export function LineChart({
  points,
  label,
  unit,
}: {
  points: LinePoint[];
  label: string;
  /** In the tooltip after the value, e.g. "seguidores". */
  unit: string;
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

  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  // A range around the data, never flat: ±1 when every day is the same.
  const spread = Math.max(1, high - low);
  const min = Math.max(0, low - spread * 0.25);
  const max = high + spread * 0.25;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) =>
    PAD.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (value: number) => PAD.top + plotH - ((value - min) / (max - min)) * plotH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join("");
  const area = `${line}L${x(points.length - 1)},${PAD.top + plotH}L${x(0)},${PAD.top + plotH}Z`;
  const last = points.at(-1);
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(plotW / 64))));
  const current = active === null ? null : points[active];

  const pick = (clientX: number, rect: DOMRect) => {
    const ratio = (clientX - rect.left - PAD.left) / plotW;
    setActive(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <div ref={frame} className="relative w-full">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={label}
        className="block overflow-visible"
        onPointerMove={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setActive(null)}
      >
        {[min, (min + max) / 2, max].map((tick) => (
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
              {formatCompact(Math.round(tick))}
            </text>
          </g>
        ))}
        <path d={area} fill="var(--chart-ours)" opacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke="var(--chart-ours)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((point, index) =>
          index % every === 0 || index === points.length - 1 ? (
            <text
              key={point.key}
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
              className="timecode fill-ink-faint text-[10px]"
            >
              {point.label}
            </text>
          ) : null,
        )}
        {last && (
          <g>
            <circle
              cx={x(points.length - 1)}
              cy={y(last.value)}
              r={4}
              fill="var(--chart-ours)"
              stroke="var(--color-panel)"
              strokeWidth={2}
            />
            <text
              x={x(points.length - 1) + 10}
              y={y(last.value)}
              dy="0.32em"
              className="timecode fill-ink text-[12px] font-semibold"
            >
              {formatCompact(last.value)}
            </text>
          </g>
        )}
        {current && active !== null && (
          <g>
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke="var(--color-ink-faint)"
              strokeWidth={1}
            />
            <circle
              cx={x(active)}
              cy={y(current.value)}
              r={5}
              fill="var(--chart-ours)"
              stroke="var(--color-panel)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      {current && active !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-bezel-strong bg-panel-raised px-3 py-2 shadow-lg"
          style={{ left: Math.min(Math.max(x(active), 80), width - 80) }}
        >
          <p className="timecode text-sm font-semibold text-ink">{formatNumber(current.value)}</p>
          <p className="text-xs text-ink-dim">
            {unit} · {current.label}
          </p>
        </div>
      )}
    </div>
  );
}
