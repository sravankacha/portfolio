"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { FFTParams } from "../../_components/FFTOceanCanvas";
import { BackButton, FloatingPanel } from "../_shared/LabChrome";

// Lazy: only fetches Three.js from CDN when this page is open.
const FFTOceanCanvas = dynamic(() => import("../../_components/FFTOceanCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-muted text-sm font-mono">
      loading shader…
    </div>
  ),
});

const DEFAULTS: FFTParams = {
  windX: 12,
  windZ: 12,
  size: 250,
  choppiness: 2.3,
};

export default function WaveControls() {
  const [p, setP] = useState<FFTParams>(DEFAULTS);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const update = <K extends keyof FFTParams>(key: K, value: FFTParams[K]) =>
    setP((prev) => ({ ...prev, [key]: value }));

  const windSpeed = Math.hypot(p.windX, p.windZ);

  return (
    <div className="fixed inset-0 z-40 bg-background">
      <FFTOceanCanvas params={p} transparent={false} />
      <BackButton />

      <FloatingPanel title="FFT ocean" top={16} width={300}>
        <Header label="Wind" />
        <Slider label="X (m/s)" min={-30} max={30} step={0.5} value={p.windX} onChange={(v) => update("windX", v)} />
        <Slider label="Z (m/s)" min={-30} max={30} step={0.5} value={p.windZ} onChange={(v) => update("windZ", v)} />
        <p className="text-[10px] text-muted font-mono">
          ‖wind‖ = {windSpeed.toFixed(1)} m/s
        </p>

        <Header label="Patch size" />
        <Slider label="Tiles (m)" min={50} max={500} step={10} value={p.size} onChange={(v) => update("size", v)} />

        <Header label="Chop" />
        <Slider label="Choppiness" min={0} max={4} step={0.05} value={p.choppiness} onChange={(v) => update("choppiness", v)} />

        <button
          type="button"
          onClick={() => setP(DEFAULTS)}
          className="w-full font-mono text-xs uppercase tracking-widest border border-border rounded-md py-2 hover:border-accent transition-colors"
        >
          Reset
        </button>
      </FloatingPanel>

      <FloatingPanel title="About" top={460} width={300} defaultOpen={false}>
        <p className="text-xs text-foreground/85 leading-relaxed">
          Tessendorf FFT ocean — same shader powering the{" "}
          <span className="font-mono">ocean</span> theme. JONSWAP spectrum,
          phase ping-pong each frame, Stockham radix-2 FFT in fragment shaders.
          Toggle the ocean theme from the footer to see it as a full-screen
          background.
        </p>
      </FloatingPanel>
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
