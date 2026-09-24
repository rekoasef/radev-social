"use client";

import { useActionState } from "react";
import { type ApproveState, approvePostAction } from "@/app/(panel)/posts/actions";

const idle: ApproveState = { status: "idle" };

/** "Aprobar" for the version on screen; shows why if the server refuses. */
export function ApproveButton({ code, versionId }: { code: string; versionId: string }) {
  const [state, action, pending] = useActionState(approvePostAction, idle);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="versionId" value={versionId} />
      <button type="submit" className="console-button console-button-primary" disabled={pending}>
        {pending ? "Aprobando…" : "Aprobar"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-tally-red">
          {state.message}
        </p>
      )}
    </form>
  );
}
