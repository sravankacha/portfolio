"use client";

import { useEffect, useRef } from "react";
import { useThemeId } from "../useThemeId";
import { DISTANCE_MAX, DISTANCE_MIN, helm } from "./helm";

/* The hero slot in the ocean theme: marks where the ship sits and turns drags
   into steering. Left/right turns the ship through 360°, up sends her farther
   out, down brings her closer. Arrow keys do the same. */
export default function ShipHelm() {
  const theme = useThemeId();
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (theme !== "ocean" || !el) return;
    const place = () => {
      const r = el.getBoundingClientRect();
      helm.anchor = { x: r.left + r.width / 2, y: r.top + window.scrollY + r.height * 0.58 };
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(el);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
      helm.anchor = null;
    };
  }, [theme]);

  if (theme !== "ocean") return null;

  const clampDist = (d: number) => Math.min(DISTANCE_MAX, Math.max(DISTANCE_MIN, d));

  return (
    <div
      ref={ref}
      className="ship-helm"
      role="application"
      tabIndex={0}
      aria-label="Pirate ship. Drag left or right to turn her, up or down to sail farther or closer. Arrow keys work too."
      onPointerDown={(e) => {
        last.current = { x: e.clientX, y: e.clientY };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const p = last.current;
        if (!p) return;
        helm.heading += (e.clientX - p.x) * 0.012;
        helm.distance = clampDist(helm.distance * Math.exp(-(e.clientY - p.y) * 0.006));
        last.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => (last.current = null)}
      onPointerCancel={() => (last.current = null)}
      onKeyDown={(e) => {
        const k = e.key;
        if (k === "ArrowLeft") helm.heading -= 0.2;
        else if (k === "ArrowRight") helm.heading += 0.2;
        else if (k === "ArrowUp") helm.distance = clampDist(helm.distance * 1.15);
        else if (k === "ArrowDown") helm.distance = clampDist(helm.distance / 1.15);
        else return;
        e.preventDefault();
      }}
    >
      <span className="ship-helm__hint">drag to steer · up / down to sail out or in</span>
    </div>
  );
}
