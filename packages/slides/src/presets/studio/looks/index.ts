import { createRandom } from "../../../frame/random";
import type { Look } from "../kit";
import type { LookId } from "../look-ids";
import { atmosfera } from "./atmosfera";
import { bauhaus } from "./bauhaus";
import { bloques } from "./bloques";
import { brutalista } from "./brutalista";
import { chat } from "./chat";
import { documento } from "./documento";
import { editorial } from "./editorial";
import { gradiente } from "./gradiente";
import { monocromo } from "./monocromo";
import { neon } from "./neon";
import { plano } from "./plano";
import { recibo } from "./recibo";
import { recorte } from "./recorte";
import { revista } from "./revista";
import { suizo } from "./suizo";
import { terminal } from "./terminal";

export const LOOKS: Record<LookId, Look> = {
  editorial,
  bloques,
  atmosfera,
  plano,
  terminal,
  recorte,
  suizo,
  revista,
  neon,
  monocromo,
  bauhaus,
  recibo,
  chat,
  documento,
  gradiente,
  brutalista,
};

/**
 * The look of a post: the one it stores, when the brand still has it on; otherwise one of the
 * brand's looks picked by the post id, so an old post renders the same every time.
 */
export function resolveLook(
  stored: LookId | undefined,
  enabled: readonly LookId[],
  seed: string,
): LookId {
  if (stored && enabled.includes(stored)) return stored;
  if (stored && enabled.length === 0) return stored;
  return createRandom(`${seed}:look`).pick(enabled.length > 0 ? enabled : ["editorial"]);
}
