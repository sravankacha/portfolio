import { profile } from "../_data/profile";
import { experience } from "../_data/experience";

export const metadata = {
  title: "About — Sravan Kachavarapu",
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="text-4xl font-semibold tracking-tight mb-8">About</h1>
      <p className="text-lg text-muted leading-relaxed mb-6">{profile.bio}</p>
      <p className="text-muted mb-12">
        Based in {profile.location}. Reach me at{" "}
        <a href={`mailto:${profile.email}`}>{profile.email}</a>.
      </p>

      <h2 className="text-2xl font-semibold mb-8">Experience</h2>
      <div className="space-y-12">
        {experience.map((role) => (
          <article
            key={`${role.company}-${role.title}`}
            className="border-l-2 border-border pl-6"
          >
            <header className="mb-4">
              <h3 className="text-lg font-semibold">{role.title}</h3>
              <p className="text-muted">
                {role.company}{" "}
                <span className="font-mono text-xs ml-1">· {role.period}</span>
              </p>
            </header>
            {role.summary && (
              <p className="text-muted leading-relaxed mb-4">{role.summary}</p>
            )}
            <div className="space-y-4">
              {role.highlights.map((h) => (
                <div key={h.heading}>
                  <h4 className="font-medium mb-1">{h.heading}</h4>
                  <p className="text-muted text-sm leading-relaxed">
                    {h.description}
                  </p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
