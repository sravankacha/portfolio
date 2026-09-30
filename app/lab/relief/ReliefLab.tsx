"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { BackButton, FloatingPanel } from "../_shared/LabChrome";
import type { ReliefStyle } from "./ReliefCanvas";
import { DEFAULT_REGION, REGIONS } from "./regions";

const ReliefCanvas = dynamic(() => import("./ReliefCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm font-mono text-muted">
      unrolling the map…
    </div>
  ),
});

const GROUPS = ["Continents", "Countries", "Ranges"] as const;
const STYLES: { id: ReliefStyle; label: string }[] = [
  { id: "modern", label: "Modern" },
  { id: "vintage", label: "Vintage" },
  { id: "plaster", label: "Plaster" },
];

// Log slider: 0..1000 maps to 1x..300x
const EX_MAX = 300;
const toSlider = (ex: number) => Math.round((Math.log(ex) / Math.log(EX_MAX)) * 1000);
const fromSlider = (v: number) => Math.pow(EX_MAX, v / 1000);
const fmtEx = (ex: number) => (ex < 10 ? ex.toFixed(1) : Math.round(ex).toString());

const NARROW = "(max-width: 640px)";
function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const isNarrow = () => window.matchMedia(NARROW).matches;

export default function ReliefLab() {
  const narrow = useSyncExternalStore(subscribeNarrow, isNarrow, () => false);
  const [regionId, setRegionId] = useState(DEFAULT_REGION);
  const [exaggeration, setExaggeration] = useState<number | null>(null);
  const [autoEx, setAutoEx] = useState(1);
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  const [sunAzimuth, setSunAzimuth] = useState(315);
  const [sunAltitude, setSunAltitude] = useState(18);
  const [style, setStyle] = useState<ReliefStyle>("modern");
  const [status, setStatus] = useState<string | null>("loading elevation…");

  // Lock page scroll while the fullscreen lab is mounted.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const onLoaded = useCallback((info: { maxHeight: number; autoExaggeration: number }) => {
    setAutoEx(info.autoExaggeration);
    setMaxHeight(info.maxHeight);
  }, []);

  const shownEx = exaggeration ?? autoEx;

  return (
    <div
      className="fixed inset-0 z-40"
      // Printed-paper chrome regardless of the site theme
      style={
        {
          background: "#ecebe6",
          "--background": "#f7f4ee",
          "--foreground": "#23201b",
          "--muted": "#6b6458",
          "--border": "rgba(35, 32, 27, 0.18)",
          "--accent": "#a4553a",
          color: "#23201b",
        } as React.CSSProperties
      }
    >
      <ReliefCanvas
        regionId={regionId}
        exaggeration={exaggeration}
        sunAzimuth={sunAzimuth}
        sunAltitude={sunAltitude}
        style={style}
        onLoaded={onLoaded}
        onProgress={setStatus}
      />
      <BackButton />

      <FloatingPanel
        key={narrow ? "narrow" : "wide"}
        title="Relief"
        top={16}
        width={260}
        defaultOpen={!narrow}
      >
        <label className="block text-xs">
          <span className="text-foreground/80">Region</span>
          <select
            value={regionId}
            onChange={(e) => {
              setRegionId(e.target.value);
              setExaggeration(null); // each region starts at its own sensible scale
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {REGIONS.filter((r) => r.group === g).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="flex justify-between text-foreground/80">
            <span>Vertical exaggeration</span>
            <span className="font-mono">{fmtEx(shownEx)}×</span>
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={toSlider(shownEx)}
            onChange={(e) => setExaggeration(fromSlider(Number(e.target.value)))}
            className="w-full mt-1 accent-[var(--accent)]"
            aria-valuetext={`${fmtEx(shownEx)} times`}
          />
          <span className="flex justify-between text-[10px] text-muted font-mono">
            <span>1× true scale</span>
            <button
              type="button"
              onClick={() => setExaggeration(null)}
              className="underline decoration-dotted hover:text-foreground"
            >
              auto
            </button>
            <span>300×</span>
          </span>
        </label>

        <label className="block text-xs">
          <span className="flex justify-between text-foreground/80">
            <span>Sun direction</span>
            <span className="font-mono">{sunAzimuth}°</span>
          </span>
          <input
            type="range"
            min={0}
            max={359}
            value={sunAzimuth}
            onChange={(e) => setSunAzimuth(Number(e.target.value))}
            className="w-full mt-1 accent-[var(--accent)]"
          />
        </label>

        <label className="block text-xs">
          <span className="flex justify-between text-foreground/80">
            <span>Sun height</span>
            <span className="font-mono">{sunAltitude}°</span>
          </span>
          <input
            type="range"
            min={4}
            max={70}
            value={sunAltitude}
            onChange={(e) => setSunAltitude(Number(e.target.value))}
            className="w-full mt-1 accent-[var(--accent)]"
          />
        </label>

        <div className="text-xs">
          <span className="text-foreground/80">Style</span>
          <div className="mt-1 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Map style">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={style === s.id}
                onClick={() => setStyle(s.id)}
                className={`rounded-md px-2 py-1.5 border transition-colors ${
                  style === s.id ? "border-accent bg-foreground/5" : "border-border hover:border-accent/60"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-[11px] leading-relaxed text-muted border-t border-border pt-3 space-y-1.5">
          {maxHeight !== null && (
            <p className="font-mono text-foreground/80">
              highest point ≈ {Math.round(maxHeight).toLocaleString()} m
            </p>
          )}
          <p>Drag to orbit, right-drag to pan, scroll to zoom.</p>
          <p>
            Elevation: Terrain Tiles on AWS Open Data (SRTM, GMTED, ETOPO1 and
            others). Borders: Natural Earth.
          </p>
        </div>
      </FloatingPanel>

      {status && (
        <p
          aria-live="polite"
          className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono text-xs tracking-widest uppercase text-muted"
        >
          {status}
        </p>
      )}
    </div>
  );
}
