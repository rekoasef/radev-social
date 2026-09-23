"use client";

import { useEffect, useState } from "react";

function format(date: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Station clock: operator's local time and UTC, the two references of the schedule. */
export function ConsoleClock() {
  const [now, setNow] = useState<Date | null>(null);
  const [zone, setZone] = useState<string>("");

  useEffect(() => {
    setZone(
      (Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").at(-1) ?? "Local").replaceAll(
        "_",
        " ",
      ),
    );
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const placeholder = "--:--:--";

  return (
    <div className="flex items-baseline gap-5">
      <div className="flex flex-col items-end">
        <span
          className="timecode text-xl leading-none text-ink sm:text-2xl"
          suppressHydrationWarning
        >
          {now ? format(now) : placeholder}
        </span>
        <span className="plate-text mt-1.5 text-ink-faint">{zone || "Local"}</span>
      </div>
      <div className="hidden flex-col items-end sm:flex">
        <span
          className="timecode text-xl leading-none text-ink-dim sm:text-2xl"
          suppressHydrationWarning
        >
          {now ? format(now, "UTC") : placeholder}
        </span>
        <span className="plate-text mt-1.5 text-ink-faint">UTC</span>
      </div>
    </div>
  );
}
