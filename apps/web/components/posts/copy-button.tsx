"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

/** Copies a text to paste it in TikTok; says so for a moment. */
export function CopyButton({ label, text }: { label: string; text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      // The clipboard needs HTTPS (or localhost) and the page focused.
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button type="button" onClick={copy} className="console-button inline-flex items-center gap-2">
      {state === "copied" ? <Check className="size-4" /> : <Copy className="size-4" />}
      <span aria-live="polite">
        {state === "copied" ? "Copiado" : state === "failed" ? "No se pudo copiar" : label}
      </span>
    </button>
  );
}
