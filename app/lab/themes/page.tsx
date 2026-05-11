import Link from "next/link";
import ThemeGallery from "./ThemeGallery";

export const metadata = {
  title: "Theme Gallery",
  description: "Preview and switch between available site themes.",
  alternates: { canonical: "https://sravankacha.com/lab/themes/" },
};

export default function ThemesLabPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="mb-10">
        <Link href="/lab" className="text-sm font-mono text-muted">
          ← lab
        </Link>
        <h1 className="font-display text-5xl font-medium mt-2 mb-3 heading-accent">
          Theme gallery
        </h1>
        <p className="text-foreground/85 leading-relaxed max-w-xl">
          Click a card to swap. Choice persists across visits and is shareable
          via <span className="font-mono">?theme=name</span>.
        </p>
      </div>

      <ThemeGallery />

      <p className="mt-10 text-sm text-muted leading-relaxed max-w-xl">
        More themes drafted but not yet active —{" "}
        <span className="font-mono">terminal</span> and{" "}
        <span className="font-mono">brutalist</span> are coming back later
        with more polish.
      </p>
    </div>
  );
}
