import {
  postsPerWeek,
  upcomingSlots,
  WEEK_ORDER,
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
} from "@radev/core";
import { getBrandBySlug, listScheduleSlots } from "@radev/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandTabs } from "@/components/brands/brand-tabs";
import { NewSlotForm } from "@/components/brands/new-slot-form";
import { Plate } from "@/components/console/plate";
import { db } from "@/lib/db";
import { cityOf, offsetOf } from "@/lib/time";
import { deleteSlotAction, pauseSlotAction, resumeSlotAction } from "./actions";

export const metadata: Metadata = { title: "Horarios · RAdev Social" };

/** Days the automatic filling looks ahead (docs/PROGRESS.md, phase 4: 7 days). */
const PREVIEW_DAYS = 7;

// When the brand publishes (docs/PRD.md RF-06): weekday and time in the brand's zone. The
// calendar and the automatic filling (phase 4, T3 and T4) put posts in these slots.
export default async function BrandSchedulePage({ params }: PageProps<"/brands/[slug]/schedule">) {
  const brand = await getBrandBySlug(db, (await params).slug);
  if (!brand) notFound();
  const slots = await listScheduleSlots(db, brand.id);
  const readOnly = brand.archivedAt !== null;
  const perWeek = postsPerWeek(slots);
  const next = upcomingSlots(slots, {
    from: new Date(),
    days: PREVIEW_DAYS,
    timeZone: brand.timezone,
  });

  return (
    <>
      <BrandTabs brand={brand} current="schedule" />
      <section aria-labelledby="schedule-heading" className="flex flex-col gap-6">
        <Plate as="h1" id="schedule-heading" aside={brand.name}>
          Horarios
        </Plate>
        <p className="max-w-3xl text-sm text-ink-dim">
          Cuándo publica {brand.name}, en su hora ({cityOf(brand.timezone)},{" "}
          <span className="timecode">{offsetOf(brand.timezone)}</span>).{" "}
          {perWeek === 0
            ? "Sin horarios activos no se programa nada."
            : `${perWeek} ${perWeek === 1 ? "post" : "posts"} por semana.`}{" "}
          Un horario pausado queda guardado pero no recibe posts.
        </p>

        {slots.length === 0 ? (
          <p className="text-sm text-ink">{brand.name} todavía no tiene horarios.</p>
        ) : (
          <ol className="grid max-w-5xl gap-px overflow-hidden rounded-md border border-bezel bg-bezel sm:grid-cols-7">
            {WEEK_ORDER.map((day) => {
              const daySlots = slots.filter((slot) => slot.weekday === day);
              return (
                <li key={day} className="flex flex-col gap-2 bg-panel p-3">
                  <h2 className="plate-text text-ink-faint">
                    <span className="sm:hidden">{WEEKDAY_LABELS[day]}</span>
                    <span className="hidden sm:inline">{WEEKDAY_SHORT[day]}</span>
                  </h2>
                  {daySlots.length === 0 && <p className="text-sm text-ink-faint">—</p>}
                  <ul className="flex flex-col gap-2">
                    {daySlots.map((slot) => (
                      <li
                        key={slot.id}
                        className="flex flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-start"
                      >
                        <span
                          className={`timecode text-base ${slot.active ? "text-ink" : "text-ink-faint line-through"}`}
                        >
                          {slot.localTime}
                          {!slot.active && <span className="sr-only"> (pausado)</span>}
                        </span>
                        {!readOnly && (
                          <form className="flex flex-wrap gap-1.5">
                            <input type="hidden" name="slug" value={brand.slug} />
                            <input type="hidden" name="slot" value={slot.id} />
                            <button
                              type="submit"
                              formAction={slot.active ? pauseSlotAction : resumeSlotAction}
                              className="console-button"
                            >
                              {slot.active ? "Pausar" : "Activar"}
                            </button>
                            <button
                              type="submit"
                              formAction={deleteSlotAction}
                              className="console-button"
                              aria-label={`Borrar ${WEEKDAY_LABELS[day]} ${slot.localTime}`}
                            >
                              Borrar
                            </button>
                          </form>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {!readOnly && (
        <section aria-labelledby="new-slot-heading" className="flex flex-col gap-6">
          <Plate id="new-slot-heading">Nuevo horario</Plate>
          <NewSlotForm brandSlug={brand.slug} />
        </section>
      )}

      <section aria-labelledby="next-slots-heading" className="flex flex-col gap-6">
        <Plate id="next-slots-heading">Próximos {PREVIEW_DAYS} días</Plate>
        {next.length === 0 ? (
          <p className="text-sm text-ink-faint">Nada para programar en estos días.</p>
        ) : (
          <ul className="flex max-w-3xl flex-col divide-y divide-bezel rounded-md border border-bezel">
            {next.map((occurrence) => (
              <li
                key={`${occurrence.slotId}:${occurrence.localDate}`}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="text-ink">
                  {WEEKDAY_LABELS[occurrence.weekday]}{" "}
                  <span className="timecode text-ink-dim">
                    {occurrence.localDate.slice(8, 10)}/{occurrence.localDate.slice(5, 7)}
                  </span>
                </span>
                <span className="timecode text-ink">{occurrence.localTime}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="max-w-3xl text-sm text-ink-faint">
          Todavía no se programan posts en estos horarios: llega con el calendario y el llenado
          automático.
        </p>
      </section>
    </>
  );
}
