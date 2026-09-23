export type SelectableBrand = { slug: string; archivedAt: Date | null };

/**
 * The brand the panel works on: the one the operator picked, if it still exists and is not
 * archived; otherwise the first active brand. Undefined only when there are no active brands.
 */
export function pickActiveBrand<T extends SelectableBrand>(
  brands: readonly T[],
  preferredSlug: string | undefined,
): T | undefined {
  const active = brands.filter((brand) => brand.archivedAt === null);
  return active.find((brand) => brand.slug === preferredSlug) ?? active[0];
}
