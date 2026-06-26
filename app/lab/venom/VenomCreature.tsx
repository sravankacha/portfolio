"use client";

import { useEffect, useRef } from "react";

/**
 * Sticky-glue Venom creature.
 *
 * - Body: irregular catmull-rom blob with per-vertex wobble (membrane / cloth
 *   feel, not a smooth ellipse)
 * - Tentacles: FILLED tapered paths (wide at the body, sharp tip) — drawn as
 *   two quadratic Beziers joined at the tip and looped back, so the silhouette
 *   reads like stretched sticky goo
 * - Eyes: a small set of sharp white slit ellipses inside the body
 * - Each tentacle re-grips its nearest unused anchor when stretched past reach
 */

const ANCHOR_COUNT = 100;
const TENTACLE_COUNT = 8;
const MAX_REACH = 380;
const BODY_RADIUS = 38;
const BODY_VERTS = 9;
const FOLLOW_TENSION = 0.06;
const FOLLOW_DAMPING = 0.82;

type Vec = { x: number; y: number };

function tentaclePath(
  body: Vec,
  tip: Vec,
  control: Vec,
  baseWidth: number,
): string {
  // Tangent direction from body toward the control point (= initial direction
  // of the centerline Bezier); perpendicular = rotated 90deg
  const tx = control.x - body.x;
  const ty = control.y - body.y;
  const tlen = Math.hypot(tx, ty) || 1;
  const px = -ty / tlen;
  const py = tx / tlen;
  const halfW = baseWidth / 2;

  const bLx = body.x + px * halfW;
  const bLy = body.y + py * halfW;
  const bRx = body.x - px * halfW;
  const bRy = body.y - py * halfW;

  // Outer Bezier control offsets — keeps the membrane taut, narrows toward tip
  const cLx = control.x + px * halfW * 0.35;
  const cLy = control.y + py * halfW * 0.35;
  const cRx = control.x - px * halfW * 0.35;
  const cRy = control.y - py * halfW * 0.35;

  return (
    `M ${bLx.toFixed(1)},${bLy.toFixed(1)} ` +
    `Q ${cLx.toFixed(1)},${cLy.toFixed(1)} ${tip.x.toFixed(1)},${tip.y.toFixed(1)} ` +
    `Q ${cRx.toFixed(1)},${cRy.toFixed(1)} ${bRx.toFixed(1)},${bRy.toFixed(1)} ` +
    `Z`
  );
}

function bodyPath(
  cx: number,
  cy: number,
  radius: number,
  t: number,
  count: number,
): string {
  const pts: Vec[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    // Per-vertex independent wobble (cloth / membrane)
    const wob =
      1 + 0.18 * Math.sin(t * 1.3 + i * 1.7) + 0.06 * Math.cos(t * 2.1 + i * 0.7);
    pts.push({
      x: cx + Math.cos(angle) * radius * wob,
      y: cy + Math.sin(angle) * radius * wob,
    });
  }
  // Catmull-Rom -> cubic Bezier loop for smooth organic outline
  let d = `M ${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} `;
  for (let i = 0; i < count; i++) {
    const p0 = pts[(i - 1 + count) % count];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % count];
    const p3 = pts[(i + 2) % count];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d +=
      `C ${c1x.toFixed(1)},${c1y.toFixed(1)} ` +
      `${c2x.toFixed(1)},${c2y.toFixed(1)} ` +
      `${p2.x.toFixed(1)},${p2.y.toFixed(1)} `;
  }
  return d + "Z";
}

export default function VenomCreature() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return;

    const state = {
      width: 0,
      height: 0,
      blob: { x: 0, y: 0, vx: 0, vy: 0 },
      target: { x: 0, y: 0 },
      anchors: [] as Vec[],
      tentacles: [] as { anchor: number; tipX: number; tipY: number }[],
      time: 0,
    };

    const NS = "http://www.w3.org/2000/svg";

    const anchorGroup = svg.querySelector("#anchors") as SVGGElement;
    const tentacleGroup = svg.querySelector("#tentacles") as SVGGElement;
    const bodyPathEl = svg.querySelector("#body") as SVGPathElement;
    const eye1 = svg.querySelector("#eye1") as SVGEllipseElement;
    const eye2 = svg.querySelector("#eye2") as SVGEllipseElement;
    const eye3 = svg.querySelector("#eye3") as SVGEllipseElement;

    let tentaclePaths: SVGPathElement[] = [];

    const rebuild = () => {
      const rect = container.getBoundingClientRect();
      state.width = rect.width;
      state.height = rect.height;

      state.blob.x = state.width / 2;
      state.blob.y = state.height / 2;
      state.blob.vx = 0;
      state.blob.vy = 0;
      state.target.x = state.blob.x;
      state.target.y = state.blob.y;

      state.anchors = [];
      for (let i = 0; i < ANCHOR_COUNT; i++) {
        let x = 0;
        let y = 0;
        let tries = 0;
        do {
          x = Math.random() * state.width;
          y = Math.random() * state.height;
          tries++;
        } while (
          Math.hypot(x - state.blob.x, y - state.blob.y) < BODY_RADIUS * 1.8 &&
          tries < 5
        );
        state.anchors.push({ x, y });
      }

      while (anchorGroup.firstChild)
        anchorGroup.removeChild(anchorGroup.firstChild);
      state.anchors.forEach((a) => {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", String(a.x));
        c.setAttribute("cy", String(a.y));
        c.setAttribute("r", "1.5");
        c.setAttribute("fill", "currentColor");
        c.setAttribute("opacity", "0.18");
        anchorGroup.appendChild(c);
      });

      while (tentacleGroup.firstChild)
        tentacleGroup.removeChild(tentacleGroup.firstChild);
      tentaclePaths = [];
      state.tentacles = [];
      for (let i = 0; i < TENTACLE_COUNT; i++) {
        state.tentacles.push({
          anchor: -1,
          tipX: state.blob.x,
          tipY: state.blob.y,
        });
        const p = document.createElementNS(NS, "path");
        p.setAttribute("fill", "#0a0a0a");
        tentacleGroup.appendChild(p);
        tentaclePaths.push(p);
      }
    };

    rebuild();

    const ro = new ResizeObserver(rebuild);
    ro.observe(container);

    const point = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      state.target.x = clientX - rect.left;
      state.target.y = clientY - rect.top;
    };
    const onMouse = (e: MouseEvent) => point(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) point(t.clientX, t.clientY);
    };
    container.addEventListener("mousemove", onMouse);
    container.addEventListener("touchmove", onTouch, { passive: true });

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      state.time += dt;

      // Spring follow
      const dx = state.target.x - state.blob.x;
      const dy = state.target.y - state.blob.y;
      state.blob.vx = (state.blob.vx + dx * FOLLOW_TENSION) * FOLLOW_DAMPING;
      state.blob.vy = (state.blob.vy + dy * FOLLOW_TENSION) * FOLLOW_DAMPING;
      state.blob.x += state.blob.vx;
      state.blob.y += state.blob.vy;

      // Body radius is slightly larger when moving fast (sticky stretch)
      const speed = Math.hypot(state.blob.vx, state.blob.vy);
      const stretchFactor = 1 + Math.min(speed * 0.02, 0.25);
      const r = BODY_RADIUS * stretchFactor;

      bodyPathEl.setAttribute(
        "d",
        bodyPath(state.blob.x, state.blob.y, r, state.time, BODY_VERTS),
      );

      // Eyes — small sharp slits in the body
      const dir = Math.atan2(state.blob.vy, state.blob.vx);
      const eyeRot = (dir * 180) / Math.PI - 8;
      const cx1 = state.blob.x - r * 0.18;
      const cy1 = state.blob.y - r * 0.18;
      const cx2 = state.blob.x + r * 0.18;
      const cy2 = state.blob.y - r * 0.18;
      eye1.setAttribute("cx", cx1.toFixed(1));
      eye1.setAttribute("cy", cy1.toFixed(1));
      eye1.setAttribute("transform", `rotate(${(-eyeRot).toFixed(1)} ${cx1.toFixed(1)} ${cy1.toFixed(1)})`);
      eye2.setAttribute("cx", cx2.toFixed(1));
      eye2.setAttribute("cy", cy2.toFixed(1));
      eye2.setAttribute("transform", `rotate(${eyeRot.toFixed(1)} ${cx2.toFixed(1)} ${cy2.toFixed(1)})`);
      // Tiny extra speck
      eye3.setAttribute("cx", (state.blob.x + r * 0.05).toFixed(1));
      eye3.setAttribute("cy", (state.blob.y + r * 0.25).toFixed(1));

      // Tentacles
      for (let i = 0; i < TENTACLE_COUNT; i++) {
        const tt = state.tentacles[i];
        const cur = tt.anchor >= 0 ? state.anchors[tt.anchor] : null;
        const d = cur
          ? Math.hypot(cur.x - state.blob.x, cur.y - state.blob.y)
          : Infinity;
        if (!cur || d > MAX_REACH) {
          const used = new Set<number>();
          for (let j = 0; j < TENTACLE_COUNT; j++) {
            if (j !== i && state.tentacles[j].anchor >= 0)
              used.add(state.tentacles[j].anchor);
          }
          let best = -1;
          let bestD = MAX_REACH;
          for (let k = 0; k < state.anchors.length; k++) {
            if (used.has(k)) continue;
            const a = state.anchors[k];
            const dd = Math.hypot(a.x - state.blob.x, a.y - state.blob.y);
            if (dd < bestD) {
              bestD = dd;
              best = k;
            }
          }
          tt.anchor = best;
        }

        const target =
          tt.anchor >= 0
            ? state.anchors[tt.anchor]
            : { x: state.blob.x, y: state.blob.y };
        tt.tipX += (target.x - tt.tipX) * 0.26;
        tt.tipY += (target.y - tt.tipY) * 0.26;

        // Bezier control point with sag + lateral wobble
        const mx = (state.blob.x + tt.tipX) / 2;
        const my = (state.blob.y + tt.tipY) / 2;
        const linkD = Math.hypot(tt.tipX - state.blob.x, tt.tipY - state.blob.y);
        const sag = Math.min(linkD * 0.13, 50);
        const sway =
          Math.sin(state.time * 3.5 + i * 1.7) * Math.min(linkD * 0.05, 8);
        const cx = mx + sway;
        const cy = my + sag;

        // Base width: wide near the body, taper sharply to the tip
        const baseWidth = Math.max(
          8,
          Math.min(22 - linkD * 0.02, 24),
        );

        tentaclePaths[i].setAttribute(
          "d",
          tentaclePath(
            { x: state.blob.x, y: state.blob.y },
            { x: tt.tipX, y: tt.tipY },
            { x: cx, y: cy },
            baseWidth,
          ),
        );
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("mousemove", onMouse);
      container.removeEventListener("touchmove", onTouch);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden bg-surface border border-border rounded-xl"
      style={{ height: 600, cursor: "none" }}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full text-foreground"
        aria-hidden="true"
      >
        <g id="anchors" />
        {/* tentacles UNDER the body so they appear to emerge from beneath */}
        <g id="tentacles" />
        {/* the cloth-like body */}
        <path id="body" fill="#0a0a0a" />
        {/* small sharp slit eyes + a tiny speck for asymmetry */}
        <ellipse id="eye1" rx="4" ry="0.9" fill="#ffffff" />
        <ellipse id="eye2" rx="4" ry="0.9" fill="#ffffff" />
        <ellipse id="eye3" rx="1.6" ry="0.6" fill="#ffffff" opacity="0.85" />
      </svg>
      <p className="absolute bottom-3 left-4 text-xs text-muted font-mono select-none pointer-events-none">
        move your mouse around the box
      </p>
    </div>
  );
}
