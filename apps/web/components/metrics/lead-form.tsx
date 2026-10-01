"use client";

import {
  LEAD_CHANNEL_LABELS,
  LEAD_CHANNELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUSES,
  type LeadChannel,
  type LeadStatus,
} from "@radev/core";
import { useActionState, useEffect, useId, useRef } from "react";
import { type LeadFormState, saveLeadAction } from "@/app/(panel)/metrics/leads/actions";

const idle: LeadFormState = { status: "idle" };

export type LeadValues = {
  id: string;
  name: string;
  contact: string;
  channel: LeadChannel;
  postRef: string | null;
  status: LeadStatus;
  notes: string;
};

/**
 * Types a lead in seconds: who, how to reach them and the post the message named (RA-0142, or
 * TK-… for the account's other posts). `posts` fills the post field's suggestions.
 */
export function LeadForm({
  slug,
  posts,
  lead,
}: {
  slug: string;
  posts: { ref: string; caption: string }[];
  lead?: LeadValues;
}) {
  const [state, action, pending] = useActionState(saveLeadAction, idle);
  const form = useRef<HTMLFormElement>(null);
  const id = useId();
  const field = (name: string) => `${id}-${name}`;

  // A new lead clears the form for the next one.
  useEffect(() => {
    if (state.status === "ok" && !lead) form.current?.reset();
  }, [state, lead]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      {lead && <input type="hidden" name="id" value={lead.id} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={field("name")} className="plate-text text-ink-faint">
            Nombre
          </label>
          <input
            id={field("name")}
            name="name"
            defaultValue={lead?.name}
            autoComplete="off"
            className="console-field"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={field("contact")} className="plate-text text-ink-faint">
            Contacto
          </label>
          <input
            id={field("contact")}
            name="contact"
            defaultValue={lead?.contact}
            placeholder="+54 9 351… o @usuario"
            autoComplete="off"
            className="console-field"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={field("post")} className="plate-text text-ink-faint">
            Post
          </label>
          <input
            id={field("post")}
            name="postRef"
            defaultValue={lead?.postRef ?? ""}
            placeholder="RA-0142"
            list={field("posts")}
            autoComplete="off"
            className="console-field timecode uppercase"
          />
          <datalist id={field("posts")}>
            {posts.map((post) => (
              <option key={post.ref} value={post.ref}>
                {post.caption.slice(0, 60)}
              </option>
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2">
            <label htmlFor={field("channel")} className="plate-text text-ink-faint">
              Canal
            </label>
            <select
              id={field("channel")}
              name="channel"
              defaultValue={lead?.channel ?? "whatsapp"}
              className="console-field"
            >
              {LEAD_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {LEAD_CHANNEL_LABELS[channel]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={field("status")} className="plate-text text-ink-faint">
              Estado
            </label>
            <select
              id={field("status")}
              name="status"
              defaultValue={lead?.status ?? "new"}
              className="console-field"
            >
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LEAD_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={field("notes")} className="plate-text text-ink-faint">
          Notas
        </label>
        <textarea
          id={field("notes")}
          name="notes"
          rows={2}
          defaultValue={lead?.notes}
          placeholder="Qué necesita, presupuesto, cuándo volver a escribirle…"
          className="console-field w-full text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="console-button console-button-primary" disabled={pending}>
          {pending ? "Guardando…" : lead ? "Guardar" : "Anotar lead"}
        </button>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-tally-red">
            {state.message}
          </p>
        )}
        {state.status === "ok" && (
          <p role="status" className="text-sm text-ink-dim">
            {state.message}
            {state.linked === false &&
              " Ese código no coincide con ningún post de la cuenta: queda anotado tal cual."}
          </p>
        )}
      </div>
    </form>
  );
}
