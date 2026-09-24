/** A brand file the slide can show, resolved by the render page from `brand_assets`. */
export type SlideAsset = { url: string; width: number | null; height: number | null };

/** Brand files by `brand_assets` id: tokens hold ids, templates need URLs. */
export type SlideAssets = Readonly<Record<string, SlideAsset>>;

/** The file a token points to, or undefined when unset or missing (the slide goes without it). */
export function resolveAsset(assets: SlideAssets, id: string | null): SlideAsset | undefined {
  return id ? assets[id] : undefined;
}

export type FrameProps<Tokens> = {
  tokens: Tokens;
  /** Shown when the preset's wordmark tokens are empty. */
  brandName: string;
  /** Zero-based position in the carousel. The cover (index 0) shows "Deslizá →". */
  page: { index: number; total: number };
  /** Seed for deterministic decorations: the post id. */
  seed: string;
  /** Radial glow behind the content (cover and cta). */
  glow?: boolean;
  /** Brand files (logo, hero). */
  assets?: SlideAssets;
};
