"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { movePostAction } from "@/app/(panel)/calendar/actions";
import { Tally, type TallyState } from "@/components/console/tally";
import { cn } from "@/lib/utils";

// The week of a brand (phase 4, T3). A post moves onto a free slot time by dragging it (mouse) or
// by picking it and then the time (touch and keyboard: native drag and drop does not work with a
// finger). The server checks everything again.

export type WeekPost = {
  code: string;
  hook: string;
  status: { label: string; tally: TallyState };
  movable: boolean;
};

export type WeekEntry = {
  key: string;
  at: string;
  localTime: string;
  slotId: string | null;
  past: boolean;
  post: WeekPost | null;
};

export type WeekDay = {
  localDate: string;
  label: string;
  shortLabel: string;
  dayNumber: string;
  isToday: boolean;
  entries: WeekEntry[];
};

type Target = { slotId: string; at: string };

const DRAG_TYPE = "application/x-radev-post";

export function CalendarWeek({
  days,
  tray,
}: {
  days: WeekDay[];
  /** Approved posts without a planned time. */
  tray: { code: string; hook: string }[];
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const moving = picked ?? dragging;
  const todayIndex = days.findIndex((day) => day.isToday);

  function move(code: string, target: Target) {
    setPicked(null);
    setDragging(null);
    setOver(null);
    startTransition(async () => {
      const result = await movePostAction({ code, ...target });
      setMessage({ ok: result.ok, text: result.message });
    });
  }

  const dropProps = (entry: WeekEntry) => {
    const target = entry.slotId && !entry.past && !entry.post ? entry.slotId : null;
    if (!target) return {};
    return {
      onDragOver: (event: React.DragEvent) => {
        if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(entry.key);
      },
      onDragLeave: () => setOver((key) => (key === entry.key ? null : key)),
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const code = event.dataTransfer.getData(DRAG_TYPE);
        if (code) move(code, { slotId: target, at: entry.at });
      },
    };
  };

  const card = (post: { code: string; hook: string }, extra?: React.ReactNode, movable = true) => (
    // biome-ignore lint/a11y/noStaticElementInteractions: dragging is a mouse shortcut; the "Mover" button does the same with keyboard and touch.
    <div
      draggable={movable && !pending}
      onDragStart={(event) => {
        event.dataTransfer.setData(DRAG_TYPE, post.code);
        event.dataTransfer.effectAllowed = "move";
        setDragging(post.code);
      }}
      onDragEnd={() => {
        setDragging(null);
        setOver(null);
      }}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border border-bezel bg-panel-raised p-2.5",
        movable && "cursor-grab active:cursor-grabbing",
        (picked === post.code || dragging === post.code) && "border-ink-dim",
      )}
    >
      <Link
        href={`/posts/${post.code}`}
        className="timecode text-xs text-ink-faint hover:text-ink"
        draggable={false}
      >
        {post.code}
      </Link>
      <p className="line-clamp-3 text-sm text-ink">{post.hook}</p>
      {extra}
      {movable && (
        <button
          type="button"
          className="console-button self-start"
          aria-pressed={picked === post.code}
          disabled={pending}
          onClick={() => setPicked((code) => (code === post.code ? null : post.code))}
        >
          {picked === post.code ? "Cancelar" : "Mover"}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <p aria-live="polite" className="min-h-5 text-sm">
        {pending ? (
          <span className="text-ink-dim">Moviendo…</span>
        ) : picked ? (
          <span className="text-ink">Elegí un horario libre para {picked}.</span>
        ) : message ? (
          <span className={message.ok ? "text-ink-dim" : "text-tally-red"}>{message.text}</span>
        ) : null}
      </p>

      <ol className="grid gap-px overflow-hidden rounded-md border border-bezel bg-bezel lg:grid-cols-7">
        {days.map((day, index) => (
          <li
            key={day.localDate}
            className={cn(
              "flex min-w-0 flex-col gap-2 bg-panel p-3",
              day.isToday && "bg-panel-raised",
              // On a phone, this week starts today: the days gone by only push it down.
              index < todayIndex && "max-lg:hidden",
            )}
            aria-label={`${day.label} ${day.dayNumber}${day.isToday ? " (hoy)" : ""}`}
          >
            <h2 className="flex items-baseline justify-between gap-2">
              <span className="plate-text text-ink-faint">
                <span className="lg:hidden">{day.label}</span>
                <span className="hidden lg:inline">{day.shortLabel}</span>
              </span>
              <span className={cn("timecode text-sm", day.isToday ? "text-ink" : "text-ink-dim")}>
                {day.dayNumber}
              </span>
            </h2>
            {day.entries.length === 0 && <p className="text-sm text-ink-faint">—</p>}
            <ul className="flex flex-col gap-2">
              {day.entries.map((entry) => {
                const free = entry.slotId !== null && !entry.past && !entry.post;
                return (
                  <li key={entry.key} className="flex flex-col gap-1.5" {...dropProps(entry)}>
                    <span
                      className={cn(
                        "timecode text-xs",
                        entry.past ? "text-ink-faint" : "text-ink-dim",
                      )}
                    >
                      {entry.localTime}
                      {entry.slotId === null && " · a mano"}
                    </span>
                    {entry.post ? (
                      card(
                        entry.post,
                        <Tally state={entry.post.status.tally}>{entry.post.status.label}</Tally>,
                        entry.post.movable && !entry.past,
                      )
                    ) : free ? (
                      <button
                        type="button"
                        disabled={!moving || pending}
                        onClick={() =>
                          picked &&
                          entry.slotId &&
                          move(picked, { slotId: entry.slotId, at: entry.at })
                        }
                        className={cn(
                          "min-h-11 rounded-md border border-dashed border-bezel px-2.5 text-left text-sm text-ink-faint",
                          moving && "border-ink-dim text-ink",
                          over === entry.key && "border-solid border-ink bg-panel-raised",
                        )}
                      >
                        {moving ? "Mover acá" : "Libre"}
                      </button>
                    ) : (
                      <span className="text-sm text-ink-faint">Sin post</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>

      <section aria-labelledby="tray-heading" className="flex flex-col gap-3">
        <h2 id="tray-heading" className="text-sm text-ink">
          Aprobados sin programar{" "}
          <span className="text-ink-faint">
            ({tray.length}){tray.length > 0 && " · arrastralos a un horario libre"}
          </span>
        </h2>
        {tray.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {tray.map((post) => (
              <li key={post.code}>{card(post)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
