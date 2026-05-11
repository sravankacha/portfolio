"use client";

import { useEffect, useState } from "react";
import { themes, STORAGE_KEY, THEME_IDS, type ThemeId } from "../_variants/themes";

function applyTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* storage unavailable */
  }
}

export default function ThemeSwitcher() {
  const [current, setCurrent] = useState<ThemeId | null>(null);

  useEffect(() => {
    const fromDom = document.documentElement.dataset.theme as ThemeId | undefined;
    if (fromDom && THEME_IDS.includes(fromDom)) {
      setCurrent(fromDom);
    } else {
      setCurrent("editorial");
    }
  }, []);

  if (!current) {
    return <span className="text-xs text-muted">theme: …</span>;
  }

  return (
    <span className="text-xs text-muted font-mono inline-flex flex-wrap items-center gap-x-2">
      <span aria-hidden>theme:</span>
      {themes.map((t, i) => {
        const active = t.id === current;
        return (
          <span key={t.id} className="inline-flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-muted/50">·</span>}
            <button
              type="button"
              onClick={() => {
                if (active) return;
                applyTheme(t.id);
                setCurrent(t.id);
              }}
              className={
                active
                  ? "text-foreground cursor-default"
                  : "text-muted hover:!text-accent"
              }
              aria-pressed={active}
              aria-label={`Switch to ${t.label} theme — ${t.tagline}`}
              title={t.tagline}
            >
              {t.label}
            </button>
          </span>
        );
      })}
    </span>
  );
}
