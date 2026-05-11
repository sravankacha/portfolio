import Link from "next/link";
import { profile } from "./_data/profile";
import { projects } from "./_data/projects";
import { experience } from "./_data/experience";

export default function Home() {
  const featured = projects.slice(0, 3);
  const current = experience[0];

  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <section className="mb-24">
        <p className="font-mono text-sm text-muted mb-4">Hola! I am</p>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight mb-6">
          {profile.name}
        </h1>
        <p className="text-xl text-muted leading-relaxed max-w-2xl">
          {profile.bio}
        </p>
        <p className="mt-6 text-sm text-muted">
          <span aria-hidden>☼ </span>
          {profile.location} · Currently{" "}
          <span className="text-foreground">
            {current.title} @ {current.company}
          </span>
        </p>
      </section>

      <section className="mb-24">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="text-2xl font-semibold">Selected projects</h2>
          <Link href="/projects" className="text-sm">
            All projects →
          </Link>
        </div>
        <ul className="space-y-4">
          {featured.map((p) => (
            <li
              key={p.slug}
              className="border border-border rounded-lg p-5 hover:border-accent transition-colors bg-surface"
            >
              <div className="flex items-baseline justify-between gap-4 mb-1">
                <h3 className="font-medium text-lg">{p.title}</h3>
                <span className="font-mono text-xs text-muted shrink-0">
                  {p.context}
                </span>
              </div>
              <p className="text-muted text-sm leading-relaxed">
                {p.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-4">Get in touch</h2>
        <p className="text-muted mb-4 leading-relaxed">
          Always happy to chat about design systems, accessibility, or building
          for scale.
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
