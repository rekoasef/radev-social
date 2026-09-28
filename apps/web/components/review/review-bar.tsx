"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { SlideTexts, TextField } from "@radev/slides";
import { useActionState, useState } from "react";
import { type ApproveState, approvePostAction } from "@/app/(panel)/posts/actions";
import { RejectForm } from "@/components/posts/reject-form";
import { QuickEditForm } from "./quick-edit-form";

const idle: ApproveState = { status: "idle" };

/** Starting points for a rejection: tapped, they go into the feedback, to finish in words. */
const REJECT_PHRASES = [
  "El hook es flojo:",
  "Está muy largo, recortá texto.",
  "Cambiá el enfoque:",
  "Suena genérico, hacelo más concreto.",
  "Sacá la slide",
] as const;

type Sheet = "reject" | "edit" | null;

export type QuickEditData = { post: TextField[]; slides: SlideTexts[]; hashtags: string };

/**
 * The review queue's actions, fixed at the bottom of the phone within thumb reach: approve right
 * away, or open a sheet to reject (AI posts) or edit the texts. Every action comes back to the
 * queue.
 */
export function ReviewBar({
  code,
  versionId,
  approveHint,
  canApprove,
  canReject,
  edit,
}: {
  code: string;
  versionId: string;
  /** What approving does with its time ("Se programa para…"). */
  approveHint: string;
  canApprove: boolean;
  canReject: boolean;
  /** Null: this version cannot be edited here (the full editor can). */
  edit: QuickEditData | null;
}) {
  const [state, approve, approving] = useActionState(approvePostAction, idle);
  const [sheet, setSheet] = useState<Sheet>(null);
  const close = () => setSheet(null);

  return (
    <>
      <div className="review-bar">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2">
          {state.status === "error" && (
            <p role="alert" className="text-sm text-tally-red">
              {state.message}
            </p>
          )}
          <div className="flex items-stretch gap-2">
            <form action={approve} className="flex flex-1 md:flex-none">
              <input type="hidden" name="code" value={code} />
              <input type="hidden" name="versionId" value={versionId} />
              <input type="hidden" name="from" value="review" />
              <button
                type="submit"
                className="console-button console-button-primary w-full md:w-auto"
                disabled={approving || !canApprove}
              >
                {approving ? "Aprobando…" : "Aprobar"}
              </button>
            </form>
            {canReject && (
              <button type="button" className="console-button" onClick={() => setSheet("reject")}>
                Rechazar
              </button>
            )}
            {edit && (
              <button type="button" className="console-button" onClick={() => setSheet("edit")}>
                Editar
              </button>
            )}
            <p className="hidden self-center text-sm text-ink-faint md:ml-3 md:block">
              {approveHint}
            </p>
          </div>
          <p className="text-xs text-ink-faint md:hidden">{approveHint}</p>
        </div>
      </div>

      <Dialog.Root open={sheet !== null} onOpenChange={(open) => !open && close()}>
        <Dialog.Portal>
          <Dialog.Backdrop className="mockup-backdrop" />
          <Dialog.Popup className="sheet-popup">
            <Dialog.Title className="plate mb-5">
              {sheet === "edit" ? `Editar textos · ${code}` : `Rechazar ${code}`}
            </Dialog.Title>
            {sheet === "reject" && (
              <RejectForm
                code={code}
                versionId={versionId}
                from="review"
                onCancel={close}
                suggestions={REJECT_PHRASES}
              />
            )}
            {sheet === "edit" && edit && (
              <QuickEditForm
                code={code}
                versionId={versionId}
                post={edit.post}
                slides={edit.slides}
                hashtags={edit.hashtags}
                onCancel={close}
              />
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
