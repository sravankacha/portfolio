import { profile } from "../_data/profile";
import { experience } from "../_data/experience";

export const metadata = {
  title: "Resume — Sravan Kachavarapu",
};

export default function ResumePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <header className="mb-12 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            {profile.name}
          </h1>
          <p className="text-muted">{profile.tagline}</p>
          <p className="text-sm text-muted mt-2">
            {profile.location} ·{" "}
            <a href={`mailto:${profile.email}`}>{profile.email}</a>
          </p>
        </div>
        <a
          href="/resume.pdf"
          download
          className="inline-flex items-center gap-2 border border-border rounded-md px-4 py-2 text-sm hover:border-accent !text-foreground"
        >
          Download PDF ↓
        </a>
      </header>

      <section className="space-y-10">
        {experience.map((role) => (
          <article key={`${role.company}-${role.title}`}>
            <header className="mb-3">
              <h2 className="font-semibold">
                {role.title} · {role.company}
              </h2>
              <p className="text-muted text-sm font-mono">{role.period}</p>
            </header>
            {role.summary && (
              <p className="text-muted text-sm leading-relaxed mb-3">
                {role.summary}
              </p>
            )}
            <div className="space-y-4">
              {role.highlights.map((h) => (
                <div key={h.heading}>
                  <h3 className="font-medium text-sm">{h.heading}</h3>
                  <p className="text-muted text-sm leading-relaxed">
                    {h.description}
                  </p>
                  {h.bullets && (
                    <ul className="list-disc list-outside ml-5 mt-2 space-y-1 text-sm text-muted">
                      {h.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
