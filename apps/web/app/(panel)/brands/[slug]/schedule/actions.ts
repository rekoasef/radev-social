"use server";

import { isWeekday, normalizeLocalTime, type Weekday } from "@radev/core";
import {
  addScheduleSlots,
  deleteScheduleSlot,
  getBrandBySlug,
  setScheduleSlotActive,
} from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

// Publishing slots of a brand (docs/PRD.md RF-06): Marcas → Horarios.

export type SlotFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const slug = z.string().trim().min(1).max(64);

async function activeBrand(brandSlug: string) {
  const brand = await getBrandBySlug(db, brandSlug);
  return brand && brand.archivedAt === null ? brand : undefined;
}

const schedulePath = (brandSlug: string) => `/brands/${brandSlug}/schedule`;

const addInput = z.object({
  slug,
  localTime: z.string().transform((value, ctx) => {
    const time = normalizeLocalTime(value);
    if (!time) ctx.addIssue({ code: "custom", message: "Poné una hora válida (ej. 19:00)." });
    return time ?? "";
  }),
  weekdays: z
    .array(z.coerce.number().refine(isWeekday))
    .min(1, { error: "Elegí al menos un día." })
    .max(7),
});

/** A time on some weekdays; the days that already have it stay as they are. */
export async function addSlotsAction(_: SlotFormState, form: FormData): Promise<SlotFormState> {
  await requireOperator();
  const parsed = addInput.safeParse({
    slug: form.get("slug"),
    localTime: form.get("localTime"),
    weekdays: form.getAll("weekdays"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const brand = await activeBrand(parsed.data.slug);
  if (!brand) return { status: "error", message: "Esa marca no existe o está archivada." };
  const added = await addScheduleSlots(db, {
    brandId: brand.id,
    weekdays: parsed.data.weekdays as Weekday[],
    localTime: parsed.data.localTime,
  });
  revalidatePath(schedulePath(brand.slug));
  const days = parsed.data.weekdays.length;
  return {
    status: "ok",
    message:
      added === 0
        ? `Esos días ya tenían las ${parsed.data.localTime}.`
        : `${added === 1 ? "Agregado 1 horario" : `Agregados ${added} horarios`}${added < days ? " (los otros días ya lo tenían)" : ""}.`,
  };
}

const slotInput = z.object({ slug, slot: z.uuid() });

export async function pauseSlotAction(form: FormData): Promise<void> {
  await toggle(form, false);
}

export async function resumeSlotAction(form: FormData): Promise<void> {
  await toggle(form, true);
}

async function toggle(form: FormData, active: boolean) {
  await requireOperator();
  const input = slotInput.parse(Object.fromEntries(form));
  const brand = await activeBrand(input.slug);
  if (!brand) return;
  await setScheduleSlotActive(db, { brandId: brand.id, slotId: input.slot, active });
  revalidatePath(schedulePath(brand.slug));
}

export async function deleteSlotAction(form: FormData): Promise<void> {
  await requireOperator();
  const input = slotInput.parse(Object.fromEntries(form));
  const brand = await activeBrand(input.slug);
  if (!brand) return;
  await deleteScheduleSlot(db, { brandId: brand.id, slotId: input.slot });
  revalidatePath(schedulePath(brand.slug));
}
