import Link from "next/link";

export const metadata = {
  title: "Lab",
  description:
    "Small experiments and visual tinkering — interactive demos, shader playgrounds, and design probes.",
  alternates: { canonical: "https://sravankacha.com/lab/" },
};

const experiments = [
  {
    slug: "venom",
    title: "Venom",
    summary:
      "A sticky tentacled creature follows your cursor — Bezier tentacles snap to the nearest anchor points with elastic snap-and-whip.",
    tag: "interaction · svg",
  },
  {
    slug: "waves",
    title: "Wave control panel",
    summary:
      "Live sliders for the ocean theme's Gerstner-wave shader — steepness, wavelength, sun direction.",
    tag: "shader · webgl",
  },
  {
    slug: "themes",
    title: "Theme gallery",
    summary:
      "Side-by-side previews of every theme. Click to swap. New themes get listed here as they ship.",
    tag: "design · variants",
  },
];

export default function LabPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-20">
      <h1 className="font-display text-5xl font-medium mb-4 heading-accent">
        Lab
      </h1>
      <p className="text-foreground/85 leading-relaxed mb-12 max-w-xl">
        Small experiments and visual tinkering. Some serve a purpose, some are
        just fun — every one of them uses content from the rest of the site.
      </p>

      <ul className="space-y-4">
        {experiments.map((e) => (
          <li
            key={e.slug}
            className="border border-border rounded-xl p-6 hover:border-accent transition-colors bg-surface"
          >
            <Link href={`/lab/${e.slug}`} className="!text-foreground block">
              <div className="flex items-baseline justify-between gap-4 mb-2">
                <h2 className="font-display text-xl font-medium">{e.title}</h2>
                <span className="font-mono text-xs text-muted shrink-0">
                  {e.tag}
                </span>
              </div>
              <p className="text-foreground/80 leading-relaxed">{e.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
