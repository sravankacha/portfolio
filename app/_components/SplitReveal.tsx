"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";

/* Diagonal split page transition.

   A card's preview grows from where the card sits to fill the screen, the
   app navigates underneath it, and once the new page has had a moment to
   draw, the cover splits along its diagonal and the two halves slide apart
   to reveal it. Lives in the root layout so it survives the route change. */

type Rect = { left: number; top: number; width: number; height: number };
type State =
  | { phase: "idle" }
  | { phase: "grow" | "hold" | "split"; img: string; from: Rect; href: string; id: number };

let state: State = { phase: "idle" };
const listeners = new Set<() => void>();
const set = (s: State) => {
  state = s;
  listeners.forEach((l) => l());
};
let nextId = 1;

/** Start the transition from an element (the card's preview) to href. */
export function splitTo(href: string, img: string, el: Element) {
  const r = el.getBoundingClientRect();
  set({ phase: "grow", img, href, id: nextId++, from: { left: r.left, top: r.top, width: r.width, height: r.height } });
}

const GROW_MS = 520;
const HOLD_MS = 650; // after the route lands: lets WebGL labs draw a first frame
const SPLIT_MS = 1000;

export default function SplitReveal() {
  const s = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
    () => state
  );
  const router = useRouter();
  const pathname = usePathname();
  const coverRef = useRef<HTMLDivElement>(null);

  // grow: FLIP the cover from the card's rect to the full viewport, then navigate
  useEffect(() => {
    if (s.phase !== "grow") return;
    const el = coverRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      router.push(s.href);
      set({ phase: "idle" });
      return;
    }
    const { from } = s;
    const sx = from.width / window.innerWidth;
    const sy = from.height / window.innerHeight;
    el.animate(
      [
        { transform: `translate(${from.left}px, ${from.top}px) scale(${sx}, ${sy})`, borderRadius: "18px" },
        { transform: "translate(0, 0) scale(1, 1)", borderRadius: "0px" },
      ],
      { duration: GROW_MS, easing: "cubic-bezier(.7,0,.2,1)", fill: "forwards" }
    );
    const t = window.setTimeout(() => {
      router.push(s.href);
      set({ ...s, phase: "hold" });
    }, GROW_MS);
    return () => window.clearTimeout(t);
  }, [s, router]);

  // hold until the destination is on screen, then split
  useEffect(() => {
    if (s.phase !== "hold") return;
    const target = s.href.replace(/\/$/, "");
    if (pathname.replace(/\/$/, "") !== target) return;
    const t = window.setTimeout(() => set({ ...s, phase: "split" }), HOLD_MS);
    return () => window.clearTimeout(t);
  }, [s, pathname]);

  useEffect(() => {
    if (s.phase !== "split") return;
    const t = window.setTimeout(() => set({ phase: "idle" }), SPLIT_MS + 50);
    return () => window.clearTimeout(t);
  }, [s]);

  if (s.phase === "idle") return null;
  const split = s.phase === "split";
  const half = (clip: string, dir: 1 | -1) => (
    <div
      className="split-reveal__half"
      style={{
        backgroundImage: `url(${s.img})`,
        clipPath: clip,
        transform: split ? `translate(${dir * 62}%, ${dir * 62}%) rotate(${dir * -3}deg)` : "none",
        transition: `transform ${SPLIT_MS}ms cubic-bezier(.75,0,.15,1)`,
      }}
    />
  );
  return (
    <div className="split-reveal" aria-hidden="true">
      <div ref={coverRef} key={s.id} className="split-reveal__cover">
        {/* the cut runs from bottom-left to top-right; halves part along its normal */}
        {half("polygon(0 0, 100% 0, 0 100%)", -1)}
        {half("polygon(100% 0, 100% 100%, 0 100%)", 1)}
        <div className={`split-reveal__seam ${split ? "is-open" : ""}`} />
      </div>
    </div>
  );
}
