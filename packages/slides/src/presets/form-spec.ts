import type { z } from "zod";
import { FONT_FAMILIES, fonts } from "../fonts/registry";
import { presets, type StylePreset } from "./registry";
import { GLOW_POSITIONS } from "./soft/tokens";

// The panel's identity form, described from a preset's token schema (docs/DESIGN-SYSTEM.md §2):
// every field reads its `.meta({ title, widget, ... })`, so a new token or preset shows up in the
// form without touching the panel. The result is plain data, safe to send to the browser.

export type TokenPath = string[];

export type TokenField = { path: TokenPath; title: string } & (
  | { widget: "color" }
  | { widget: "font"; families: { family: string; weights: number[] }[] }
  | { widget: "range"; min: number; max: number; step: number }
  | { widget: "text"; max: number }
  | { widget: "lines"; count: number; max: number }
  | { widget: "toggle" }
  | { widget: "asset"; role: "logo" | "hero" }
  | { widget: "glows"; max: number; positions: readonly string[] }
);

export type TokenGroup = { title: string; fields: TokenField[] };

type Meta = { title?: string; widget?: string; [key: string]: unknown };

const meta = (schema: z.ZodType): Meta => (schema.meta() ?? {}) as Meta;

/** Drops default/prefault/nullable/optional wrappers to reach the real schema. */
function unwrap(schema: z.ZodType): z.ZodType {
  let current = schema as z.ZodType & { _zod: { def: { type: string; innerType?: z.ZodType } } };
  while (["default", "prefault", "nullable", "optional"].includes(current._zod.def.type)) {
    const inner = current._zod.def.innerType;
    if (!inner) break;
    current = inner as typeof current;
  }
  return current;
}

/** Weights a family offers, in steps of 100 within its variable axis. */
const FONT_OPTIONS = FONT_FAMILIES.map((family) => {
  const { min, max } = fonts[family].weights;
  const weights: number[] = [];
  for (let w = Math.ceil(min / 100) * 100; w <= Math.min(max, 900); w += 100) weights.push(w);
  return { family, weights };
});

function field(path: TokenPath, schema: z.ZodType): TokenField | undefined {
  const m = meta(schema);
  const title = m.title ?? path.join(" › ");
  switch (m.widget) {
    case "color":
    case "toggle":
      return { path, title, widget: m.widget };
    case "font":
      return { path, title, widget: "font", families: FONT_OPTIONS };
    case "range":
      return {
        path,
        title,
        widget: "range",
        min: Number(m.min),
        max: Number(m.max),
        step: Number(m.step),
      };
    case "text":
      return { path, title, widget: "text", max: Number(m.max) };
    case "lines":
      return { path, title, widget: "lines", count: Number(m.count), max: Number(m.max) };
    case "asset":
      return { path, title, widget: "asset", role: m.role === "hero" ? "hero" : "logo" };
    case "glows":
      return { path, title, widget: "glows", max: Number(m.max), positions: GLOW_POSITIONS };
    default:
      return undefined;
  }
}

/**
 * Groups of fields for a preset: each top-level object is a group ("Colores", "Tipografías"…);
 * top-level fields with their own widget (assets, glows) go together in "Archivos y fondo".
 */
export function tokenFormSpec(preset: StylePreset): TokenGroup[] {
  const groups: TokenGroup[] = [];
  const loose: TokenField[] = [];
  const shape = presets[preset].tokens.shape as Record<string, z.ZodType>;

  for (const [key, schema] of Object.entries(shape)) {
    const own = field([key], schema);
    if (own) {
      loose.push(own);
      continue;
    }
    const inner = unwrap(schema) as z.ZodType & { shape?: Record<string, z.ZodType> };
    if (!inner.shape) continue;
    const fields = Object.entries(inner.shape)
      .map(([child, childSchema]) => field([key, child], childSchema))
      .filter((f): f is TokenField => f !== undefined);
    if (fields.length > 0) groups.push({ title: meta(schema).title ?? key, fields });
  }
  if (loose.length > 0) groups.push({ title: "Archivos y fondo", fields: loose });
  return groups;
}

/** Value at a token path. */
export function getTokenValue(tokens: unknown, path: TokenPath): unknown {
  return path.reduce<unknown>(
    (value, key) =>
      value !== null && typeof value === "object"
        ? (value as Record<string, unknown>)[key]
        : undefined,
    tokens,
  );
}

/** A copy of `tokens` with `value` at `path` (objects on the way are copied, never mutated). */
export function setTokenValue<T>(tokens: T, path: TokenPath, value: unknown): T {
  const [key, ...rest] = path;
  if (key === undefined) return value as T;
  const source = (tokens ?? {}) as Record<string, unknown>;
  return { ...source, [key]: setTokenValue(source[key], rest, value) } as T;
}
