"use client";

import { useActionState, useId } from "react";
import { markPublishedAction, type PublishState } from "@/app/(panel)/posts/actions";

const idle: PublishState = { status: "idle" };

/** After posting it by hand: the optional link and "Marcar como publicado". */
export function MarkPublishedForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState(markPublishedAction, idle);
  const urlId = useId();
  return (
    <form action={action} className="flex max-w-xl flex-col gap-3">
      <input type="hidden" name="code" value={code} />
      <label htmlFor={urlId} className="text-sm text-ink">
        Link del post en TikTok <span className="text-ink-faint">(opcional)</span>
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id={urlId}
          name="url"
          type="url"
          inputMode="url"
          placeholder="https://www.tiktok.com/@…"
          className="console-field flex-1"
        />
        <button type="submit" className="console-button" disabled={pending}>
          {pending ? "Marcando…" : "Marcar como publicado"}
        </button>
      </div>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-tally-red">
          {state.message}
        </p>
      )}
    </form>
  );
}
