"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Reloads the page's data while an office is working (only with the tab in view). */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
