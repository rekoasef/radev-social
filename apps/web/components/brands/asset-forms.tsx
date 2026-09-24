"use client";

import { ASSET_ROLES, type AssetRole } from "@radev/core";
import { useActionState, useId } from "react";
import {
  type AssetFormState,
  deleteAsset,
  replaceAsset,
  uploadAsset,
} from "@/app/(panel)/brands/assets/actions";

const idle: AssetFormState = { status: "idle" };
const ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

function Feedback({ state }: { state: AssetFormState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={
        state.status === "error"
          ? "border-l border-tally-red pl-3 text-sm text-ink"
          : "border-l border-tally-green pl-3 text-sm text-ink-dim"
      }
    >
      {state.message}
    </p>
  );
}

export function AssetUploadForm({
  slug,
  roleLabels,
}: {
  slug: string;
  roleLabels: Record<AssetRole, string>;
}) {
  const [state, action, pending] = useActionState(uploadAsset, idle);
  const fileId = useId();
  const roleId = useId();

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <label htmlFor={fileId} className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="plate-text text-ink-faint">Archivo</span>
          <input
            id={fileId}
            name="file"
            type="file"
            accept={ACCEPT}
            required
            className="asset-file"
          />
        </label>
        <label htmlFor={roleId} className="flex flex-col gap-2">
          <span className="plate-text text-ink-faint">Uso</span>
          <select id={roleId} name="role" defaultValue="other" className="asset-select">
            {ASSET_ROLES.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="console-button console-button-primary" disabled={pending}>
          {pending ? "Subiendo…" : "Subir"}
        </button>
      </div>
      <p className="text-sm text-ink-faint">PNG, JPEG, WebP o SVG · hasta 5 MB.</p>
      <Feedback state={state} />
    </form>
  );
}

export function AssetActions({
  slug,
  assetId,
  name,
  usedBy,
}: {
  slug: string;
  assetId: string;
  /** For the confirmation and screen readers, e.g. "Logo · PNG 192×199". */
  name: string;
  /** Tokens that use the asset; it cannot be deleted while there are any. */
  usedBy: string[];
}) {
  const [replaced, replaceAction, replacing] = useActionState(replaceAsset, idle);
  const [deleted, deleteAction, deleting] = useActionState(deleteAsset, idle);
  const fileId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <form action={replaceAction}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="assetId" value={assetId} />
          <label
            htmlFor={fileId}
            className="console-button cursor-pointer"
            aria-disabled={replacing}
          >
            {replacing ? "Reemplazando…" : "Reemplazar"}
            <span className="sr-only"> {name}</span>
          </label>
          <input
            id={fileId}
            name="file"
            type="file"
            accept={ACCEPT}
            className="sr-only"
            disabled={replacing}
            onChange={(event) => {
              if (event.currentTarget.files?.length) event.currentTarget.form?.requestSubmit();
            }}
          />
        </form>
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!window.confirm(`¿Borrar ${name}? No se puede deshacer.`)) event.preventDefault();
          }}
        >
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="assetId" value={assetId} />
          <button
            type="submit"
            className="console-button"
            disabled={deleting || usedBy.length > 0}
            title={usedBy.length > 0 ? `En uso: ${usedBy.join(", ")}` : undefined}
          >
            {deleting ? "Borrando…" : "Borrar"}
            <span className="sr-only"> {name}</span>
          </button>
        </form>
      </div>
      <Feedback state={replaced.status !== "idle" ? replaced : deleted} />
    </div>
  );
}
