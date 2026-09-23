import { FORMAT } from "../../frame/geometry";
import { createRandom } from "../../frame/random";

// Decorations of the `bold` preset (docs/DESIGN-SYSTEM.md §7), traced from
// docs/references/radev/: thin circuit lines ending in glowing points, dot grids and dotted
// rails. Positions vary slightly with the seed, deterministically. Decorations may enter the
// safe-zone margins; content may not.

const DOT_GRIDS = [
  { x: 975, y: 130, color: "accent" },
  { x: 930, y: 1105, color: "accent" },
  { x: 96, y: 905, color: "muted" },
  { x: 965, y: 880, color: "accent" },
] as const;

function DotGrid({ x, y, color }: { x: number; y: number; color: "accent" | "muted" }) {
  const dots = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      dots.push(<circle key={`${row}-${col}`} cx={x + col * 22} cy={y + row * 22} r={1.7} />);
    }
  }
  return (
    <g fill={`var(--${color})`} opacity={0.75}>
      {dots}
    </g>
  );
}

function GlowPoint({ x, y, filter }: { x: number; y: number; filter: string }) {
  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={9}
        fill="var(--accent)"
        filter={`url(#${filter})`}
        style={{ opacity: "var(--glow)" }}
      />
      <circle cx={x} cy={y} r={4.5} fill="var(--accent)" />
    </g>
  );
}

export function BoldDecorations({ seed, id }: { seed: string; id: string }) {
  const random = createRandom(seed);
  const blur = `${id}-blur`;
  const { width: W } = FORMAT;

  // Left dotted rail next to the title.
  const railEnd = random.int(400, 470);
  // Left edge bracket with its glowing point.
  const bracketTop = random.int(440, 500);
  const bracketBottom = bracketTop + random.int(500, 560);
  const pointY = random.int(bracketTop + 110, bracketTop + 190);
  // Right circuit line.
  const stepY = random.int(230, 300);
  const dropEnd = random.int(680, 760);
  const [gridA, gridB] = [DOT_GRIDS[0], random.pick(DOT_GRIDS.slice(1))];
  const lowerRail = random.chance(0.6);

  return (
    <svg
      aria-hidden="true"
      width={W}
      height={FORMAT.height}
      viewBox={`0 0 ${W} ${FORMAT.height}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <defs>
        <filter id={blur} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
      </defs>

      <g fill="none" stroke="var(--accent)" strokeWidth={1.6} strokeLinecap="round">
        <line x1={74} y1={112} x2={74} y2={railEnd} strokeDasharray="1 7" opacity={0.7} />
        <line x1={871} y1={112} x2={871} y2={200} strokeDasharray="1 7" opacity={0.55} />
        {lowerRail && (
          <line x1={1032} y1={975} x2={1032} y2={1175} strokeDasharray="1 7" opacity={0.55} />
        )}

        <path
          d={`M 0 ${bracketTop} q 36 0 36 38 V ${bracketBottom - 38} q 0 38 -36 38`}
          opacity={0.55}
        />
        <line x1={0} y1={pointY} x2={36} y2={pointY} opacity={0.8} />

        <path
          d={`M 914 112 V ${stepY - 40} q 0 40 40 40 H 1019 q 40 0 40 40 V ${dropEnd - 40} q 0 40 21 52`}
          opacity={0.55}
        />
      </g>

      <GlowPoint x={36} y={pointY} filter={blur} />
      <DotGrid {...gridA} />
      <DotGrid {...gridB} />
    </svg>
  );
}
