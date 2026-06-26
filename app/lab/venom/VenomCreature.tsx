"use client";

import { useEffect, useRef } from "react";

/**
 * A sticky, tentacled creature.
 *
 * - Anchor points are scattered randomly across the box at mount.
 * - A blob follows the cursor via spring-damped motion.
 * - Each frame, each tentacle slot picks the NEAREST UNUSED anchor within
 *   reach (greedy NN; fast enough for ~100 anchors). When the blob moves out
 *   of range, the tentacle releases and re-grips a closer one — visible as a
 *   quick snap.
 * - The tentacle "tip" lerps toward the chosen anchor so reattachment looks
 *   like an elastic whip rather than a teleport.
 * - Each tentacle is drawn as a quadratic Bezier whose control point sags
 *   downward (gravity) and wobbles laterally over time (rubber).
 * - The blob is an ellipse that squashes along its motion direction, with a
 *   small sine wobble baked in to keep it alive when idle.
 */

const ANCHOR_COUNT = 90;
const TENTACLE_COUNT = 5;
const MAX_REACH = 380;
const BLOB_RADIUS = 32;
const FOLLOW_TENSION = 0.06;
const FOLLOW_DAMPING = 0.82;

type Vec = { x: number; y: number };

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
    const blob = svg.querySelector("#blob") as SVGEllipseElement;
    const highlight = svg.querySelector("#highlight") as SVGEllipseElement;

    let tentaclePaths: SVGPathElement[] = [];
    let tentacleTips: SVGCircleElement[] = [];

    const rebuild = () => {
      const rect = container.getBoundingClientRect();
      state.width = rect.width;
      state.height = rect.height;

      // Reset blob to center
      state.blob.x = state.width / 2;
      state.blob.y = state.height / 2;
      state.blob.vx = 0;
      state.blob.vy = 0;
      state.target.x = state.blob.x;
      state.target.y = state.blob.y;

      // Scatter anchors, avoiding a band right around the blob start
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
          Math.hypot(x - state.blob.x, y - state.blob.y) < BLOB_RADIUS * 2 &&
          tries < 5
        );
        state.anchors.push({ x, y });
      }

      // Render anchor dots once
      while (anchorGroup.firstChild) anchorGroup.removeChild(anchorGroup.firstChild);
      state.anchors.forEach((a) => {
        const c = document.createElementNS(NS, "circle");
        c.setAttribute("cx", String(a.x));
        c.setAttribute("cy", String(a.y));
        c.setAttribute("r", "1.5");
        c.setAttribute("fill", "currentColor");
        c.setAttribute("opacity", "0.22");
        anchorGroup.appendChild(c);
      });

      // Reset tentacle elements
      while (tentacleGroup.firstChild)
        tentacleGroup.removeChild(tentacleGroup.firstChild);
      tentaclePaths = [];
      tentacleTips = [];
      state.tentacles = [];
      for (let i = 0; i < TENTACLE_COUNT; i++) {
        state.tentacles.push({
          anchor: -1,
          tipX: state.blob.x,
          tipY: state.blob.y,
        });

        const p = document.createElementNS(NS, "path");
        p.setAttribute("fill", "none");
        p.setAttribute("stroke", "#0a0a0a");
        p.setAttribute("stroke-width", "5");
        p.setAttribute("stroke-linecap", "round");
        tentacleGroup.appendChild(p);
        tentaclePaths.push(p);

        const tip = document.createElementNS(NS, "circle");
        tip.setAttribute("r", "4");
        tip.setAttribute("fill", "#0a0a0a");
        tentacleGroup.appendChild(tip);
        tentacleTips.push(tip);
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

      // Spring follow with damping
      const dx = state.target.x - state.blob.x;
      const dy = state.target.y - state.blob.y;
      state.blob.vx = (state.blob.vx + dx * FOLLOW_TENSION) * FOLLOW_DAMPING;
      state.blob.vy = (state.blob.vy + dy * FOLLOW_TENSION) * FOLLOW_DAMPING;
      state.blob.x += state.blob.vx;
      state.blob.y += state.blob.vy;

      // Squash + idle wobble
      const speed = Math.hypot(state.blob.vx, state.blob.vy);
      const stretch = 1 + Math.min(speed * 0.025, 0.45);
      const squish = 1 / Math.sqrt(stretch);
      const wob = Math.sin(state.time * 2.6) * 0.05;
      const rx = BLOB_RADIUS * (stretch + wob);
      const ry = BLOB_RADIUS * (squish - wob);
      const angle = (Math.atan2(state.blob.vy, state.blob.vx) * 180) / Math.PI;

      blob.setAttribute("cx", String(state.blob.x));
      blob.setAttribute("cy", String(state.blob.y));
      blob.setAttribute("rx", String(rx));
      blob.setAttribute("ry", String(ry));
      blob.setAttribute(
        "transform",
        `rotate(${angle} ${state.blob.x} ${state.blob.y})`,
      );

      highlight.setAttribute(
        "cx",
        String(state.blob.x - rx * 0.35 * Math.cos((angle * Math.PI) / 180)),
      );
      highlight.setAttribute(
        "cy",
        String(state.blob.y - ry * 0.55 - rx * 0.35 * Math.sin((angle * Math.PI) / 180)),
      );
      highlight.setAttribute("rx", String(rx * 0.32));
      highlight.setAttribute("ry", String(ry * 0.18));

      // Re-pick tentacle anchors when out of reach
      for (let i = 0; i < TENTACLE_COUNT; i++) {
        const t = state.tentacles[i];
        const current = t.anchor >= 0 ? state.anchors[t.anchor] : null;
        const d = current
          ? Math.hypot(current.x - state.blob.x, current.y - state.blob.y)
          : Infinity;
        if (!current || d > MAX_REACH) {
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
          t.anchor = best;
        }

        // Elastic tip lerp toward (re-)attachment point
        const target =
          t.anchor >= 0
            ? state.anchors[t.anchor]
            : { x: state.blob.x, y: state.blob.y };
        t.tipX += (target.x - t.tipX) * 0.26;
        t.tipY += (target.y - t.tipY) * 0.26;

        // Bezier with gravity sag + lateral wobble
        const mx = (state.blob.x + t.tipX) / 2;
        const my = (state.blob.y + t.tipY) / 2;
        const linkD = Math.hypot(t.tipX - state.blob.x, t.tipY - state.blob.y);
        const sag = Math.min(linkD * 0.16, 55);
        const sway = Math.sin(state.time * 4 + i * 1.7) *
          Math.min(linkD * 0.06, 10);
        const cx = mx + sway;
        const cy = my + sag;
        const w = Math.max(1.6, 7 - linkD * 0.014);

        tentaclePaths[i].setAttribute(
          "d",
          `M ${state.blob.x.toFixed(1)},${state.blob.y.toFixed(1)} ` +
            `Q ${cx.toFixed(1)},${cy.toFixed(1)} ${t.tipX.toFixed(1)},${t.tipY.toFixed(1)}`,
        );
        tentaclePaths[i].setAttribute("stroke-width", w.toFixed(2));
        tentacleTips[i].setAttribute("cx", t.tipX.toFixed(1));
        tentacleTips[i].setAttribute("cy", t.tipY.toFixed(1));
        tentacleTips[i].setAttribute("r", (w * 0.7).toFixed(2));
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
      <svg ref={svgRef} className="absolute inset-0 w-full h-full text-foreground" aria-hidden="true">
        <g id="anchors" />
        <g id="tentacles" />
        <ellipse id="blob" rx="32" ry="32" fill="#0a0a0a" />
        <ellipse id="highlight" rx="10" ry="5" fill="white" opacity="0.18" />
      </svg>
      <p className="absolute bottom-3 left-4 text-xs text-muted font-mono select-none pointer-events-none">
        move your mouse around the box
      </p>
    </div>
  );
}
