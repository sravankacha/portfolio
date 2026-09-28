"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { BackButton, FloatingPanel } from "../_shared/LabChrome";

const PipeCanvas = dynamic(() => import("./PipeCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm font-mono text-white/60">
      laying pipe…
    </div>
  ),
});

const NARROW = "(max-width: 640px)";
function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const isNarrow = () => window.matchMedia(NARROW).matches;

export default function PipeLab() {
  const [speed, setSpeed] = useState(6);
  const [wander, setWander] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [steers, setSteers] = useState(0);
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);

  // Lock page scroll while the fullscreen lab is mounted.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const controls = useMemo(
    () => ({ speed, wander, resetToken }),
    [speed, wander, resetToken]
  );
  const onSteer = useCallback(() => setSteers((n) => n + 1), []);

  return (
    <div
      className="fixed inset-0 z-40"
      // The scene is always night-sky dark, whatever the site theme; retint the lab chrome to match.
      style={
        {
          background: "#0a1024",
          "--background": "#111a38",
          "--foreground": "#e9eef9",
          "--muted": "#aab5d3",
          "--border": "rgba(233, 238, 249, 0.24)",
          "--accent": "#7aa2ff",
          color: "#e9eef9",
        } as React.CSSProperties
      }
    >
      <PipeCanvas controls={controls} onSteer={onSteer} />
      <BackButton />

      <FloatingPanel
        key={narrow ? "narrow" : "wide"}
        title="Pipe"
        top={16}
        width={240}
        defaultOpen={!narrow}
      >
        <label className="block text-xs">
          <span className="flex justify-between text-foreground/80">
            <span>Flow speed</span>
            <span className="font-mono">{speed}</span>
          </span>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-full mt-1 accent-[var(--accent)]"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-foreground/80 cursor-pointer">
          <input
            type="checkbox"
            checked={wander}
            onChange={(e) => setWander(e.target.checked)}
          />
          Keep extending on its own
        </label>
        <button
          type="button"
          onClick={() => {
            setResetToken((n) => n + 1);
            setSteers(0);
          }}
          className="w-full text-xs rounded-md px-3 py-2 border border-border/60 hover:border-accent/60 transition-colors"
        >
          Start over
        </button>
        <p className="text-[11px] leading-relaxed text-muted border-t border-border/40 pt-3">
          Click anywhere to extend the pipe to that point, deeper into the
          screen. Everything it has drawn stays. Arrow keys extend it too;
          space picks a random point.
        </p>
      </FloatingPanel>

      <p
        aria-live="polite"
        className={`pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs tracking-widest uppercase text-white/70 transition-opacity duration-700 ${
          steers === 0 ? "opacity-100" : "opacity-0"
        }`}
      >
        click anywhere to extend the pipe
      </p>
    </div>
  );
}
