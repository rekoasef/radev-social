"use server";

import { LINK_TITLE_MAX, LINKS_PER_BRAND } from "@radev/core";
import {
  deleteBrandLink,
  getBrandBySlug,
  listBrandLinks,
  moveBrandLink,
  saveBrandLink,
} from "@radev/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeLinkUrl } from "@/lib/links";
import { requireOperator } from "@/lib/session";

// The links of a brand's public page (phase 6 T5).

export type LinkFormState =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; field: "title" | "url" | "form"; message: string };

const linkInput = z.object({
  slug: z.string().min(1),
  id: z
    .uuid()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  title: z.string().trim(),
  url: z.string(),
  primary: z.literal("on").optional(),
  active: z.literal("on").optional(),
});

async function editableBrand(slug: string) {
  await requireOperator();
  const brand = await getBrandBySlug(db, slug);
  if (!brand || brand.archivedAt) throw new Error("La marca no existe o está archivada.");
  return brand;
}

export async function saveLinkAction(_: LinkFormState, form: FormData): Promise<LinkFormState> {
  const parsed = linkInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", field: "form", message: "Datos inválidos." };
  const input = parsed.data;
  const brand = await editableBrand(input.slug);
  if (input.title === "") return { status: "error", field: "title", message: "Poné un título." };
  if (input.title.length > LINK_TITLE_MAX) {
    return { status: "error", field: "title", message: `Máximo ${LINK_TITLE_MAX} caracteres.` };
  }
  const url = normalizeLinkUrl(input.url);
  if (!url.ok) return { status: "error", field: "url", message: url.reason };
  if (!input.id && (await listBrandLinks(db, brand.id)).length >= LINKS_PER_BRAND) {
    return {
      status: "error",
      field: "form",
      message: `Hasta ${LINKS_PER_BRAND} links: la página es para elegir rápido.`,
    };
  }
  await saveBrandLink(db, {
    brandId: brand.id,
    id: input.id,
    title: input.title,
    url: url.url,
    primary: input.primary === "on",
    // A new link starts visible; an edit keeps what the checkbox says.
    active: input.id ? input.active === "on" : true,
  });
  revalidatePath(`/brands/${brand.slug}/links`);
  return { status: "ok", message: input.id ? "Link guardado." : "Link agregado." };
}

const rowInput = z.object({ slug: z.string().min(1), id: z.uuid() });

export async function deleteLinkAction(form: FormData): Promise<void> {
  const { slug, id } = rowInput.parse(Object.fromEntries(form));
  const brand = await editableBrand(slug);
  await deleteBrandLink(db, { brandId: brand.id, id });
  revalidatePath(`/brands/${brand.slug}/links`);
}

export async function moveLinkAction(form: FormData): Promise<void> {
  const { slug, id, direction } = rowInput
    .extend({ direction: z.enum(["up", "down"]) })
    .parse(Object.fromEntries(form));
  const brand = await editableBrand(slug);
  await moveBrandLink(db, { brandId: brand.id, id, direction });
  revalidatePath(`/brands/${brand.slug}/links`);
}
