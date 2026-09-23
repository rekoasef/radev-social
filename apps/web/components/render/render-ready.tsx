"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    /** Set when fonts are loaded: capture tools wait for it before taking the screenshot. */
    __renderReady?: boolean;
  }
}

export function RenderReady() {
  useEffect(() => {
    let active = true;
    document.fonts.ready.then(() => {
      if (active) window.__renderReady = true;
    });
    return () => {
      active = false;
    };
  }, []);
  return null;
}
