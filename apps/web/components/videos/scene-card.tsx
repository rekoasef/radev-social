"use client";

import { Replace } from "lucide-react";
import { useActionState, useEffect, useId, useState } from "react";
import { type DeskState, editSceneAction } from "@/app/(panel)/videos/desk-actions";
import { Tally, type TallyState } from "@/components/console/tally";
import type { FactView, Piece, SceneView } from "@/lib/video-script";
import { DeskErrors } from "./desk-errors";

const idle: DeskState = { status: "idle" };

export const FACT_DISPLAY: Record<
  NonNullable<FactView["result"]>,
  { tally: TallyState; label: string }
> = {
  textual: { tally: "ready", label: "en su página" },
  casi: { tally: "cued", label: "casi igual" },
  "no-esta": { tally: "standby", label: "no está en la página" },
  "sin-pagina": { tally: "off", label: "sin página" },
};

const license = (name: string) => (/public domain|^pd\b/i.test(name) ? "DP" : name);

const pieces = (list: Piece[], Mark: "del" | "ins") =>
  list.map((piece, i) => (
    // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list of words, never reordered
    <span key={i}>
      {i > 0 && " "}
      {piece.changed ? <Mark>{piece.text}</Mark> : piece.text}
    </span>
  ));

/** One scene on the script desk: its image, its text (editable) and what to look at. */
export function SceneCard({
  videoId,
  version,
  scene,
  onSwap,
}: {
  videoId: string;
  version: number;
  scene: SceneView;
  onSwap: () => void;
}) {
  const [state, action, pending] = useActionState(editSceneAction, idle);
  const [editing, setEditing] = useState(false);
  const ids = { narration: useId(), caption: useId() };
  const [format, setFormat] = useState<"short" | "normal">("short");
  const frame = scene.frames?.[format] ?? null;

  useEffect(() => {
    if (state.status === "done") setEditing(false);
  }, [state]);

  return (
    <article className="scene" aria-label={`Escena ${scene.n}`}>
      <p className="timecode flex gap-3 text-[11px] text-ink-faint sm:flex-col sm:gap-1">
        <b className="text-[15px] font-semibold text-ink">{String(scene.n).padStart(2, "0")}</b>
        <span>{scene.start}</span>
        <span>{scene.seconds.toFixed(1).replace(".", ",")} s</span>
      </p>

      <div className="min-w-0">
        {(scene.frames?.short || scene.frames?.normal) && (
          <fieldset className="frame-switch">
            <legend className="sr-only">Formato del cuadro</legend>
            {(["short", "normal"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={format === f}
                onClick={() => setFormat(f)}
              >
                {f === "short" ? "Short" : "Normal"}
              </button>
            ))}
          </fieldset>
        )}
        <div className="relative">
          {frame ? (
            // biome-ignore lint/performance/noImgElement: a frame of the video, already small
            <img
              src={frame}
              alt={`Cuadro de la escena ${scene.n}, ${format === "short" ? "Short" : "video normal"}`}
              loading="lazy"
              className={format === "short" ? "video-frame-short" : "video-thumb"}
            />
          ) : scene.image ? (
            // biome-ignore lint/performance/noImgElement: a file of the video, already small
            <img src={scene.image.src} alt="" loading="lazy" className="video-thumb" />
          ) : (
            <div className="video-thumb" />
          )}
          {scene.image && !frame && (
            <span className="thumb-license">{license(scene.image.license)}</span>
          )}
          <button type="button" className="thumb-swap" onClick={onSwap}>
            <Replace className="size-3" aria-hidden="true" />
            Cambiar
          </button>
        </div>
        <p className="mt-1.5 truncate text-xs text-ink-faint">
          {scene.image ? `${scene.image.id} · ${scene.image.title}` : "Sin imagen"}
        </p>
        {!frame && scene.image && (
          <p className="text-xs text-tally-amber">
            Foto entera: el cuadro todavía no está dibujado.
          </p>
        )}
      </div>

      <div className="min-w-0">
        {editing ? (
          <form action={action} className="flex flex-col gap-3">
            <input type="hidden" name="videoId" value={videoId} />
            <input type="hidden" name="version" value={version} />
            <input type="hidden" name="scene" value={scene.n} />
            <label htmlFor={ids.narration} className="sr-only">
              Narración de la escena {scene.n}
            </label>
            <textarea
              id={ids.narration}
              name="narration"
              rows={4}
              lang="es"
              defaultValue={scene.narration}
              className="console-field w-full text-base leading-relaxed"
            />
            <label htmlFor={ids.caption} className="plate-text text-ink-faint">
              Pie
            </label>
            <input
              id={ids.caption}
              name="caption"
              lang="es"
              maxLength={70}
              defaultValue={scene.caption}
              className="console-field w-full text-sm"
            />
            {state.status === "error" && <DeskErrors messages={state.messages} />}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="console-button" disabled={pending}>
                {pending ? "Guardando…" : "Guardar la escena"}
              </button>
              <button type="button" className="console-button" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <>
            <button
              type="button"
              className="scene-text"
              onClick={() => setEditing(true)}
              aria-label={`Editar la escena ${scene.n}: ${scene.narration}`}
            >
              {scene.narration}
            </button>
            {scene.caption && (
              <p className="mt-2 text-[13px] text-ink-dim">
                <span className="plate-text mr-2 text-ink-faint">Pie</span>
                {scene.caption}
              </p>
            )}
          </>
        )}

        {scene.fix && (
          <div className="scene-fix">
            <Tally state="ready" className="mr-2">
              Verificación
            </Tally>
            {scene.fix.after.length > 0 && (
              <>
                {pieces(scene.fix.before, "del")} → {pieces(scene.fix.after, "ins")}{" "}
              </>
            )}
            <span className="text-ink-faint">{scene.fix.problem}</span>
          </div>
        )}

        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {scene.graphics.map((graphic) => (
            <li key={graphic} className="scene-chip">
              {graphic}
            </li>
          ))}
          {scene.facts.map((fact) => {
            const display = fact.result ? FACT_DISPLAY[fact.result] : null;
            return (
              <li key={`${fact.id}-${fact.claim}`} className="scene-chip" title={fact.claim}>
                {display ? (
                  <Tally state={display.tally}>
                    {fact.id} · {display.label}
                  </Tally>
                ) : (
                  fact.id
                )}
              </li>
            );
          })}
          {scene.repeated.length > 0 && (
            <li className="scene-chip">
              <Tally state="cued">Imagen repetida en {scene.repeated.join(" y ")}</Tally>
            </li>
          )}
        </ul>
      </div>
    </article>
  );
}
