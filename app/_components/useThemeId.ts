"use client";

import { useSyncExternalStore } from "react";

// The active theme lives on <html data-theme>, set before paint by ThemeInitScript.
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
}
const read = () => document.documentElement.dataset.theme ?? "";

/** Current theme id; empty during server render. */
export function useThemeId(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}
