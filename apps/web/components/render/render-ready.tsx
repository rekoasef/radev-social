"use client";

import { checkRender, describeQaIssue, type QaIssue } from "@radev/slides/qa";
import { useEffect, useState } from "react";

declare global {
  interface Window {
    /** Set when fonts and images are loaded: capture tools wait for it before the screenshot. */
    __renderReady?: boolean;
    /** Render QA of the slide (docs/DESIGN-SYSTEM.md §9), set just before __renderReady. */
    __renderQa?: QaIssue[];
  }
}

/**
 * Waits for fonts and images, runs the render QA and flags the page as ready. With `showQa`,
 * offending elements get a red outline and the issues are listed over the slide.
 */
export function RenderReady({ showQa = false }: { showQa?: boolean }) {
  const [issues, setIssues] = useState<QaIssue[] | null>(null);

  useEffect(() => {
    let active = true;
    // A broken image is not waited for forever: decode() rejects and the page still gets ready.
    const images = [...document.images].map((img) => img.decode().catch(() => undefined));
    Promise.all([document.fonts.ready, ...images]).then(() => {
      if (!active) return;
      const frame = document.querySelector("[data-slide-frame]");
      const found = frame ? checkRender(frame, showQa) : [];
      window.__renderQa = found;
      setIssues(found);
      window.__renderReady = true;
    });
    return () => {
      active = false;
    };
  }, [showQa]);

  if (!showQa || issues === null) return null;
  return (
    <div
      data-qa-report=""
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 16,
        padding: "14px 18px",
        borderRadius: 10,
        background: issues.length ? "rgba(120,10,10,0.92)" : "rgba(10,90,40,0.92)",
        color: "#fff",
        font: "500 20px/1.4 system-ui, sans-serif",
        zIndex: 10,
      }}
    >
      {issues.length === 0
        ? "QA: sin problemas"
        : issues.map((issue) => (
            <div key={`${issue.kind}-${issue.text}`}>{describeQaIssue(issue)}</div>
          ))}
    </div>
  );
}
