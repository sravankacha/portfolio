import { profile } from "./_data/profile";
import EmailLink from "./_components/EmailLink";

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
      <section className="grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-14 items-center mb-28">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted mb-5">
            Hola — I am
          </p>
          <h1 className="hero-title text-5xl sm:text-6xl md:text-7xl leading-[1.05] mb-6">
            Sravan
            <br />
            Kachavarapu
          </h1>
          <p className="inline-block font-mono text-xs px-2.5 py-1 rounded-full border border-border bg-surface text-foreground mb-6">
            {profile.tagline}
          </p>
          <p className="text-lg text-foreground/85 leading-relaxed max-w-md">
            {profile.bio}
          </p>
          <p className="mt-6 text-sm text-muted">
            <span aria-hidden>☼ </span>
            {profile.location}
          </p>
        </div>

        <div className="hero-art order-first md:order-last" aria-hidden="true">
          <div className="hero-art__editorial">
            <div className="hero-art__editorial-halo" />
            <div className="hero-art__editorial-shape" />
          </div>
          <div className="hero-art__ocean">
            <svg
              viewBox="0 0 200 200"
              className="hero-art__ocean-compass"
              aria-hidden="true"
            >
              <defs>
                <radialGradient id="ocean-compass-bg" cx="50%" cy="50%" r="55%">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </radialGradient>
                <linearGradient
                  id="ocean-compass-needle"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#ffd166" />
                  <stop offset="50%" stopColor="#ffd166" />
                  <stop offset="50.01%" stopColor="#90e0ef" />
                  <stop offset="100%" stopColor="#90e0ef" />
                </linearGradient>
              </defs>
              <circle cx="100" cy="100" r="96" fill="url(#ocean-compass-bg)" />
              <circle
                cx="100"
                cy="100"
                r="88"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.8"
                opacity="0.45"
              />
              <circle
                cx="100"
                cy="100"
                r="82"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                opacity="0.25"
              />
              {/* 32 tick marks */}
              <g opacity="0.55" stroke="currentColor" strokeWidth="0.8">
                {Array.from({ length: 32 }).map((_, i) => {
                  const a = (i * Math.PI * 2) / 32;
                  const r1 = i % 4 === 0 ? 70 : i % 2 === 0 ? 76 : 80;
                  const r2 = 86;
                  return (
                    <line
                      key={i}
                      x1={100 + Math.cos(a) * r1}
                      y1={100 + Math.sin(a) * r1}
                      x2={100 + Math.cos(a) * r2}
                      y2={100 + Math.sin(a) * r2}
                    />
                  );
                })}
              </g>
              {/* 8-point star (cardinal + intercardinal) */}
              <g
                fill="currentColor"
                opacity="0.85"
                stroke="rgba(0,0,0,0.25)"
                strokeWidth="0.4"
              >
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                  <polygon
                    key={deg}
                    points="100,28 106,100 100,172 94,100"
                    transform={`rotate(${deg} 100 100)`}
                    opacity={deg % 90 === 0 ? 1 : 0.55}
                  />
                ))}
              </g>
              <text
                x="100"
                y="22"
                textAnchor="middle"
                fontSize="11"
                fontFamily="var(--font-jetbrains), monospace"
                fill="currentColor"
              >
                N
              </text>
              {/* Slowly drifting magnetic needle */}
              <g className="hero-art__ocean-compass-needle">
                <polygon
                  points="100,40 104,100 100,160 96,100"
                  fill="url(#ocean-compass-needle)"
                />
              </g>
              {/* Centre cap */}
              <circle cx="100" cy="100" r="6" fill="currentColor" />
              <circle
                cx="100"
                cy="100"
                r="2.5"
                fill="#ff2d95"
                className="hero-art__ocean-compass-pulse"
              />
            </svg>
          </div>
          <div className="hero-art__diner">
            <div>
              <div className="diner-sign">sk.</div>
              <div className="diner-sign__sub">open all night</div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-3xl font-medium heading-accent mb-4">
          Get in touch
        </h2>
        <p className="text-foreground/85 mb-5 leading-relaxed max-w-lg">
          Happy to chat about product, design systems, accessibility, or
          building frontends for scale.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <EmailLink>Email</EmailLink>
          </li>
          <li>
            <a
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              LinkedIn
            </a>
          </li>
          <li>
            <a
              href={profile.github}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
            >
              GitHub
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
