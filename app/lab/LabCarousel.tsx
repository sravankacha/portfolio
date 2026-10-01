"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { splitTo } from "../_components/SplitReveal";
import { EXPERIMENTS } from "./_shared/experiments";
import { prewarm } from "./_shared/prewarm";
import { soundPref, tick } from "./_shared/sound";

/* Lab index: a horizontal strip of preview cards that settles one card in the
   center. Cards ease in scale, depth and tilt by their distance from center.
   Clicking a side card brings it to center; clicking the centered card opens
   it with the diagonal split transition. The page background is a blurred,
   enlarged copy of the centered preview, crossfading on every switch. */
export default function LabCarousel() {
  const router = useRouter();
  const trackRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  // two background layers that swap, so each change crossfades
  const [bg, setBg] = useState<{ a: string; b: string; showA: boolean }>({
    a: EXPERIMENTS[0].thumb,
    b: EXPERIMENTS[0].thumb,
    showA: true,
  });

  // per-frame card styling from scroll position
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0, bestD = Infinity;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const c = el.offsetLeft + el.offsetWidth / 2;
        const d = (c - mid) / el.offsetWidth; // -1 = one card to the left
        if (Math.abs(d) < bestD) {
          bestD = Math.abs(d);
          best = i;
        }
        const a = Math.min(1, Math.abs(d));
        el.style.setProperty("--d", d.toFixed(3));
        el.style.setProperty("--a", a.toFixed(3));
      });
      if (best !== activeRef.current) {
        activeRef.current = best;
        setActive(best);
        tick(); // a detent click each time a card settles in the center
        // crossfade: paint the new preview on the hidden layer, then show it
        const thumb = EXPERIMENTS[best].thumb;
        setBg((p) => (p.showA ? { a: p.a, b: thumb, showA: false } : { a: thumb, b: p.b, showA: true }));
      }
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    track.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      track.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // warm the centered card: route code now, heavy assets once it has rested
  // there briefly (so flicking past cards doesn't download everything)
  useEffect(() => {
    const slug = EXPERIMENTS[active].slug;
    router.prefetch(`/lab/${slug}`);
    const t = window.setTimeout(() => prewarm(slug), 350);
    return () => window.clearTimeout(t);
  }, [active, router]);

  const center = useCallback((i: number) => {
    const el = cardRefs.current[i];
    const track = trackRef.current;
    if (!el || !track) return;
    track.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - track.clientWidth / 2, behavior: "smooth" });
  }, []);

  const open = useCallback(
    (i: number) => {
      const x = EXPERIMENTS[i];
      prewarm(x.slug);
      const card = cardRefs.current[i]?.querySelector<HTMLElement>(".lab-card__hit");
      if (card) splitTo(`/lab/${x.slug}`, x.thumb, card);
      else router.push(`/lab/${x.slug}`);
    },
    [router]
  );

  // arrow keys work anywhere on the page, not just when the strip has focus
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable='true']")) return;
      const i = activeRef.current;
      const last = EXPERIMENTS.length - 1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") center(Math.min(last, i + 1));
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") center(Math.max(0, i - 1));
      else if (e.key === "Home") center(0);
      else if (e.key === "End") center(last);
      else if (e.key === "Enter" || e.key === " ") {
        // let focused links and buttons (nav, dots) keep their own Enter/Space
        if (t && t !== document.body && !t.closest(".lab-track")) return;
        open(i);
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [center, open]);

  const soundOn = useSyncExternalStore(soundPref.subscribe, soundPref.get, () => true);

  const x = EXPERIMENTS[active];

  return (
    <section className="lab-stage" aria-roledescription="carousel" aria-label="Lab experiments">
      <div className="lab-stage__bg" aria-hidden="true">
        <div className="lab-stage__bg-layer" style={{ backgroundImage: `url(${bg.a})`, opacity: bg.showA ? 1 : 0 }} />
        <div className="lab-stage__bg-layer" style={{ backgroundImage: `url(${bg.b})`, opacity: bg.showA ? 0 : 1 }} />
        <div className="lab-stage__veil" />
      </div>

      <ul
        ref={trackRef}
        className="lab-track"
        tabIndex={0}
        aria-label="Use the arrow keys to browse, Enter to open"
      >
        {EXPERIMENTS.map((e, i) => (
          <li
            key={e.slug}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className={`lab-card ${i === active ? "is-active" : ""}`}
            aria-current={i === active ? "true" : undefined}
          >
            <button
              type="button"
              className="lab-card__hit"
              tabIndex={-1}
              onClick={() => (i === active ? open(i) : center(i))}
              aria-label={i === active ? `Open ${e.title}` : `Show ${e.title}`}
            >
              <div className="lab-card__media">
                <Image
                  src={e.thumb}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 560px, 80vw"
                  className="object-cover"
                  loading={i < 3 ? "eager" : "lazy"}
                />
                <span className="lab-card__open">open →</span>
              </div>
              <div className="lab-card__body">
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-2xl font-medium">{e.title}</h2>
                  <span className="font-mono text-[11px] opacity-70 shrink-0">{e.tag}</span>
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div className="lab-stage__caption" aria-live="polite">
        <p className="lab-stage__summary">{x.summary}</p>
        <div className="lab-stage__nav">
          <button type="button" onClick={() => center(Math.max(0, active - 1))} disabled={active === 0} aria-label="Previous experiment">
            ←
          </button>
          <ol className="lab-stage__dots">
            {EXPERIMENTS.map((e, i) => (
              <li key={e.slug}>
                <button
                  type="button"
                  onClick={() => center(i)}
                  aria-label={e.title}
                  aria-current={i === active ? "true" : undefined}
                  className={i === active ? "is-active" : ""}
                />
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => center(Math.min(EXPERIMENTS.length - 1, active + 1))}
            disabled={active === EXPERIMENTS.length - 1}
            aria-label="Next experiment"
          >
            →
          </button>
          <button
            type="button"
            className="lab-stage__sound"
            onClick={() => soundPref.set(!soundOn)}
            aria-pressed={soundOn}
            aria-label={soundOn ? "Mute sounds" : "Turn sounds on"}
            title={soundOn ? "Mute sounds" : "Turn sounds on"}
          >
            {soundOn ? "♪" : "♪̸"}
          </button>
        </div>
        <p className="lab-stage__keys">← → to browse · enter to open</p>
      </div>
    </section>
  );
}
