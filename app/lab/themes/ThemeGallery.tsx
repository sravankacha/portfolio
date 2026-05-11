"use client";

import { useEffect, useState } from "react";
import { themes, STORAGE_KEY, type ThemeId } from "../../_variants/themes";

const previews: Record<ThemeId, { bg: string; ink: string; accent: string; sample: string }> = {
  editorial: {
    bg: "#ffffff",
    ink: "#000000",
    accent: "linear-gradient(135deg, #6930c3, #1e5f74)",
    sample: "Sravan / Editorial",
  },
  ocean: {
    bg: "linear-gradient(180deg, #cfeaff 0%, #7ec0ee 35%, #2c7da0 75%, #013a63 100%)",
    ink: "#062a3d",
    accent: "linear-gradient(135deg, #023e8a, #00b4d8)",
    sample: "Sravan / Ocean",
  },
};

export default function ThemeGallery() {
  const [current, setCurrent] = useState<ThemeId | null>(null);

  useEffect(() => {
    setCurrent(
      (document.documentElement.dataset.theme as ThemeId) || "editorial",
    );
  }, []);

  const apply = (id: ThemeId) => {
    document.documentElement.dataset.theme = id;
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable */
    }
    setCurrent(id);
  };

  return (
    <ul className="grid sm:grid-cols-2 gap-4">
      {themes.map((t) => {
        const p = previews[t.id];
        const active = t.id === current;
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => apply(t.id)}
              className="block w-full text-left rounded-xl border border-border bg-surface overflow-hidden hover:border-accent transition-colors"
            >
              <div
                className="h-32 w-full grid place-items-center relative"
                style={{ background: p.bg }}
              >
                <span
                  className="font-display text-2xl font-medium"
                  style={{
                    background: p.accent,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {p.sample}
                </span>
              </div>
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="font-display text-lg font-medium">
                    {t.label}
                  </span>
                  {active && (
                    <span className="font-mono text-[10px] uppercase tracking-widest text-accent">
                      active
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted">{t.tagline}</p>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
