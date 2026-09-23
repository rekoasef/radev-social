import { EXCLUSION_ZONES, FORMAT, SAFE_AREA } from "./geometry";

/** Preview aid: shades what content must not touch (margins and TikTok's button column). */
export function SafeZoneOverlay() {
  const { width: W, height: H } = FORMAT;
  const s = SAFE_AREA;
  const outside = `M0 0H${W}V${H}H0Z M${s.x} ${s.y}V${s.y + s.height}H${s.x + s.width}V${s.y}Z`;
  return (
    <svg
      aria-hidden="true"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <path d={outside} fill="rgba(255,0,80,0.22)" fillRule="evenodd" />
      <rect
        x={s.x}
        y={s.y}
        width={s.width}
        height={s.height}
        fill="none"
        stroke="rgba(255,0,80,0.9)"
        strokeDasharray="8 6"
        strokeWidth={2}
      />
      {EXCLUSION_ZONES.map((zone) => (
        <rect
          key={`${zone.x}-${zone.y}`}
          {...zone}
          fill="rgba(255,0,80,0.35)"
          stroke="rgba(255,0,80,0.9)"
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
