import type { Carousel } from "./carousel";
import { type FieldSpec, SLIDE_FIELDS, SLIDE_LABELS } from "./form";
import { limits as L } from "./limits";

// Quick edit (phase 4, T7): only the texts a carousel already has, from the phone. Structure,
// icons, data and layout stay as they are: those go through the full editor. Fields come from the
// editor's spec (form.ts), so labels and limits are the same; the result is validated again with
// the carousel schema before saving (CLAUDE.md, rule 4).

export type TextField = {
  /** Where the text lives, as "slides.2.cards.1.label". */
  path: string;
  label: string;
  max: number;
  emphasis: boolean;
  multiline: boolean;
  value: string;
};

export type SlideTexts = { index: number; label: string; fields: TextField[] };

function fieldsOf(
  specs: readonly FieldSpec[],
  value: Record<string, unknown>,
  path: string,
  prefix: string,
): TextField[] {
  return specs.flatMap((spec): TextField[] => {
    const at = `${path}.${spec.key}`;
    const current = value[spec.key];
    const label = prefix ? `${prefix} · ${spec.label}` : spec.label;
    switch (spec.kind) {
      case "text":
        // Optional texts the slide does not have stay out: adding one is a design change.
        return typeof current === "string"
          ? [
              {
                path: at,
                label,
                max: spec.max,
                emphasis: spec.emphasis,
                multiline: spec.multiline ?? false,
                value: current,
              },
            ]
          : [];
      case "object":
        return current !== null && typeof current === "object"
          ? fieldsOf(spec.fields, current as Record<string, unknown>, at, spec.label)
          : [];
      case "list": {
        if (!Array.isArray(current)) return [];
        const item = spec.item;
        return current.flatMap((entry, i): TextField[] => {
          const itemLabel = `${spec.itemLabel} ${i + 1}`;
          if (item === "rich")
            return typeof entry === "string"
              ? [
                  {
                    path: `${at}.${i}`,
                    label: prefix ? `${prefix} · ${itemLabel}` : itemLabel,
                    max: spec.itemMax ?? 0,
                    emphasis: true,
                    multiline: false,
                    value: entry,
                  },
                ]
              : [];
          return entry !== null && typeof entry === "object"
            ? fieldsOf(item, entry as Record<string, unknown>, `${at}.${i}`, itemLabel)
            : [];
        });
      }
      default:
        return [];
    }
  });
}

/** The texts of each slide, in order, with the editor's labels and limits. */
export function slideTexts(carousel: Carousel): SlideTexts[] {
  return carousel.slides.map((slide, index) => ({
    index,
    label: `Slide ${index + 1} · ${SLIDE_LABELS[slide.type]}`,
    fields: fieldsOf(
      SLIDE_FIELDS[slide.type],
      slide as unknown as Record<string, unknown>,
      `slides.${index}`,
      "",
    ),
  }));
}

/** The post's own texts: title and description (hashtags go apart, as a list). */
export function postTexts(carousel: Carousel): TextField[] {
  return [
    {
      path: "hook",
      label: "Título",
      max: L.carousel.hook,
      emphasis: false,
      multiline: false,
      value: carousel.hook,
    },
    {
      path: "caption",
      label: "Descripción",
      max: L.carousel.caption,
      emphasis: false,
      multiline: true,
      value: carousel.caption,
    },
  ];
}

/** "#uno dos, #tres" → ["uno", "dos", "tres"]: what the operator types, as the schema wants it. */
export function parseHashtags(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((tag) => tag.replace(/^#+/, ""))
    .filter((tag) => tag !== "");
}

export type TextEdits = { texts: Record<string, string>; hashtags?: string };

export type AppliedEdits =
  | { ok: true; content: unknown; changed: boolean }
  | { ok: false; reason: string };

/**
 * The carousel with the edited texts. Only paths that `slideTexts` / `postTexts` offer are
 * accepted: nothing else (type, icons, data) can change this way. The result is not validated.
 */
export function applyTextEdits(carousel: Carousel, edits: TextEdits): AppliedEdits {
  const allowed = new Map(
    [...postTexts(carousel), ...slideTexts(carousel).flatMap((slide) => slide.fields)].map(
      (field) => [field.path, field.value],
    ),
  );
  const content = structuredClone(carousel) as unknown as Record<string, unknown>;
  let changed = false;
  for (const [path, value] of Object.entries(edits.texts)) {
    const before = allowed.get(path);
    if (before === undefined) return { ok: false, reason: `No se puede editar "${path}".` };
    if (value === before) continue;
    const keys = path.split(".");
    const last = keys.pop() as string;
    let target: Record<string, unknown> = content;
    for (const key of keys) target = target[key] as Record<string, unknown>;
    target[last] = value;
    changed = true;
  }
  if (edits.hashtags !== undefined) {
    const hashtags = parseHashtags(edits.hashtags);
    if (hashtags.join(" ") !== carousel.hashtags.join(" ")) {
      content.hashtags = hashtags;
      changed = true;
    }
  }
  return { ok: true, content, changed };
}
