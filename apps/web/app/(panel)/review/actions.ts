"use server";

import { addPostVersion, getBrandById, getPostByCode, getPostVersion } from "@radev/db";
import { applyTextEdits, carouselSchema } from "@radev/slides";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { applyPostEffects, artFor, queueVersion } from "@/lib/jobs";
import { requireOperator } from "@/lib/session";

export type QuickEditState =
  | { status: "idle" }
  | { status: "error"; message: string; fields?: Record<string, string> };

/** Text inputs are named "t:<path>" (packages/slides, slideTexts / postTexts). */
const TEXT_PREFIX = "t:";

const input = z.object({
  code: z.string().min(1).max(20),
  versionId: z.uuid(),
  hashtags: z.string().max(2_000),
  texts: z.record(z.string().max(200), z.string().max(5_000)),
});

/**
 * Quick edit from the review queue (phase 4, T7): new texts for the version on screen. It is a
 * manual version like the full editor's: validated with the carousel schema (CLAUDE.md, rule 4),
 * rendered again and back to review.
 */
export async function quickEditAction(_: QuickEditState, form: FormData): Promise<QuickEditState> {
  await requireOperator();
  const texts: Record<string, string> = {};
  for (const [name, value] of form) {
    if (name.startsWith(TEXT_PREFIX) && typeof value === "string")
      texts[name.slice(TEXT_PREFIX.length)] = value;
  }
  const parsed = input.safeParse({
    code: form.get("code"),
    versionId: form.get("versionId"),
    hashtags: form.get("hashtags") ?? "",
    texts,
  });
  if (!parsed.success) return { status: "error", message: "Datos inválidos." };
  const { code, versionId, hashtags } = parsed.data;

  const post = await getPostByCode(db, code);
  if (!post) return { status: "error", message: "Ese post ya no existe." };
  if (post.currentVersionId !== versionId)
    return {
      status: "error",
      message: "El post cambió mientras lo editabas: volvé a abrirlo para ver la versión nueva.",
    };
  const version = await getPostVersion(db, versionId);
  const current = carouselSchema.safeParse(version?.content);
  if (!version || !current.success)
    return { status: "error", message: "Esta versión no se puede editar acá: usá el editor." };

  const edited = applyTextEdits(current.data, { texts: parsed.data.texts, hashtags });
  if (!edited.ok) return { status: "error", message: edited.reason };
  if (!edited.changed) return { status: "error", message: "No cambiaste ningún texto." };

  const carousel = carouselSchema.safeParse(edited.content);
  if (!carousel.success) {
    const fields: Record<string, string> = {};
    for (const issue of carousel.error.issues) {
      // A slide-wide problem (too much emphasis) lands on the slide's first text.
      const path = issue.path.map(String).join(".");
      fields[path] ??= issue.message;
    }
    return { status: "error", message: "Hay textos para corregir.", fields };
  }

  const brand = await getBrandById(db, post.brandId);
  const result = await addPostVersion(db, {
    postId: post.id,
    content: carousel.data,
    origin: "manual",
    // Only texts changed: its charts keep the numbers they had, its images are reused.
    datasets: version.datasets,
    art: brand ? artFor(brand.stylePreset, carousel.data) : null,
  });
  if (!result.ok) return { status: "error", message: result.reason };
  await applyPostEffects(post.id, result.effects);
  await queueVersion(result.version);
  revalidatePath("/posts");
  revalidatePath("/review");
  redirect(`/review?listo=${encodeURIComponent(post.publicCode)}`);
}
