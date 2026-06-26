"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BackButton, FloatingPanel } from "../_shared/LabChrome";
import { DATASETS, type DatasetId } from "./datasets";

const GlobeCanvas = dynamic(() => import("./GlobeCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-muted text-sm font-mono">
      loading globe…
    </div>
  ),
});

const ORDER: DatasetId[] = ["earthquakes", "volcanoes", "iss", "population"];

export default function GlobeLab() {
  const [dataset, setDataset] = useState<DatasetId>("earthquakes");
  const [count, setCount] = useState<number>(0);

  // Lock page scroll while the fullscreen lab is mounted.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const meta = DATASETS[dataset];

  return (
    <div className="fixed inset-0 z-40 bg-background">
      <GlobeCanvas dataset={dataset} onCount={setCount} />
      <BackButton />

      <FloatingPanel title="Dataset" top={16}>
        <div className="grid grid-cols-1 gap-1.5">
          {ORDER.map((id) => {
            const d = DATASETS[id];
            const active = id === dataset;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setDataset(id)}
                className={`text-left text-sm rounded-md px-3 py-2 border transition-colors ${
                  active
                    ? "border-accent text-foreground bg-foreground/5"
                    : "border-border/60 text-foreground/75 hover:border-accent/60"
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: d.color,
                      boxShadow: `0 0 8px ${d.color}80`,
                    }}
                    aria-hidden
                  />
                  <span className="flex-1">{d.label}</span>
                  {d.livePollMs && (
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted">
                      live
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <div className="text-xs leading-relaxed pt-2 border-t border-border/40">
          <p className="text-foreground/85">{meta.label}</p>
          <p className="text-muted mt-0.5">
            {meta.source} · {meta.unit}
          </p>
          <p className="font-mono text-foreground/90 mt-2">
            {count.toLocaleString()} point{count === 1 ? "" : "s"}
          </p>
        </div>
      </FloatingPanel>

      <FloatingPanel title="Globe" top={360} defaultOpen={false}>
        <p className="text-xs text-foreground/80 leading-relaxed">
          Drag-rotatable 3D globe with country borders from Natural Earth.
          Public datasets project as spikes — height tracks magnitude,
          intensity ramps light → dark with the value.
        </p>
        <ul className="text-xs text-foreground/75 space-y-1 font-mono">
          <li>drag · rotate</li>
          <li>scroll · zoom</li>
          <li>hover spike · details</li>
        </ul>
      </FloatingPanel>
    </div>
  );
}
