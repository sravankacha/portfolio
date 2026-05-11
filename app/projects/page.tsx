import { projects } from "../_data/projects";

export const metadata = {
  title: "Projects",
  description: "Selected projects and an archive of earlier work.",
  alternates: { canonical: "https://sravankacha.com/projects/" },
};

export default function ProjectsPage() {
  const archived = projects.filter((p) => p.archived);
  const active = projects.filter((p) => !p.archived);

  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="font-display text-5xl font-medium mb-8 heading-accent">Projects</h1>

      {active.length > 0 && (
        <section className="mb-16">
          <h2 className="font-display text-2xl font-medium mb-4 heading-accent">Current</h2>
          <ul className="space-y-4">
            {active.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display text-2xl font-medium mb-2 heading-accent">Archive</h2>
        <p className="text-muted mb-6">
          Earlier work, mostly from my FanFueled years (2013–2014).
        </p>
        <ul className="space-y-4">
          {archived.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </ul>
      </section>
    </div>
  );
}

function ProjectCard({
  project,
}: {
  project: (typeof projects)[number];
}) {
  return (
    <li className="border border-border rounded-xl p-6 hover:border-accent transition-colors bg-surface">
      <div className="flex items-baseline justify-between gap-4 mb-2">
        <h3 className="font-display text-xl font-medium">{project.title}</h3>
        <span className="font-mono text-xs text-muted shrink-0">
          {project.context}
        </span>
      </div>
      <p className="text-muted text-sm leading-relaxed">
        {project.description}
      </p>
    </li>
  );
}
