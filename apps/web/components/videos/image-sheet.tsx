"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import {
  type DeskState,
  editSceneAction,
  pinImageAction,
  pinStatusAction,
} from "@/app/(panel)/videos/desk-actions";
import type { ImageView } from "@/lib/video-script";
import { DeskErrors } from "./desk-errors";

const idle: DeskState = { status: "idle" };
/** After this long without an answer, the video-worker is probably not running. */
const SLOW_MS = 25_000;

/**
 * The sheet of candidate images: pick one for a scene, or add one from Commons by name. Without a
 * scene it is just to look.
 */
export function ImageSheet({
  videoId,
  version,
  images,
  scene,
  current,
  open,
  onClose,
}: {
  videoId: string;
  version: number;
  images: ImageView[];
  scene: number | null;
  current?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState(editSceneAction, idle);

  useEffect(() => {
    if (state.status === "done") onClose();
  }, [state, onClose]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="mockup-backdrop" />
        <Dialog.Popup className="sheet-popup">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="plate">
              {scene ? `Imagen de la escena ${scene}` : "Imágenes candidatas"}
            </Dialog.Title>
            <Dialog.Close className="console-button">Cerrar</Dialog.Close>
          </div>
          <PinByName videoId={videoId} />
          {state.status === "error" && <DeskErrors messages={state.messages} />}
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image) => {
              const picture = (
                <>
                  {/* biome-ignore lint/performance/noImgElement: a file of the video, already small */}
                  <img src={image.src} alt="" loading="lazy" className="video-thumb" />
                  <span className="line-clamp-2 text-xs text-ink-dim">
                    {image.id} · {image.title}
                  </span>
                  <span className="timecode text-[10px] text-ink-faint">
                    {image.license}
                    {image.id === current ? " · en esta escena" : ""}
                  </span>
                </>
              );
              return (
                <li key={image.id}>
                  {scene === null ? (
                    <a
                      href={image.page}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col gap-1.5"
                    >
                      {picture}
                    </a>
                  ) : (
                    <form action={action}>
                      <input type="hidden" name="videoId" value={videoId} />
                      <input type="hidden" name="version" value={version} />
                      <input type="hidden" name="scene" value={scene} />
                      <input type="hidden" name="image" value={image.id} />
                      <button
                        type="submit"
                        disabled={pending || image.id === current}
                        className="flex w-full flex-col gap-1.5 rounded-sm text-left disabled:opacity-60"
                      >
                        {picture}
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type Pin =
  | { step: "idle" }
  | { step: "waiting"; jobId: string; since: number }
  | { step: "done"; ok: boolean; message: string };

function PinByName({ videoId }: { videoId: string }) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState<Pin>({ step: "idle" });
  const [slow, setSlow] = useState(false);
  const router = useRouter();
  const id = useId();

  useEffect(() => {
    if (pin.step !== "waiting") return;
    const timer = setInterval(async () => {
      setSlow(Date.now() - pin.since > SLOW_MS);
      const status = await pinStatusAction(videoId, pin.jobId);
      if (status.state !== "done") return;
      setPin({ step: "done", ok: status.result.ok, message: status.result.message });
      if (status.result.ok) {
        setName("");
        router.refresh();
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [pin, videoId, router]);

  async function send() {
    setSlow(false);
    const sent = await pinImageAction({ videoId, name });
    setPin(
      sent.ok
        ? { step: "waiting", jobId: sent.jobId, since: Date.now() }
        : { step: "done", ok: false, message: sent.message },
    );
  }

  return (
    <form action={send} className="flex flex-col gap-2">
      <label htmlFor={id} className="plate-text text-ink-faint">
        Sumar una de Commons
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={id}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="https://commons.wikimedia.org/wiki/File:…"
          className="console-field min-w-0 flex-1"
        />
        <button
          type="submit"
          className="console-button"
          disabled={pin.step === "waiting" || !name.trim()}
        >
          {pin.step === "waiting" ? "Bajando…" : "Sumar"}
        </button>
      </div>
      <p role="status" className="text-sm text-ink-dim">
        {pin.step === "waiting" &&
          (slow
            ? "Sigue esperando: ¿está corriendo el video-worker?"
            : "El video-worker la está bajando.")}
        {pin.step === "done" && (
          <span className={pin.ok ? "text-tally-green" : "text-tally-red"}>{pin.message}</span>
        )}
      </p>
    </form>
  );
}
