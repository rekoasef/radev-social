"use client";

import { MAX_POST_SCREENSHOTS, SCREENSHOT_NOTE } from "@radev/core";
import { useEffect, useId, useRef } from "react";

// Screenshots for "Generar con IA" (ADR 0024): the operator picks up to four, writes what each one
// shows and sets their order. The form sends them as `screenshot` files with a `screenshotNote`
// each. Big files are shrunk here, so four phone screenshots fit in one request.

export type PickedScreenshot = { key: string; file: File; url: string; note: string };

/** Longest side kept: more than the slide and the AI need. */
const MAX_SIDE = 2000;
/** Files up to this size and size in pixels go as they are. */
const KEEP_BYTES = 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

/** The file as is when it is small, or a JPEG of at most MAX_SIDE pixels. */
async function shrink(file: File): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // The server says what is wrong with it.
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= KEEP_BYTES) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function ScreenshotPicker({
  value,
  onChange,
}: {
  value: PickedScreenshot[];
  onChange: (next: PickedScreenshot[]) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const left = MAX_POST_SCREENSHOTS - value.length;

  // The previews' object URLs go away with the component.
  const urls = useRef(value.map((shot) => shot.url));
  urls.current = value.map((shot) => shot.url);
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
    },
    [],
  );

  const add = async (files: FileList | null) => {
    const picked = [...(files ?? [])].filter((f) => TYPES.includes(f.type)).slice(0, left);
    const shots = await Promise.all(
      picked.map(async (original) => {
        const file = await shrink(original);
        return { key: crypto.randomUUID(), file, url: URL.createObjectURL(file), note: "" };
      }),
    );
    onChange([...value, ...shots]);
    if (input.current) input.current.value = "";
  };
  const update = (index: number, note: string) =>
    onChange(value.map((shot, i) => (i === index ? { ...shot, note } : shot)));
  const remove = (index: number) => {
    const shot = value[index];
    if (shot) URL.revokeObjectURL(shot.url);
    onChange(value.filter((_, i) => i !== index));
  };
  const move = (index: number, by: -1 | 1) => {
    const next = [...value];
    const [shot] = next.splice(index, 1);
    if (!shot) return;
    next.splice(index + by, 0, shot);
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="plate-text text-ink-faint">Capturas (opcional)</span>
        <span className="timecode text-xs text-ink-faint">
          {value.length}/{MAX_POST_SCREENSHOTS}
        </span>
      </div>
      <p className="text-sm text-ink-faint">
        Capturas de la app que la IA tiene que mostrar: las ve y las pone dentro de un celular o una
        notebook. Recortalas a la parte que importa, así se leen en la slide.
      </p>

      {value.length > 0 && (
        <ol className="flex flex-col gap-3">
          {value.map((shot, index) => {
            const noteLength = shot.note.trim().length;
            return (
              <li key={shot.key} className="flex gap-3 border border-bezel p-3 sm:items-center">
                {/* biome-ignore lint/performance/noImgElement: a local preview (object URL) */}
                <img
                  src={shot.url}
                  alt={`Captura ${index + 1}`}
                  className="h-24 w-16 shrink-0 rounded-sm object-cover object-top sm:h-20 sm:w-20"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <label className="flex flex-col gap-1">
                    <span className="flex items-baseline justify-between gap-2 text-xs text-ink-faint">
                      <span>Qué muestra</span>
                      <span
                        className={`timecode ${noteLength > SCREENSHOT_NOTE.max ? "text-tally-red" : ""}`}
                      >
                        {noteLength}/{SCREENSHOT_NOTE.max}
                      </span>
                    </span>
                    <input
                      type="text"
                      value={shot.note}
                      onChange={(event) => update(index, event.target.value)}
                      required
                      minLength={SCREENSHOT_NOTE.min}
                      maxLength={SCREENSHOT_NOTE.max}
                      lang="es"
                      placeholder="Ej.: cargar un gasto desde el celular"
                      className="console-field w-full text-sm"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label={`Subir la captura ${index + 1}`}
                      className="console-button text-xs"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === value.length - 1}
                      aria-label={`Bajar la captura ${index + 1}`}
                      className="console-button text-xs"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="console-button text-xs"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {left > 0 && (
        <div>
          <label htmlFor={inputId} className="console-button inline-flex cursor-pointer">
            {value.length === 0 ? "Agregar capturas" : "Agregar otra"}
          </label>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={TYPES.join(",")}
            multiple
            onChange={(event) => add(event.target.files)}
            className="sr-only"
          />
        </div>
      )}
    </div>
  );
}
