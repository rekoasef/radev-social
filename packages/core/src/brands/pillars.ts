// Content pillars of a brand with their target share (docs/PRD.md RF-05). The panel edits whole
// percentages; the database keeps a share from 0 to 1. The active pillars always add up to 100 %:
// a new pillar starts at 0 % and a pillar is archived or deleted only once it is down to 0 %.

import type { RuleCheck } from "./brand-rules";

export const PILLAR_NAME_MAX = 60;
export const PILLAR_DESCRIPTION_MAX = 400;

/** Whole percentage (0–100) of a stored share. */
export function shareToPercent(share: number): number {
  return Math.round(share * 100);
}

export function percentToShare(percent: number): number {
  return percent / 100;
}

/** The mix of the active pillars: whole percentages from 0 to 100 that add up to exactly 100. */
export function checkPillarMix(percents: readonly number[]): RuleCheck {
  if (percents.length === 0) return { ok: false, reason: "La marca necesita al menos un pilar." };
  if (percents.some((p) => !Number.isInteger(p) || p < 0 || p > 100)) {
    return { ok: false, reason: "Cada porcentaje es un número entero de 0 a 100." };
  }
  const total = percents.reduce((sum, p) => sum + p, 0);
  return total === 100
    ? { ok: true }
    : { ok: false, reason: `Los pilares activos suman ${total} %: tienen que sumar 100 %.` };
}

/**
 * Taking a pillar out of the mix (archive or delete) keeps the other pillars at 100 %: its share
 * has to go to the others first.
 */
export function canRemovePillar(share: number): RuleCheck {
  return shareToPercent(share) === 0
    ? { ok: true }
    : { ok: false, reason: "Bajalo a 0 % y repartí su porcentaje entre los otros pilares." };
}

/** A pillar with posts is archived, never deleted, so its posts keep their pillar. */
export function canDeletePillar(postCount: number): RuleCheck {
  return postCount === 0
    ? { ok: true }
    : { ok: false, reason: "El pilar tiene posts: archivalo en lugar de borrarlo." };
}
