"use client";

import { useEffect } from "react";
import { applyTheme, getStoredTheme } from "@/frontend/lib/theme";

/**
 * Applies the persisted theme on mount (defaults to dark) and keeps the
 * "system" preference in sync with OS-level changes. Renders nothing.
 */
export function ThemeInit() {
  useEffect(() => {
    applyTheme(getStoredTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return null;
}