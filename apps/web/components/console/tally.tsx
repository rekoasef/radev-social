import { cn } from "@/lib/utils";

export type TallyState = "live" | "cued" | "ready" | "timed" | "standby" | "off" | "fail";

const tallies: Record<
  TallyState,
  { tone: string; shape: "dot" | "triangle" | "square" | "diamond" | "ring" | "dash" | "cross" }
> = {
  live: { tone: "text-tally-red", shape: "dot" },
  cued: { tone: "text-tally-amber", shape: "triangle" },
  ready: { tone: "text-tally-green", shape: "square" },
  // Waiting for its time (scheduled): not confused with done.
  timed: { tone: "text-tally-blue", shape: "diamond" },
  standby: { tone: "text-ink-dim", shape: "ring" },
  off: { tone: "text-ink-faint", shape: "dash" },
  fail: { tone: "text-tally-red", shape: "cross" },
};

function Lamp({ shape }: { shape: (typeof tallies)[TallyState]["shape"] }) {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5 shrink-0" aria-hidden="true">
      {shape === "dot" && <circle cx="5" cy="5" r="4" fill="currentColor" />}
      {shape === "triangle" && <path d="M5 1 9.2 8.8H.8Z" fill="currentColor" />}
      {shape === "square" && <rect x="1.2" y="1.2" width="7.6" height="7.6" fill="currentColor" />}
      {shape === "diamond" && <path d="M5 .6 9.4 5 5 9.4.6 5Z" fill="currentColor" />}
      {shape === "ring" && (
        <circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
      {shape === "dash" && <rect x="1" y="4.2" width="8" height="1.6" fill="currentColor" />}
      {shape === "cross" && (
        <path
          d="M1.6 1.6 8.4 8.4M8.4 1.6 1.6 8.4"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/** Status lamp: state is carried by shape and text, never by color alone. */
export function Tally({
  state,
  children,
  className,
}: {
  state: TallyState;
  children: React.ReactNode;
  className?: string;
}) {
  const { tone, shape } = tallies[state];
  return (
    <span className={cn("plate-text inline-flex items-center gap-2", tone, className)}>
      <span className={cn(state === "live" && "tally-glow")}>
        <Lamp shape={shape} />
      </span>
      <span>{children}</span>
    </span>
  );
}
