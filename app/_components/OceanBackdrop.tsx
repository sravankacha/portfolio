/**
 * Ocean theme decor: layered SVG waves as page background and a small school of
 * swimming fish that drift across the footer. Renders for all themes but is
 * hidden via CSS unless [data-theme="ocean"].
 */
export default function OceanBackdrop() {
  return (
    <>
      <div className="ocean-waves" aria-hidden="true">
        <svg
          className="ocean-waves__layer ocean-waves__layer--far"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
        >
          <path d="M0,100 C240,160 480,40 720,80 C960,120 1200,180 1440,100 L1440,200 L0,200 Z" />
          <path d="M0,100 C240,160 480,40 720,80 C960,120 1200,180 1440,100 L1440,200 L0,200 Z" transform="translate(1440 0)" />
        </svg>
        <svg
          className="ocean-waves__layer ocean-waves__layer--mid"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
        >
          <path d="M0,120 C180,180 420,70 720,110 C1020,150 1260,200 1440,140 L1440,200 L0,200 Z" />
          <path d="M0,120 C180,180 420,70 720,110 C1020,150 1260,200 1440,140 L1440,200 L0,200 Z" transform="translate(1440 0)" />
        </svg>
        <svg
          className="ocean-waves__layer ocean-waves__layer--near"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
        >
          <path d="M0,140 C240,200 540,90 720,130 C900,170 1200,210 1440,160 L1440,200 L0,200 Z" />
          <path d="M0,140 C240,200 540,90 720,130 C900,170 1200,210 1440,160 L1440,200 L0,200 Z" transform="translate(1440 0)" />
        </svg>
      </div>
    </>
  );
}

export function OceanFishSchool() {
  // Small reusable fish SVG repeated with different sizes/depths/speeds
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
