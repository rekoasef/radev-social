"use server";

import { LEAD_CHANNELS, LEAD_STATUSES } from "@radev/core";
import { deleteLead, getBrandBySlug, saveLead, setLeadStatus } from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireOperator } from "@/lib/session";

// Leads of a brand (phase 6 T5, RF-42): typed by the operator when someone writes.

export type LeadFormState =
  | { status: "idle" }
  | { status: "ok"; message: string; linked: boolean | null }
  | { status: "error"; message: string };

const leadInput = z.object({
  slug: z.string().min(1),
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  name: z.string().trim().max(120),
  contact: z.string().trim().max(120),
  channel: z.enum(LEAD_CHANNELS),
  postRef: z.string().trim().max(40),
  status: z.enum(LEAD_STATUSES),
  notes: z.string().trim().max(2000),
});

async function brandFor(slug: string) {
  await requireOperator();
  const brand = await getBrandBySlug(db, slug);
  if (!brand) throw new Error("La marca no existe.");
  return brand;
}

export async function saveLeadAction(_: LeadFormState, form: FormData): Promise<LeadFormState> {
  const parsed = leadInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "Revisá los datos." };
  const input = parsed.data;
  if (input.name === "" && input.contact === "") {
    return { status: "error", message: "Poné al menos el nombre o el contacto." };
  }
  const brand = await brandFor(input.slug);
  const saved = await saveLead(db, {
    brandId: brand.id,
    id: input.id,
    name: input.name,
    contact: input.contact,
    channel: input.channel,
    postRef: input.postRef || null,
    status: input.status,
    notes: input.notes,
  });
  revalidatePath("/metrics/leads");
  revalidatePath("/metrics");
  return {
    status: "ok",
    message: input.id ? "Lead guardado." : "Lead anotado.",
    linked: input.postRef ? saved.linked : null,
  };
}

const rowInput = z.object({ slug: z.string().min(1), id: z.uuid() });

export async function setLeadStatusAction(form: FormData): Promise<void> {
  const { slug, id, status } = rowInput
    .extend({ status: z.enum(LEAD_STATUSES) })
    .parse(Object.fromEntries(form));
  const brand = await brandFor(slug);
  await setLeadStatus(db, { brandId: brand.id, id, status });
  revalidatePath("/metrics/leads");
  revalidatePath("/metrics");
}

export async function deleteLeadAction(form: FormData): Promise<void> {
  const { slug, id } = rowInput.parse(Object.fromEntries(form));
  const brand = await brandFor(slug);
  await deleteLead(db, { brandId: brand.id, id });
  revalidatePath("/metrics/leads");
  revalidatePath("/metrics");
}
