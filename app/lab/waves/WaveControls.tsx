"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { WaveParams } from "../../_components/OceanCanvas";

// Lazy: only fetches Three.js from CDN when this page is open.
const OceanCanvas = dynamic(() => import("../../_components/OceanCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-muted text-sm font-mono">
      loading shader…
    </div>
  ),
});

const DEFAULTS: WaveParams = {
  steepness1: 0.2,
  steepness2: 0.14,
  steepness3: 0.1,
  speed: 1,
  sunAzimuth: 35,
  sunElevation: 45,
};

export default function WaveControls() {
  const [p, setP] = useState<WaveParams>(DEFAULTS);

  const update = <K extends keyof WaveParams>(key: K, value: WaveParams[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="aspect-square w-full relative rounded-xl overflow-hidden bg-surface border border-border">
        <OceanCanvas params={p} transparent={false} />
      </div>

      <div className="space-y-5 bg-surface border border-border rounded-xl p-5">
        <Header label="Wave steepness" />
        <Slider label="Primary"   min={0} max={0.4} step={0.005} value={p.steepness1} onChange={(v) => update("steepness1", v)} />
        <Slider label="Secondary" min={0} max={0.4} step={0.005} value={p.steepness2} onChange={(v) => update("steepness2", v)} />
        <Slider label="Tertiary"  min={0} max={0.4} step={0.005} value={p.steepness3} onChange={(v) => update("steepness3", v)} />

        <Header label="Animation" />
        <Slider label="Speed" min={0} max={3} step={0.05} value={p.speed} onChange={(v) => update("speed", v)} />

        <Header label="Sun" />
        <Slider label="Azimuth°"   min={0}  max={360} step={1} value={p.sunAzimuth}   onChange={(v) => update("sunAzimuth", v)} />
        <Slider label="Elevation°" min={5}  max={85}  step={1} value={p.sunElevation} onChange={(v) => update("sunElevation", v)} />

        <button
          type="button"
          onClick={() => setP(DEFAULTS)}
          className="mt-2 w-full font-mono text-xs uppercase tracking-widest border border-border rounded-md py-2 hover:border-accent"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Header({ label }: { label: string }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-widest text-muted pt-1">
      {label}
    </p>
  );
}

function Slider({
  label, min, max, step, value, onChange,
}: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="font-mono text-muted">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full"
        style={{ accentColor: "var(--accent)" }}
      />
    </label>
  );
}
