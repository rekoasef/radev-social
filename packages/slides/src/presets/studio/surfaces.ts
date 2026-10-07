import type { SlideType } from "../../content/slides";
import type { LookId } from "./look-ids";

// Which surface each slide of a look gets, without React: the looks use these, and so does the
// worker, which needs the background of a middle slide to ask for its image (ADR 0026).

/** Every slide is painted on one of these; the frame turns it into CSS variables. */
export type Surface = "ink" | "paper" | "accent";

export type SurfaceOf = (slide: { index: number; total: number; type: SlideType }) => Surface;

/**
 * A surface rhythm: the cover and the cta get fixed surfaces, the slides in between cycle
 * through `middle`. Data slides never land on `accent` (a chart reads better on ink or paper).
 */
export function rhythm(cover: Surface, middle: readonly Surface[], cta: Surface): SurfaceOf {
  const dataTypes: readonly SlideType[] = ["chart", "bigNumber", "costBreakdown", "comparison"];
  return ({ index, total, type }) => {
    if (index === 0) return cover;
    if (index === total - 1) return cta;
    const surface = middle[(index - 1) % middle.length] ?? "ink";
    if (surface === "accent" && dataTypes.includes(type))
      return middle.find((s) => s !== "accent") ?? "ink";
    return surface;
  };
}

/** The background a generated image needs on a surface: an accent one blends like paper. */
export const surfaceBackground = (surface: Surface): "dark" | "light" =>
  surface === "ink" ? "dark" : "light";

/** Surfaces of the looks that take generated images (LOOK_ART). */
export const ART_LOOK_SURFACES = {
  atmosfera: () => "ink",
  neon: () => "ink",
  gradiente: () => "paper",
  revista: rhythm("paper", ["paper", "ink", "paper", "paper"], "ink"),
  editorial: rhythm("paper", ["ink", "paper", "paper", "accent"], "ink"),
  monocromo: rhythm("ink", ["paper", "ink"], "paper"),
} as const satisfies Partial<Record<LookId, SurfaceOf>>;
