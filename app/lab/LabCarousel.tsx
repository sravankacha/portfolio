"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { splitTo } from "../_components/SplitReveal";
import { EXPERIMENTS } from "./_shared/experiments";

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

  // warm the route for the centered card so opening it is instant
  useEffect(() => {
    router.prefetch(`/lab/${EXPERIMENTS[active].slug}`);
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
      const img = cardRefs.current[i]?.querySelector(".lab-card__media");
      if (img) splitTo(`/lab/${x.slug}`, x.thumb, img);
      else router.push(`/lab/${x.slug}`);
    },
    [router]
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") center(Math.min(EXPERIMENTS.length - 1, active + 1));
    else if (e.key === "ArrowLeft") center(Math.max(0, active - 1));
    else if (e.key === "Enter" || e.key === " ") open(active);
    else return;
    e.preventDefault();
  };

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
        onKeyDown={onKey}
        aria-label="Use left and right arrow keys to browse, Enter to open"
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
        </div>
      </div>
    </section>
  );
}
