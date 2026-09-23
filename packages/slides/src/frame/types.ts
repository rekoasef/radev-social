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
};
