"use client";

import { useActionState, useId, useState } from "react";
import {
  type BrandFormState,
  deleteBrandAction,
  setBrandArchivedAction,
} from "@/app/(panel)/brands/actions";

const idle: BrandFormState = { status: "idle" };

/** Archive / bring back, and delete for good (typing the name to confirm). */
export function BrandDangerZone({
  id,
  name,
  archived,
  deleteBlocked,
}: {
  id: string;
  name: string;
  archived: boolean;
  /** Why it cannot be deleted (it has posts), if so. */
  deleteBlocked?: string;
}) {
  const [state, deleteAction, deleting] = useActionState(deleteBrandAction, idle);
  const [confirmation, setConfirmation] = useState("");
  const confirmId = useId();

  return (
    <div className="flex flex-col gap-8">
      <form action={setBrandArchivedAction} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="archived" value={archived ? "false" : "true"} />
        <p className="max-w-[60ch] text-sm text-ink-dim">
          {archived
            ? "La marca está archivada: no aparece en el selector ni genera contenido. Sus datos siguen guardados."
            : "Archivar la saca del selector y deja de generar contenido. No borra nada y se puede deshacer."}
        </p>
        <div>
          <button type="submit" className="console-button">
            {archived ? "Desarchivar" : "Archivar"}
          </button>
        </div>
      </form>

      <form action={deleteAction} className="flex flex-col gap-3 border-l border-tally-red/60 pl-4">
        <input type="hidden" name="id" value={id} />
        <p className="max-w-[60ch] text-sm text-ink-dim">
          Borrar es definitivo: se van la marca, sus assets y sus archivos.
          {deleteBlocked ? ` ${deleteBlocked}` : ""}
        </p>
        {!deleteBlocked && (
          <>
            <label htmlFor={confirmId} className="text-sm text-ink">
              Escribí <strong className="font-semibold">{name}</strong> para confirmar
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id={confirmId}
                name="confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
                className="console-field sm:w-72"
              />
              <button
                type="submit"
                className="console-button console-button-danger"
                disabled={deleting || confirmation.trim() !== name}
              >
                {deleting ? "Borrando…" : "Borrar marca"}
              </button>
            </div>
          </>
        )}
        {state.status === "error" && state.message && (
          <p role="alert" className="text-sm text-tally-red">
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
