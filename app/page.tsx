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
            <div className="hero-art__ocean-porthole" />
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
