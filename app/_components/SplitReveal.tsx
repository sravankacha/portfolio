"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { snap } from "../lab/_shared/sound";

/* The card breaks open.

   The clicked card is cloned into two halves along a jagged diagonal crack.
   A blurred backdrop (the same look as the lab page) covers the screen while
   the route changes underneath, so the swap is never seen. As soon as the
   experiment has drawn, the halves fly apart and the backdrop fades, which
   reveals the live page. Lives in the root layout so it survives navigation.

   Experiments mark loading UI with [data-lab-loading]; "drawn" means no such
   element is left (capped, so a slow network never traps the visitor). */

type Rect = { left: number; top: number; width: number; height: number };
type Active = { phase: "crack" | "wait" | "break"; href: string; img: string; rect: Rect; card: HTMLElement; id: number };
type State = { phase: "idle" } | Active;

let state: State = { phase: "idle" };
const listeners = new Set<() => void>();
const set = (s: State) => {
  state = s;
  listeners.forEach((l) => l());
};
let nextId = 1;

/** Break `card` open and navigate to href. `img` paints the backdrop. */
export function splitTo(href: string, img: string, card: HTMLElement) {
  if (state.phase !== "idle") return;
  const r = card.getBoundingClientRect();
  set({
    phase: "crack",
    href,
    img,
    card,
    id: nextId++,
    rect: { left: r.left, top: r.top, width: r.width, height: r.height },
  });
}

const CRACK_MS = 280; // crack draws, backdrop fades in; then navigate
const MIN_WAIT_MS = 120;
const MAX_WAIT_MS = 4000;
const BREAK_MS = 900;

// A jagged crack from the top-right corner to the bottom-left, in 0..100 units
function crackPath(seed: number): [number, number][] {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const pts: [number, number][] = [[100, 0]];
  const N = 9;
  for (let i = 1; i < N; i++) {
    const t = i / N;
    const j = (rnd() - 0.5) * 9; // perpendicular jitter
    pts.push([100 * (1 - t) + j, 100 * t + j]);
  }
  pts.push([0, 100]);
  return pts;
}

export default function SplitReveal() {
  const s = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
    () => state
  );
  const router = useRouter();
  const pathname = usePathname();
  const halfA = useRef<HTMLDivElement>(null);
  const halfB = useRef<HTMLDivElement>(null);

  // mount the card clones into each half
  const id = s.phase === "idle" ? 0 : s.id;
  useEffect(() => {
    if (s.phase !== "crack") return;
    for (const half of [halfA.current, halfB.current]) {
      if (!half) continue;
      half.replaceChildren();
      const clone = s.card.cloneNode(true) as HTMLElement;
      clone.style.width = "100%";
      clone.style.height = "100%";
      clone.style.transform = "none";
      half.appendChild(clone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // crack → navigate
  useEffect(() => {
    if (s.phase !== "crack") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(s.href);
      set({ phase: "idle" });
      return;
    }
    const t = window.setTimeout(() => {
      router.push(s.href);
      set({ ...s, phase: "wait" });
    }, CRACK_MS);
    return () => window.clearTimeout(t);
  }, [s, router]);

  // wait for the experiment to draw, then break
  useEffect(() => {
    if (s.phase !== "wait") return;
    if (pathname.replace(/\/$/, "") !== s.href.replace(/\/$/, "")) return;
    const t0 = performance.now();
    let raf = 0, frames = 0;
    const check = () => {
      const elapsed = performance.now() - t0;
      const loading = document.querySelector("[data-lab-loading]");
      frames = loading ? 0 : frames + 1;
      // two clean frames after loading UI is gone means the scene has painted
      if ((frames >= 3 && elapsed > MIN_WAIT_MS) || elapsed > MAX_WAIT_MS) {
        snap();
        set({ ...s, phase: "break" });
        return;
      }
      raf = requestAnimationFrame(check);
    };
    raf = requestAnimationFrame(check);
    return () => cancelAnimationFrame(raf);
  }, [s, pathname]);

  useEffect(() => {
    if (s.phase !== "break") return;
    const t = window.setTimeout(() => set({ phase: "idle" }), BREAK_MS + 60);
    return () => window.clearTimeout(t);
  }, [s]);

  if (s.phase === "idle") return null;

  const crack = crackPath(s.id);
  const line = crack.map(([x, y]) => `${x}% ${y}%`).join(", ");
  const clipA = `polygon(0% 0%, ${line}, 0% 100%)`; // top-left half
  const clipB = `polygon(100% 0%, 100% 100%, ${[...crack].reverse().map(([x, y]) => `${x}% ${y}%`).join(", ")})`;
  // fly apart along the crack's normal (screen space), with a twist
  const { width: w, height: h } = s.rect;
  const len = Math.hypot(w, h) || 1;
  const D = Math.max(window.innerWidth, window.innerHeight) * 0.75;
  const nx = (-h / len) * D, ny = (-w / len) * D;
  const breaking = s.phase === "break";
  const halfStyle = (dir: 1 | -1, clip: string): React.CSSProperties => ({
    clipPath: clip,
    transform: breaking ? `translate(${dir * nx}px, ${dir * ny}px) rotate(${dir * -9}deg)` : "none",
    opacity: breaking ? 0 : 1,
    transition: `transform ${BREAK_MS}ms cubic-bezier(.6,0,.2,1), opacity ${BREAK_MS * 0.5}ms ease ${BREAK_MS * 0.45}ms`,
  });

  return (
    <div className="split-reveal" aria-hidden="true">
      <div className={`split-reveal__backdrop ${breaking ? "is-out" : ""}`}>
        <div className="split-reveal__backdrop-img" style={{ backgroundImage: `url(${s.img})` }} />
        <div className="split-reveal__backdrop-veil" />
      </div>
      <div
        className={`split-reveal__card ${s.phase === "wait" ? "is-waiting" : ""}`}
        style={{ left: s.rect.left, top: s.rect.top, width: s.rect.width, height: s.rect.height }}
      >
        <div ref={halfA} className="split-reveal__half" style={halfStyle(1, clipA)} />
        <div ref={halfB} className="split-reveal__half" style={halfStyle(-1, clipB)} />
        {/* drawn in pixels so the stroke stays even and the draw-on dash is exact */}
        <svg className={`split-reveal__crack ${breaking ? "is-out" : ""}`} viewBox={`0 0 ${w} ${h}`}>
          <polyline points={crack.map(([x, y]) => `${(x / 100) * w},${(y / 100) * h}`).join(" ")} pathLength={1} />
        </svg>
      </div>
    </div>
  );
}
