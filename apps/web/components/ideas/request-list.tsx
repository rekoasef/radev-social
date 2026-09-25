"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Tally, type TallyState } from "@/components/console/tally";

export type RequestRow = {
  id: string;
  label: string;
  status: "queued" | "running" | "succeeded" | "failed";
  when: string;
  ideaCount: number;
  error: string | null;
};

const DISPLAY: Record<RequestRow["status"], { tally: TallyState; label: string }> = {
  queued: { tally: "standby", label: "En cola" },
  running: { tally: "cued", label: "Trabajando" },
  succeeded: { tally: "ready", label: "Listo" },
  failed: { tally: "live", label: "Falló" },
};

/** Refresh while a request is open: the new ideas show up without reloading. */
const REFRESH_MS = 4000;

/** The brand's latest requests to the AI and how each one went. */
export function RequestList({ requests }: { requests: RequestRow[] }) {
  const router = useRouter();
  const open = requests.some((r) => r.status === "queued" || r.status === "running");

  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [open, router]);

  if (requests.length === 0) return null;
  return (
    <ul className="flex max-w-5xl flex-col divide-y divide-bezel rounded-md border border-bezel">
      {requests.map((request) => {
        const display = DISPLAY[request.status];
        return (
          <li key={request.id} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-ink">
                {request.label}
                <span className="timecode ml-2 text-xs text-ink-faint">{request.when}</span>
              </span>
              <Tally state={display.tally}>
                {request.status === "succeeded"
                  ? request.ideaCount === 0
                    ? "Sin ideas nuevas"
                    : `${request.ideaCount} ${request.ideaCount === 1 ? "idea" : "ideas"}`
                  : display.label}
              </Tally>
            </div>
            {request.status === "failed" && request.error && (
              <p className="text-sm whitespace-pre-line text-ink-dim">{request.error}</p>
            )}
            {request.status === "succeeded" && request.ideaCount === 0 && (
              <p className="text-sm text-ink-dim">
                Todo lo que propuso ya estaba en el banco o en los últimos posts.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
