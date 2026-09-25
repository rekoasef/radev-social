import { normalizeLocalTime, type Slot, type Weekday } from "@radev/core";
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { scheduleSlots } from "../schema";
import type { Executor } from "./brand-assets";

// Publishing slots of a brand (docs/PRD.md RF-06). The rules (weekdays, local times, turning them
// into UTC instants) live in packages/core (scheduling/slots.ts).

/** A brand's slots, by weekday and time, with the local time as "HH:MM". */
export async function listScheduleSlots(db: Executor, brandId: string): Promise<Slot[]> {
  const rows = await db
    .select()
    .from(scheduleSlots)
    .where(eq(scheduleSlots.brandId, brandId))
    .orderBy(asc(scheduleSlots.weekday), asc(scheduleSlots.localTime));
  return rows.map((row) => ({
    id: row.id,
    weekday: row.weekday,
    localTime: normalizeLocalTime(row.localTime) ?? row.localTime,
    active: row.active,
  }));
}

/**
 * Adds a time on some weekdays. The ones the brand already has at that time are left as they are
 * (running it twice adds nothing). Returns how many were added.
 */
export async function addScheduleSlots(
  db: Database,
  input: { brandId: string; weekdays: readonly Weekday[]; localTime: string },
): Promise<number> {
  const localTime = normalizeLocalTime(input.localTime);
  if (!localTime) throw new Error(`Hora inválida: ${input.localTime}`);
  if (input.weekdays.length === 0) return 0;
  const added = await db
    .insert(scheduleSlots)
    .values(
      [...new Set(input.weekdays)].map((weekday) => ({
        brandId: input.brandId,
        weekday,
        localTime,
      })),
    )
    .onConflictDoNothing({
      target: [scheduleSlots.brandId, scheduleSlots.weekday, scheduleSlots.localTime],
    })
    .returning({ id: scheduleSlots.id });
  return added.length;
}

/** Pauses or resumes a slot of the brand. */
export async function setScheduleSlotActive(
  db: Database,
  input: { brandId: string; slotId: string; active: boolean },
): Promise<void> {
  await db
    .update(scheduleSlots)
    .set({ active: input.active })
    .where(and(eq(scheduleSlots.id, input.slotId), eq(scheduleSlots.brandId, input.brandId)));
}

export async function deleteScheduleSlot(
  db: Database,
  input: { brandId: string; slotId: string },
): Promise<void> {
  await db
    .delete(scheduleSlots)
    .where(and(eq(scheduleSlots.id, input.slotId), eq(scheduleSlots.brandId, input.brandId)));
}
