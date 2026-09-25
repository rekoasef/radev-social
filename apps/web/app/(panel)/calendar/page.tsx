import {
  addDays,
  buildWeek,
  isMovable,
  localDateOf,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  weekMonday,
  weekRange,
} from "@radev/core";
import { listCalendarPosts, listScheduleSlots, listUnplannedApproved } from "@radev/db";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarWeek, type WeekDay } from "@/components/calendar/calendar-week";
import { Plate } from "@/components/console/plate";
import { getBrandContext } from "@/lib/active-brand";
import { db } from "@/lib/db";
import { STATUS_DISPLAY } from "@/lib/post-status";
import { cityOf, offsetOf } from "@/lib/time";

export const metadata: Metadata = { title: "Calendario · RAdev Social" };

const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

// The active brand's week (docs/PRD.md RF-30): its slot times with the posts planned in each, the
// posts at other times and the approved ones still without a time. ?semana=YYYY-MM-DD picks the
// week (any day of it), in the brand's zone.
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const [{ activeBrand: brand }, query] = await Promise.all([getBrandContext(), searchParams]);
  if (!brand) {
    return (
      <section className="flex flex-col gap-6">
        <Plate as="h1">Calendario</Plate>
        <p className="text-sm text-ink-dim">No hay marcas activas.</p>
      </section>
    );
  }
  const now = new Date();
  const requested = typeof query.semana === "string" ? query.semana : undefined;
  const monday = weekMonday(requested, now, brand.timezone);
  const thisMonday = weekMonday(undefined, now, brand.timezone);
  const range = weekRange(monday, brand.timezone);
  const [slots, posts, tray] = await Promise.all([
    listScheduleSlots(db, brand.id),
    listCalendarPosts(db, { brandId: brand.id, ...range }),
    listUnplannedApproved(db, brand.id),
  ]);
  const week = buildWeek({ monday, timeZone: brand.timezone, slots, posts, now });
  const days: WeekDay[] = week.map((day) => ({
    localDate: day.localDate,
    label: WEEKDAY_LABELS[day.weekday],
    shortLabel: WEEKDAY_SHORT[day.weekday],
    dayNumber: dayMonth(day.localDate),
    isToday: day.isToday,
    entries: day.entries.map((entry) => ({
      key: `${entry.slotId ?? entry.post?.id}:${entry.at.toISOString()}`,
      at: entry.at.toISOString(),
      localTime: entry.localTime,
      slotId: entry.slotId,
      past: entry.past,
      post: entry.post && {
        code: entry.post.publicCode,
        hook: entry.post.hook ?? "Generándose…",
        status: STATUS_DISPLAY[entry.post.status],
        movable: isMovable(entry.post.status),
      },
    })),
  }));
  const sunday = addDays(monday, 6);
  const activeSlots = slots.filter((slot) => slot.active).length;

  return (
    <section aria-labelledby="calendar-heading" className="flex flex-col gap-6">
      <Plate as="h1" id="calendar-heading" aside={brand.name}>
        Calendario
      </Plate>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-dim">
          Semana del <span className="timecode text-ink">{dayMonth(monday)}</span> al{" "}
          <span className="timecode text-ink">{dayMonth(sunday)}</span> · hora de {brand.name} (
          {cityOf(brand.timezone)}, <span className="timecode">{offsetOf(brand.timezone)}</span>)
        </p>
        <nav aria-label="Semanas" className="flex gap-2">
          <Link href={`/calendar?semana=${addDays(monday, -7)}`} className="console-button">
            ← Anterior
          </Link>
          {monday !== thisMonday && (
            <Link href="/calendar" className="console-button">
              Hoy
            </Link>
          )}
          <Link href={`/calendar?semana=${addDays(monday, 7)}`} className="console-button">
            Siguiente →
          </Link>
        </nav>
      </div>
      {activeSlots === 0 && (
        <p className="text-sm text-ink">
          {brand.name} no tiene horarios activos: cargalos en{" "}
          <Link
            href={`/brands/${brand.slug}/schedule`}
            className="underline underline-offset-4 hover:text-ink-dim"
          >
            Marcas → Horarios
          </Link>
          .
        </p>
      )}
      <CalendarWeek
        // A new key per week so a half-made move never carries over.
        key={monday}
        days={days}
        tray={tray.map((post) => ({ code: post.publicCode, hook: post.hook ?? post.publicCode }))}
      />
      <p className="max-w-[70ch] text-xs text-ink-faint">
        Hoy es {dayMonth(localDateOf(now, brand.timezone))}. Un post aprobado o programado se
        (re)programa al moverlo; uno que todavía se está escribiendo o revisando queda planeado y se
        programa al aprobarlo.
      </p>
    </section>
  );
}
