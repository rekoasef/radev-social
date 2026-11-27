"use client";

import { FORM_LABELS, FORM_USES, VIDEO_FORMS, type VideoForm } from "@radev/core";
import { Play, Square } from "lucide-react";
import { useActionState, useId, useRef, useState } from "react";
import { createVideoAction, type VideoActionState } from "@/app/(panel)/videos/actions";
import { IdeaPicker } from "@/components/videos/idea-picker";
import { TOPIC_MAX, TOPIC_MIN } from "@/lib/video-form";
import type { IdeaBoard } from "@/lib/video-ideas";

const idle: VideoActionState = { status: "idle" };

export type VoiceOption = {
  id: string;
  name: string;
  use: string;
  isDefault: boolean;
  previewUrl: string | null;
};

/** Topic, optional brand and voice: the folder goes to Research. */
export function NewVideoForm({
  brands,
  voices,
  ideas,
}: {
  ideas: IdeaBoard;
  brands: { id: string; name: string; codePrefix: string }[];
  voices: VoiceOption[];
}) {
  const [state, action, pending] = useActionState(createVideoAction, idle);
  const [topic, setTopic] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const [told, setTold] = useState<VideoForm | "">("");
  const audio = useRef<HTMLAudioElement>(null);
  const topicId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const length = topic.trim().length;
  const initialVoice = (voices.find((v) => v.isDefault) ?? voices[0])?.id;

  function toggle(voice: VoiceOption) {
    const player = audio.current;
    if (!player || !voice.previewUrl) return;
    if (playing === voice.id) {
      player.pause();
      setPlaying(null);
      return;
    }
    player.src = voice.previewUrl;
    setPlaying(voice.id);
    player.play().catch(() => setPlaying(null));
  }

  return (
    <form action={action} className="flex flex-col gap-7">
      <IdeaPicker
        board={ideas}
        onPick={(picked) => {
          setTopic(picked);
          field.current?.focus();
        }}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor={topicId} className="flex items-baseline justify-between gap-3">
          <span className="plate-text text-ink-dim">Tema</span>
          <span
            className={`timecode text-xs ${length > TOPIC_MAX ? "text-tally-red" : "text-ink-faint"}`}
          >
            {length}/{TOPIC_MAX}
          </span>
        </label>
        <textarea
          id={topicId}
          ref={field}
          name="topic"
          rows={4}
          required
          lang="es"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Ej.: el apagón de Nueva York de julio de 1977: qué lo causó y qué pasó esa noche"
          className="console-field w-full text-base leading-relaxed"
        />
        <p className="text-sm text-ink-faint">
          Contalo como se lo contarías a alguien. Investigación busca las fuentes; nada de lo que
          diga el video sale de otro lado.
        </p>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="plate-text mb-2 text-ink-dim">Marca</legend>
        <div className="segmented">
          <label>
            <input type="radio" name="brandId" value="" defaultChecked />
            Sin marca
          </label>
          {brands.map((brand) => (
            <label key={brand.id}>
              <input type="radio" name="brandId" value={brand.id} />
              <span className="callsign">{brand.codePrefix}</span>
              {brand.name}
            </label>
          ))}
        </div>
        <p className="text-sm text-ink-faint">Sin marca, el video va al canal de historias.</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="plate-text mb-2 text-ink-dim">Forma de contar</legend>
        <div className="segmented">
          {(["", ...VIDEO_FORMS] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="form"
                value={value}
                checked={told === value}
                onChange={() => setTold(value)}
              />
              {value ? FORM_LABELS[value] : "Automática"}
            </label>
          ))}
        </div>
        <p className="text-sm text-ink-faint">
          {told
            ? FORM_USES[told]
            : "Guion elige la que mejor aguanten los hechos, sin repetir la de tus últimos dos videos."}
        </p>
      </fieldset>

      <fieldset>
        <legend className="plate-text mb-2 text-ink-dim">Voz</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {voices.map((voice) => (
            <div key={voice.id} className="voice-option">
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5">
                <input
                  type="radio"
                  name="voiceId"
                  value={voice.id}
                  defaultChecked={voice.id === initialVoice}
                  className="accent-ink size-4 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{voice.name}</span>
                  <span className="block text-xs text-ink-faint">
                    {voice.use === "commercial" ? "Comercial" : "Narrativa"}
                    {voice.isDefault ? " · por defecto" : ""}
                  </span>
                </span>
              </label>
              {voice.previewUrl && (
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-full border border-bezel-strong text-ink-dim hover:text-ink"
                  onClick={() => toggle(voice)}
                  aria-label={`${playing === voice.id ? "Parar" : "Escuchar"} ${voice.name}`}
                >
                  {playing === voice.id ? (
                    <Square className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Play className="size-3.5" aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
        {/* biome-ignore lint/a11y/useMediaCaption: a short voice sample, there is no text to caption */}
        <audio ref={audio} onEnded={() => setPlaying(null)} />
      </fieldset>

      <p className="text-sm text-ink-faint">Idioma: español. El inglés llega después.</p>

      {state.status === "error" && (
        <p role="alert" className="border-l border-tally-red pl-3 text-sm text-ink">
          {state.message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="console-button console-button-primary"
          disabled={pending || length < TOPIC_MIN || length > TOPIC_MAX || voices.length === 0}
        >
          {pending ? "Mandando…" : "Mandar a Investigación"}
        </button>
        <span className="text-sm text-ink-faint">No gasta voz hasta que apruebes el guion.</span>
      </div>
    </form>
  );
}
