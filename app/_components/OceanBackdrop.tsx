/**
 * Ocean theme footer fish — a small school of SVG fish drifting across the
 * footer. WebGL waves render behind the page via OceanCanvasGate; these are
 * the cosmetic foreground critters. Rendered for all themes but hidden via
 * CSS unless [data-theme="ocean"].
 */
export function OceanFishSchool() {
  return (
    <div className="ocean-fish" aria-hidden="true">
      {[
        { size: 22, top: "30%", duration: 32, delay: 0, opacity: 0.7 },
        { size: 14, top: "55%", duration: 44, delay: -10, opacity: 0.5 },
        { size: 18, top: "75%", duration: 38, delay: -20, opacity: 0.6 },
        { size: 10, top: "20%", duration: 50, delay: -28, opacity: 0.35 },
      ].map((f, i) => (
        <svg
          key={i}
          className="ocean-fish__one"
          width={f.size}
          height={f.size}
          viewBox="0 0 24 16"
          style={{
            top: f.top,
            animationDuration: `${f.duration}s`,
            animationDelay: `${f.delay}s`,
            opacity: f.opacity,
          }}
        >
          <path
            d="M2 8 Q 6 2, 14 4 Q 20 6, 22 8 Q 20 10, 14 12 Q 6 14, 2 8 Z"
            fill="currentColor"
          />
          <path d="M2 8 L 0 4 L 0 12 Z" fill="currentColor" opacity="0.6" />
          <circle cx="16" cy="7" r="0.9" fill="#fff" opacity="0.8" />
        </svg>
      ))}
    </div>
  );
}
