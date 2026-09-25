"use client";

import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AiProviderId,
  type AiRoute,
  type AiTask,
  checkAiRoute,
} from "@radev/core";
import { useActionState, useId, useState } from "react";
import { type RouteFormState, saveRouteAction } from "@/app/(panel)/settings/actions";

const idle: RouteFormState = { status: "idle" };

type FallbackChoice = AiProviderId | "none";

function Target({
  label,
  provider,
  model,
  onProvider,
  onModel,
  names,
  allowNone,
}: {
  label: string;
  provider: FallbackChoice;
  model: string;
  onProvider: (value: FallbackChoice) => void;
  onModel: (value: string) => void;
  names: { provider: string; model: string };
  allowNone?: boolean;
}) {
  const ids = { provider: useId(), model: useId() };
  const none = provider === "none";
  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="plate-text mb-2 text-ink-faint">{label}</legend>
      <label htmlFor={ids.provider} className="sr-only">
        Proveedor {label.toLowerCase()}
      </label>
      <select
        id={ids.provider}
        name={names.provider}
        value={provider}
        onChange={(event) => onProvider(event.target.value as FallbackChoice)}
        className="console-field"
      >
        {allowNone && <option value="none">Sin respaldo</option>}
        {AI_PROVIDERS.map((p) => (
          <option key={p} value={p}>
            {AI_PROVIDER_LABELS[p]}
          </option>
        ))}
      </select>
      {!none && (
        <>
          <label htmlFor={ids.model} className="sr-only">
            Modelo {label.toLowerCase()}
          </label>
          <input
            id={ids.model}
            name={names.model}
            value={model}
            onChange={(event) => onModel(event.target.value)}
            placeholder={provider === "openrouter" ? "proveedor/modelo:free" : "sonnet"}
            autoComplete="off"
            spellCheck={false}
            className="console-field timecode"
          />
        </>
      )}
    </fieldset>
  );
}

/** Principal and fallback of one task. The rules are checked here and again on the server. */
export function AiRouteForm({ task, route }: { task: AiTask; route: AiRoute | null }) {
  const [state, action, pending] = useActionState(saveRouteAction, idle);
  const [provider, setProvider] = useState<AiProviderId>(route?.primary.provider ?? "claude-code");
  const [model, setModel] = useState(route?.primary.model ?? "");
  const [fallbackProvider, setFallbackProvider] = useState<FallbackChoice>(
    route?.fallback?.provider ?? "none",
  );
  const [fallbackModel, setFallbackModel] = useState(route?.fallback?.model ?? "");

  const draft = {
    task,
    primary: { provider, model },
    fallback:
      fallbackProvider === "none" ? null : { provider: fallbackProvider, model: fallbackModel },
  };
  const problems = checkAiRoute(draft);
  const saved = route ? JSON.stringify([route.primary, route.fallback]) : "";
  const dirty = JSON.stringify([draft.primary, draft.fallback]) !== saved;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="task" value={task} />
      <div className="grid gap-6 sm:grid-cols-2">
        <Target
          label="Principal"
          provider={provider}
          model={model}
          onProvider={(value) => value !== "none" && setProvider(value)}
          onModel={setModel}
          names={{ provider: "provider", model: "model" }}
        />
        <Target
          label="Respaldo"
          provider={fallbackProvider}
          model={fallbackModel}
          onProvider={setFallbackProvider}
          onModel={setFallbackModel}
          names={{ provider: "fallbackProvider", model: "fallbackModel" }}
          allowNone
        />
      </div>
      {dirty && problems.length > 0 && (
        <ul className="flex flex-col gap-1 border-l border-tally-red pl-3 text-sm text-ink">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          className="console-button console-button-primary"
          disabled={pending || !dirty || problems.length > 0}
        >
          {pending ? "Guardando…" : "Guardar ruta"}
        </button>
        {dirty && !pending && <span className="text-sm text-ink-faint">Cambios sin guardar.</span>}
        {state.status === "ok" && !dirty && (
          <p role="status" className="border-l border-tally-green pl-3 text-sm text-ink-dim">
            {state.message}
          </p>
        )}
        {state.status === "error" && (
          <ul role="alert" className="flex flex-col gap-1 border-l border-tally-red pl-3 text-sm">
            {state.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}
