"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import type { OceanView } from "./FFTOceanCanvas";
import { useThemeId } from "./useThemeId";

const FFTOceanCanvas = dynamic(() => import("./FFTOceanCanvas"), { ssr: false });

const SIZE = 250; // patch size in meters (world units)
const HALF = SIZE / 2;
const WIND_SPEED = 14.1; // m/s — david.li's defaults
const CHOPPINESS = 1.5;

/* A single patch of simulated ocean presented like a specimen in a technical
   drawing, after david.li/waves: thin ink annotations for size and wind sit on
   the ground plane around it, and the wind arrow can be dragged to turn the wind. */
export default function OceanSpecimen() {
  const theme = useThemeId();
  const [view, setView] = useState<OceanView | null>(null);
  const [windAngle, setWindAngle] = useState(Math.PI / 4);
  const dragging = useRef(false);

  const params = useMemo(
    () => ({
      size: SIZE,
      choppiness: CHOPPINESS,
      windX: Math.cos(windAngle) * WIND_SPEED,
      windZ: Math.sin(windAngle) * WIND_SPEED,
    }),
    [windAngle]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<SVGElement>) => {
      if (!dragging.current || !view) return;
      const rect = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect();
      const g = view.ground(e.clientX - rect.left, e.clientY - rect.top);
      if (!g) return;
      const [cx, cz] = ARROW_CENTER;
      setWindAngle(Math.atan2(g[1] - cz, g[0] - cx));
    },
    [view]
  );

  if (theme !== "ocean") return null;

  return (
    <div className="ocean-specimen">
      <FFTOceanCanvas variant="specimen" params={params} onView={setView} />
      {view && (
        <Annotations
          view={view}
          windAngle={windAngle}
          onArrowDown={(e) => {
            dragging.current = true;
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
          }}
          onArrowMove={onPointerMove}
          onArrowUp={() => (dragging.current = false)}
          onKeyTurn={(d) => setWindAngle((a) => a + d)}
        />
      )}
    </div>
  );
}

const ARROW_CENTER: [number, number] = [-HALF - 48, 40];

function Annotations({
  view,
  windAngle,
  onArrowDown,
  onArrowMove,
  onArrowUp,
  onKeyTurn,
}: {
  view: OceanView;
  windAngle: number;
  onArrowDown: (e: React.PointerEvent<SVGElement>) => void;
  onArrowMove: (e: React.PointerEvent<SVGElement>) => void;
  onArrowUp: () => void;
  onKeyTurn: (delta: number) => void;
}) {
  const P = (x: number, z: number) => view.project(x, 0, z);
  const pts = (list: [number, number][]) => list.map(([x, z]) => P(x, z).join(",")).join(" ");
  const angleOf = (a: [number, number], b: [number, number]) =>
    (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

  // Size scale runs along the front edge, just off the water
  const zLine = HALF + 26;
  const s0 = P(-HALF, zLine);
  const s1 = P(HALF, zLine);
  const sMid = P(0, zLine + 16);
  const sAngle = angleOf(s0, s1);

  // Wind arrow lies flat on the ground beside the patch, pointing downwind
  const [cx, cz] = ARROW_CENTER;
  const c = Math.cos(windAngle), s = Math.sin(windAngle);
  const rot = (u: number, v: number): [number, number] => [cx + u * c - v * s, cz + u * s + v * c];
  const L = 46, W = 15;
  const arrow: [number, number][] = [
    rot(-L, -W * 0.45), rot(L * 0.25, -W * 0.45), rot(L * 0.2, -W), rot(L, 0),
    rot(L * 0.2, W), rot(L * 0.25, W * 0.45), rot(-L, W * 0.45), rot(-L * 0.7, 0),
  ];
  const windLabel = P(cx, cz + 48);

  // Choppiness glyph floats above the back-left corner
  const chop = P(-HALF - 10, -HALF - 30);

  return (
    <svg
      className="ocean-specimen__notes"
      width={view.width}
      height={view.height}
      role="group"
      aria-label="Ocean simulation: 250 metre patch. Drag the wind arrow, or focus it and use arrow keys, to turn the wind."
    >
      <g className="ocean-specimen__ink">
        <line x1={s0[0]} y1={s0[1]} x2={s1[0]} y2={s1[1]} />
        {[[-HALF, zLine - 6, zLine + 6], [HALF, zLine - 6, zLine + 6]].map(([x, a, b]) => {
          const p = P(x, a), q = P(x, b);
          return <line key={x} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} />;
        })}
      </g>
      <text
        className="ocean-specimen__label"
        transform={`translate(${sMid[0]} ${sMid[1]}) rotate(${sAngle}) skewX(-12)`}
        textAnchor="middle"
      >
        <tspan className="ocean-specimen__value">{SIZE} m</tspan>
        <tspan x="0" dy="1.15em">SIZE</tspan>
      </text>

      <polygon
        className="ocean-specimen__arrow"
        points={pts(arrow)}
        role="slider"
        tabIndex={0}
        aria-label="Wind direction"
        aria-valuenow={Math.round(((windAngle * 180) / Math.PI + 360) % 360)}
        aria-valuemin={0}
        aria-valuemax={359}
        onPointerDown={onArrowDown}
        onPointerMove={onArrowMove}
        onPointerUp={onArrowUp}
        onPointerCancel={onArrowUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") onKeyTurn(-0.15);
          if (e.key === "ArrowRight" || e.key === "ArrowUp") onKeyTurn(0.15);
        }}
      />
      <text
        className="ocean-specimen__label"
        transform={`translate(${windLabel[0]} ${windLabel[1]}) rotate(${sAngle}) skewX(-12)`}
        textAnchor="middle"
      >
        <tspan className="ocean-specimen__value">{WIND_SPEED} m/s</tspan>
        <tspan x="0" dy="1.15em">WIND · drag me</tspan>
      </text>

      <g transform={`translate(${chop[0]} ${chop[1] - 54})`}>
        <path
          className="ocean-specimen__glyph"
          d="M-40 10 C -32 10, -30 -14, -26 -14 C -22 -14, -22 10, -12 10 C -4 10, -2 -14, 2 -14 C 6 -14, 6 10, 16 10 C 24 10, 26 -14, 30 -14 C 34 -14, 34 10, 42 10"
        />
        <text className="ocean-specimen__label" y="30" textAnchor="middle" transform="skewX(-12)">
          <tspan className="ocean-specimen__value">{CHOPPINESS}</tspan>
          <tspan x="0" dy="1.15em">CHOPPINESS</tspan>
        </text>
      </g>
    </svg>
  );
}
