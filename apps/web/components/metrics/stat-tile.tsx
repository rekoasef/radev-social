import { cn } from "@/lib/utils";

// A figure of the page (dataviz: label, value, optional signed delta against a named period).
// Up is good for every number here, so a rise reads green and a fall red.

export function StatTile({
  label,
  value,
  delta,
  hint,
  hero = false,
}: {
  label: string;
  value: string;
  delta?: { text: string; direction: "up" | "down" | "flat"; against: string } | null;
  hint?: string;
  hero?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border border-bezel bg-panel px-4 py-4",
        hero && "col-span-2 sm:row-span-2 sm:justify-between sm:px-6 sm:py-6",
      )}
    >
      <p className="plate-text text-ink-dim">{label}</p>
      <p
        className={cn(
          "font-semibold tracking-[-0.02em] text-ink",
          hero ? "text-5xl sm:text-6xl" : "text-3xl",
        )}
      >
        {value}
      </p>
      {(delta || hint) && (
        <p className="text-xs text-ink-faint">
          {delta && (
            <span
              className={cn(
                "timecode mr-1.5 font-medium",
                delta.direction === "up" && "text-tally-green",
                delta.direction === "down" && "text-tally-red",
                delta.direction === "flat" && "text-ink-dim",
              )}
            >
              {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "■"} {delta.text}
            </span>
          )}
          {delta ? delta.against : hint}
        </p>
      )}
    </div>
  );
}
