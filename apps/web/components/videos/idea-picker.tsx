"use client";

import { VIDEO_IDEA_FOCUS_MAX, VIDEO_IDEA_MODES, type VideoIdeaMode } from "@radev/core";
import { useId, useState, useTransition } from "react";
import { requestIdeasAction } from "@/app/(panel)/videos/actions";
import { Tally } from "@/components/console/tally";
import { IDEA_MODE_LABELS, type IdeaBoard } from "@/lib/video-ideas";

const host = (url: string) => URL.parse(url)?.hostname.replace(/^www\./, "") ?? url;

/**
 * Topic ideas inside "Nuevo video": picking one copies it into "Tema". It lives inside that form,
 * so its buttons never submit it.
 */
export function IdeaPicker({
  board,
  onPick,
}: {
  board: IdeaBoard;
  onPick: (topic: string) => void;
}) {
  const [focus, setFocus] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const focusId = useId();
  const busy = (mode: VideoIdeaMode) => board.waiting.some((w) => w.mode === mode);

  function ask(mode: VideoIdeaMode, form: HTMLFormElement | null) {
    // The brand chosen further down in the same form.
    const brandId = form ? String(new FormData(form).get("brandId") ?? "") : "";
    setMessage(null);
    startTransition(async () => {
      const state = await requestIdeasAction({ mode, brandId, focus });
      if (state.status === "error") setMessage(state.message);
    });
  }

  return (
    <section aria-label="Ideas de la IA" className="desk-panel flex flex-col gap-3">
      <label htmlFor={focusId} className="plate-text text-ink-dim">
        ¿Sin tema? Pedile ideas a la IA
      </label>
      <input
        id={focusId}
        type="text"
        value={focus}
        maxLength={VIDEO_IDEA_FOCUS_MAX}
        onChange={(event) => setFocus(event.target.value)}
        onKeyDown={(event) => {
          // Enter here must not send the video.
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (!busy("generate")) ask("generate", event.currentTarget.form);
        }}
        placeholder="Opcional: misterios, historia argentina, inventos…"
        className="console-field w-full"
      />
      <div className="flex flex-wrap gap-2">
        {VIDEO_IDEA_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className="console-button"
            disabled={pending || busy(mode)}
            onClick={(event) => ask(mode, event.currentTarget.form)}
          >
            {IDEA_MODE_LABELS[mode]}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-ink-faint">
        «Proponer» usa lo que la IA ya sabe (segundos). «Investigar» busca en la web temas actuales:
        tarda más de un minuto y gasta unas 20 veces más. Usan la marca que elijas abajo.
      </p>

      <div role="status" className="flex flex-col gap-1.5">
        {board.waiting.map(({ mode, started }) => (
          <Tally key={mode} state="standby">
            {IDEA_MODE_LABELS[mode]} · {started ? "pensando" : "en cola (necesita el video-worker)"}
          </Tally>
        ))}
        {board.failed.map(({ mode, error }) => (
          <p key={mode} className="border-l border-tally-red pl-3 text-sm text-ink">
            {IDEA_MODE_LABELS[mode]}: {error}
          </p>
        ))}
        {message && <p className="border-l border-tally-red pl-3 text-sm text-ink">{message}</p>}
      </div>

      {/* Only the newest answer starts open, so "Tema" does not end up far below. */}
      {board.groups.map((group, index) => (
        <details key={group.id} open={index === 0}>
          <summary className="plate-text min-h-11 cursor-pointer py-3.5 text-ink-dim">
            {group.mode === "research" ? "De la web" : "Propuestas"} · {group.ideas.length}
          </summary>
          <ul className="flex flex-col gap-2">
            {group.ideas.map((idea) => (
              <li key={idea.topic} className="rounded-md border border-bezel-strong">
                <button
                  type="button"
                  className="flex min-h-11 w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left hover:bg-panel-raised"
                  onClick={() => onPick(idea.topic)}
                >
                  <span className="text-sm text-ink">{idea.topic}</span>
                  <span className="text-[13px] text-ink-faint">{idea.hook}</span>
                </button>
                {idea.sources.length > 0 && (
                  <p className="flex flex-wrap gap-x-3 px-3 pb-2 text-xs text-ink-faint">
                    {idea.sources.map((source) => (
                      <a
                        key={source.url}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        title={source.title}
                        className="underline underline-offset-2 hover:text-ink"
                      >
                        {host(source.url)}
                      </a>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </details>
      ))}
    </section>
  );
}
