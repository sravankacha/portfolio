import Image from "next/image";
import Link from "next/link";
import EmailLink from "./_components/EmailLink";
import HeroArt from "./_components/HeroArt";
import { profile } from "./_data/profile";

const LAB = [
  {
    slug: "relief",
    title: "Relief",
    line: "Raised-relief maps from real elevation data. Dial the height from true scale to 300×.",
    tag: "data · webgl",
  },
  {
    slug: "pipe",
    title: "Endless pipe",
    line: "Click anywhere and a banded pipe grows toward it, deeper into the screen.",
    tag: "interaction · webgl",
  },
  {
    slug: "globe",
    title: "Globe",
    line: "Earthquakes, volcanoes and the ISS as live spikes on a draggable globe.",
    tag: "data · webgl",
  },
  {
    slug: "origami",
    href: "/?theme=origami",
    title: "Paper animals",
    line: "Sculpted papercraft beasts that crumple into a ball and unfold as the next one.",
    tag: "theme · webgl",
  },
];

const PRACTICE = [
  {
    title: "Risk & compliance tooling",
    where: "Meta · now",
    body: "Turning regulatory and policy requirements into software that compliance teams can rely on at Meta's scale.",
  },
  {
    title: "Design systems & accessibility",
    where: "EAB · 2015–2021",
    body: "Led WCAG 2.1 compliance across product teams and built an enterprise design system on Web Components, then managed the team behind it.",
  },
  {
    title: "Zero-to-one product",
    where: "FanFueled · 2012–2014",
    body: "Designed and built a social commerce and ticketing platform end to end, from wireframes to the mobile checkout.",
  },
];

const PATH = [
  { org: "Meta", role: "Staff Software Engineer", when: "now" },
  { org: "EAB", role: "Principal Front-end Engineer, Manager", when: "2017–2021" },
  { org: "The Advisory Board Company", role: "Senior Front End Engineer", when: "2014–2017" },
  { org: "FanFueled", role: "UX/UI Designer & Front-End Developer", when: "2012–2014" },
];

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16 sm:py-20">
      {/* 1. Hero: who, what, and a way in — in one screen */}
      <section className="grid md:grid-cols-[1.15fr_1fr] gap-10 md:gap-14 items-center mb-24">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-muted mb-5">
            {profile.tagline} · {profile.location}
          </p>
          <h1 className="hero-title text-5xl sm:text-6xl md:text-7xl leading-[1.04] mb-6">
            Sravan
            <br />
            Kachavarapu
          </h1>
          <p className="text-xl sm:text-2xl leading-snug text-foreground mb-4 max-w-md">
            I build where product, design and engineering overlap.
          </p>
          <p className="text-base text-foreground/75 leading-relaxed max-w-md mb-8">
            Today that&rsquo;s risk and compliance tooling at Meta. Before that, a
            decade of frontend: design systems, accessibility, and a habit of small
            experiments, some of which live below.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="#lab"
              className="btn-primary !text-white bg-accent rounded-md px-4 py-2 text-sm font-medium hover:opacity-85"
            >
              See the lab ↓
            </a>
            <Link
              href="/about"
              className="!text-foreground border border-border rounded-md px-4 py-2 text-sm hover:border-accent"
            >
              About &amp; experience
            </Link>
          </div>
        </div>
        <HeroArt className="order-first md:order-last" />
      </section>

      {/* 2. The work you can touch */}
      <section id="lab" className="mb-24 scroll-mt-8">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display text-3xl font-medium heading-accent">From the lab</h2>
          <Link href="/lab" className="font-mono text-xs">
            all experiments →
          </Link>
        </div>
        <ul className="grid sm:grid-cols-2 gap-5">
          {LAB.map((x, i) => (
            <li key={x.slug}>
              <Link
                href={x.href ?? `/lab/${x.slug}`}
                className="group block rounded-xl border border-border overflow-hidden bg-surface !text-foreground hover:!opacity-100 hover:border-accent transition-colors"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-foreground/5">
                  <Image
                    src={`/lab/thumbs/${x.slug}.jpg`}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 480px, 100vw"
                    loading={i < 2 ? "eager" : "lazy"}
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-baseline justify-between gap-3 mb-1.5">
                    <h3 className="font-display text-xl font-medium">{x.title}</h3>
                    <span className="font-mono text-[11px] text-muted shrink-0">{x.tag}</span>
                  </div>
                  <p className="text-sm text-foreground/75 leading-relaxed">{x.line}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. What I do, with evidence instead of adjectives */}
      <section className="mb-24">
        <h2 className="font-display text-3xl font-medium heading-accent mb-8">What I work on</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {PRACTICE.map((p) => (
            <div key={p.title} className="border-t border-border pt-5">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted mb-2">{p.where}</p>
              <h3 className="font-display text-xl font-medium mb-2">{p.title}</h3>
              <p className="text-sm text-foreground/75 leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. The path, compressed */}
      <section className="mb-24">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display text-3xl font-medium heading-accent">Path</h2>
          <Link href="/resume" className="font-mono text-xs">
            full resume →
          </Link>
        </div>
        <ol className="divide-y divide-border border-y border-border">
          {PATH.map((r) => (
            <li key={r.org} className="grid grid-cols-[1fr_auto] sm:grid-cols-[14rem_1fr_auto] gap-x-6 gap-y-0.5 py-3.5 text-sm">
              <span className="font-medium">{r.org}</span>
              <span className="text-foreground/70 col-span-2 sm:col-span-1 order-3 sm:order-none">{r.role}</span>
              <span className="font-mono text-xs text-muted text-right">{r.when}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 5. Contact */}
      <section className="rounded-xl border border-border bg-surface p-8 sm:p-10">
        <h2 className="font-display text-3xl font-medium heading-accent mb-3">Let&rsquo;s talk</h2>
        <p className="text-foreground/80 mb-6 leading-relaxed max-w-lg">
          Product, design systems, accessibility, compliance tooling, or a weird
          WebGL idea. I&rsquo;m happy to compare notes.
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <EmailLink>Email</EmailLink>
          </li>
          <li>
            <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
              LinkedIn
            </a>
          </li>
          <li>
            <a href={profile.github} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
              GitHub
            </a>
          </li>
        </ul>
      </section>
    </div>
  );
}
