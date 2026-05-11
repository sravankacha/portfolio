import Link from "next/link";
import { profile } from "./_data/profile";
import { projects } from "./_data/projects";

export default function Home() {
  const featured = projects.slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto px-6 py-16 sm:py-24">
      <section className="grid md:grid-cols-[1.2fr_1fr] gap-10 md:gap-14 items-center mb-28">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted mb-5">
            Hola — I am
          </p>
          <h1 className="font-display text-5xl sm:text-6xl md:text-7xl font-medium leading-[1.05] mb-6">
            Sravan
            <br />
            Kachavarapu
          </h1>
          <p className="inline-block font-mono text-xs px-2.5 py-1 rounded-full border border-border bg-surface text-foreground mb-6">
            {profile.tagline}
          </p>
          <p className="text-lg text-muted leading-relaxed max-w-md">
            {profile.bio}
          </p>
          <p className="mt-6 text-sm text-muted">
            <span aria-hidden>☼ </span>
            {profile.location}
          </p>
        </div>

        <div
          className="hero-motif order-first md:order-last"
          aria-hidden="true"
        >
          <span />
        </div>
      </section>

      <section className="mb-24">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display text-3xl font-medium">
            Selected projects
          </h2>
          <Link href="/projects" className="text-sm">
            All projects →
          </Link>
        </div>
        <ul className="space-y-4">
          {featured.map((p) => (
            <li
              key={p.slug}
              className="border border-border rounded-xl p-6 hover:border-accent transition-colors bg-surface"
            >
              <div className="flex items-baseline justify-between gap-4 mb-2">
                <h3 className="font-display text-xl font-medium">{p.title}</h3>
                <span className="font-mono text-xs text-muted shrink-0">
                  {p.context}
                </span>
              </div>
              <p className="text-muted leading-relaxed">{p.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-display text-3xl font-medium mb-4">
          Get in touch
        </h2>
        <p className="text-muted mb-5 leading-relaxed max-w-lg">
          Always happy to chat about design systems, accessibility, or building
          frontends for scale.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </li>
          <li>
            <a
              href={profile.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
          </li>
          <li>
            <a href={profile.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
