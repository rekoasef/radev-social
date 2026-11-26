"use client";

import { useActionState, useCallback, useId, useState } from "react";
import {
  approveScriptAction,
  type DeskState,
  drawFramesAction,
  rejectScriptAction,
} from "@/app/(panel)/videos/desk-actions";
import { Plate } from "@/components/console/plate";
import { Tally } from "@/components/console/tally";
import type { SceneView, ScriptDeskView } from "@/lib/video-script";
import { DeskErrors } from "./desk-errors";
import { ImageSheet } from "./image-sheet";
import { FACT_DISPLAY, SceneCard } from "./scene-card";

const idle: DeskState = { status: "idle" };

const FILTERS = [
  { key: "all", label: "Todas", match: () => true },
  { key: "fixed", label: "Corregidas", match: (s: SceneView) => s.fix !== null },
  { key: "unverified", label: "Hechos sin verificar", match: (s: SceneView) => s.unverified },
  { key: "repeated", label: "Imagen repetida", match: (s: SceneView) => s.repeated.length > 0 },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const number = new Intl.NumberFormat("es-AR");

/** The first desk: read the script, fix what is needed, then approve it or send it back. */
export function ScriptDesk({
  videoId,
  version,
  desk,
  drawing,
  paused,
  voiceLeft,
  voiceReused,
}: {
  videoId: string;
  version: number;
  desk: ScriptDeskView;
  /** Frames are on their way (the page refreshes itself). */
  drawing: boolean;
  /** A paused video cannot be approved until it is resumed. */
  paused: boolean;
  /** Voice credits left, as of the last take that read them. */
  voiceLeft: number | null;
  /** The narration is the one already recorded: approving does not pay for the voice. */
  voiceReused: boolean;
}) {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sheet, setSheet] = useState<{ scene: number | null } | null>(null);
  const [approval, approve, approving] = useActionState(approveScriptAction, idle);
  const [rejection, reject, rejecting] = useActionState(rejectScriptAction, idle);
  const [note, setNote] = useState("");
  const noteId = useId();
  const approveForm = useId();
  const closeSheet = useCallback(() => setSheet(null), []);

  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = desk.scenes.filter(active.match);
  const target = (
    <>
      <input type="hidden" name="videoId" value={videoId} />
      <input type="hidden" name="version" value={version} />
    </>
  );

  return (
    <>
      <p className="timecode flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-ink-dim">
        <span>{desk.scenes.length} escenas</span>
        <span>{number.format(desk.characters)} caracteres</span>
        <span>~{desk.seconds} s de voz</span>
        <span>
          {desk.imagesUsed} de {desk.images.length} imágenes
        </span>
        <span>versión {version}</span>
      </p>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-label="Escenas" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className="console-chip scene-filter"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}{" "}
                <span className="timecode text-ink-faint">
                  {desk.scenes.filter(f.match).length}
                </span>
              </button>
            ))}
          </div>
          <div className="divide-y divide-bezel rounded-md border border-bezel bg-panel">
            {shown.length === 0 && (
              <p className="px-5 py-8 text-sm text-ink-dim">Ninguna escena entra en ese filtro.</p>
            )}
            {shown.map((scene) => (
              <SceneCard
                // A saved version starts the card over: no stale text left in its fields.
                key={`${version}-${scene.n}`}
                videoId={videoId}
                version={version}
                scene={scene}
                onSwap={() => setSheet({ scene: scene.n })}
              />
            ))}
          </div>

          <section aria-labelledby="facts-heading" className="flex flex-col gap-3 pt-4">
            <Plate id="facts-heading" aside={`${desk.facts.length} hechos`}>
              Hechos y fuentes
            </Plate>
            <ul className="divide-y divide-bezel rounded-md border border-bezel bg-panel">
              {desk.facts.map((fact) => (
                <li key={`${fact.id}-${fact.claim}`} className="flex flex-col gap-1.5 px-4 py-3">
                  <span
                    className={`text-sm ${fact.dropped ? "text-ink-faint line-through" : "text-ink"}`}
                  >
                    {fact.claim}
                  </span>
                  {fact.quote && <q className="text-xs text-ink-dim italic">{fact.quote}</q>}
                  {fact.differs && (
                    <span className="text-xs text-tally-amber">
                      La página no dice: {fact.differs}
                    </span>
                  )}
                  <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-faint">
                    {fact.result && (
                      <Tally state={FACT_DISPLAY[fact.result].tally}>
                        {FACT_DISPLAY[fact.result].label}
                      </Tally>
                    )}
                    <span className="timecode">
                      {fact.id}
                      {fact.scene ? ` · escena ${fact.scene}` : ""}
                    </span>
                    {fact.url && (
                      <a
                        href={fact.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline underline-offset-2 hover:text-ink"
                      >
                        {new URL(fact.url).hostname.replace(/^www\./, "")}
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </section>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-32">
          <section aria-label="Decisión" className="flex flex-col gap-3 desk-panel">
            <form action={approve} id={approveForm} className="flex flex-col">
              {target}
              <button
                type="submit"
                className="console-button console-button-primary"
                disabled={approving || rejecting || paused}
              >
                {approving ? "Aprobando…" : "Aprobar guion"}
              </button>
            </form>
            <p className="text-sm text-ink-faint">
              {voiceReused
                ? "La narración no cambió: se usa la voz ya grabada, sin gastar créditos."
                : `Pasa a Locución y gasta unos ${number.format(desk.characters)} créditos de voz.`}
              {!voiceReused &&
                voiceLeft !== null &&
                ` En la última locución quedaban ${number.format(voiceLeft)}.`}
              {paused && " Está pausado: retomalo antes de aprobar."}
            </p>
            {approval.status === "error" && <DeskErrors messages={approval.messages} />}

            <form action={reject} className="flex flex-col gap-3 border-t border-bezel pt-3">
              {target}
              <label htmlFor={noteId} className="plate-text text-ink-dim">
                Devolver a Guion
              </label>
              <textarea
                id={noteId}
                name="note"
                rows={3}
                lang="es"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Qué hay que cambiar. Ej.: la escena 2 es una pregunta suelta."
                className="console-field w-full scroll-mt-32 text-sm"
              />
              {rejection.status === "error" && <DeskErrors messages={rejection.messages} />}
              <button
                type="submit"
                className="console-button"
                disabled={rejecting || approving || paused || !note.trim()}
              >
                {rejecting ? "Devolviendo…" : "Devolver con la nota"}
              </button>
              <p className="text-sm text-ink-faint">
                Rehace Guion y Verificación. No repite la investigación ni las imágenes.
              </p>
            </form>
          </section>

          {desk.notes.length > 0 && (
            <section className="desk-panel flex flex-col gap-3">
              <h2 className="plate-text text-ink">Para mirar</h2>
              <ul className="flex flex-col gap-2 text-[13px] text-ink-dim">
                {desk.notes.map((n) => (
                  <li key={n.text} className="flex gap-2">
                    <Tally state={n.tone} className="mt-1 self-start">
                      <span className="sr-only">{n.tone === "cued" ? "Atención" : "Bien"}</span>
                    </Tally>
                    <span>{n.text}</span>
                  </li>
                ))}
              </ul>
              {desk.framesPending > 0 && <DrawFrames videoId={videoId} drawing={drawing} />}
            </section>
          )}

          <section className="desk-panel flex flex-col gap-2">
            <h2 className="plate-text flex justify-between text-ink-faint">
              Tu aporte <span>próximamente</span>
            </h2>
            <textarea
              rows={3}
              disabled
              aria-label="Tu aporte (próximamente)"
              placeholder="Una opinión, un dato o un ángulo tuyo."
              className="console-field w-full text-sm opacity-60"
            />
          </section>

          <section className="desk-panel flex items-center justify-between gap-3">
            <span className="text-[13px] text-ink-dim">{desk.images.length} candidatas</span>
            <button
              type="button"
              className="console-button"
              onClick={() => setSheet({ scene: null })}
            >
              Ver la hoja
            </button>
          </section>
        </aside>
      </div>

      {/* Phone: the decision stays within thumb reach, above the dock. */}
      <div className="review-bar md:hidden">
        <div className="flex gap-2">
          <button
            type="button"
            className="console-button"
            onClick={() => document.getElementById(noteId)?.focus()}
          >
            Devolver
          </button>
          <button
            type="submit"
            form={approveForm}
            className="console-button console-button-primary flex-1"
            disabled={approving || rejecting || paused}
          >
            {approving ? "Aprobando…" : "Aprobar guion"}
          </button>
        </div>
      </div>

      <ImageSheet
        videoId={videoId}
        version={version}
        images={desk.images}
        scene={sheet?.scene ?? null}
        current={sheet?.scene ? desk.scenes[sheet.scene - 1]?.image?.id : undefined}
        open={sheet !== null}
        onClose={closeSheet}
      />
    </>
  );
}

/** Asks the video-worker to draw the frames that are missing. */
function DrawFrames({ videoId, drawing }: { videoId: string; drawing: boolean }) {
  const [state, action, pending] = useActionState(drawFramesAction, { status: "idle" as const });
  if (drawing) {
    return <Tally state="standby">Dibujando los cuadros (necesita el video-worker)</Tally>;
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="videoId" value={videoId} />
      <button type="submit" className="console-button self-start" disabled={pending}>
        {pending ? "Pidiendo…" : "Dibujar los cuadros"}
      </button>
      {state.status === "error" && <DeskErrors messages={state.messages} />}
    </form>
  );
}
