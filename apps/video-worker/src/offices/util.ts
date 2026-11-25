import type { VideoDocumentKind } from "@radev/core";
import type { z } from "zod";
import { type OfficeContext, OfficeFailure } from "../office";

/** A document the office needs, parsed with its schema. Missing or malformed is a bug, not a retry. */
export async function readDocument<T>(
  ctx: OfficeContext,
  kind: VideoDocumentKind,
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await ctx.document(kind);
  if (raw === null) throw new OfficeFailure(`Falta el documento "${kind}" de este video.`, false);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new OfficeFailure(
      `El documento "${kind}" no cumple su formato: ${parsed.error.message}`,
      false,
    );
  }
  return parsed.data;
}
