"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    /** Set when fonts and images are loaded: capture tools wait for it before the screenshot. */
    __renderReady?: boolean;
  }
}

export function RenderReady() {
  useEffect(() => {
    let active = true;
    // A broken image is not waited for forever: decode() rejects and the page still gets ready
    // (the render QA of phase 2 checks images on its own).
    const images = [...document.images].map((img) => img.decode().catch(() => undefined));
    Promise.all([document.fonts.ready, ...images]).then(() => {
      if (active) window.__renderReady = true;
    });
    return () => {
      active = false;
    };
  }, []);
  return null;
}
