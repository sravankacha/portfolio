import ThemeGallery from "./ThemeGallery";
import { BackButton, FloatingPanel } from "../_shared/LabChrome";

export const metadata = {
  title: "Theme Gallery",
  description: "Preview and switch between available site themes.",
  alternates: { canonical: "https://sravankacha.com/lab/themes/" },
};

export default function ThemesLabPage() {
  return (
    <div className="fixed inset-0 z-40 bg-background overflow-auto">
      <BackButton />

      <div className="max-w-3xl mx-auto px-6 pt-24 pb-16">
        <h1 className="font-display text-4xl font-medium mb-2 heading-accent">
          Theme gallery
        </h1>
        <p className="text-foreground/85 leading-relaxed mb-8 max-w-xl">
          Click a card to swap. Choice persists across visits and is shareable
          via <span className="font-mono">?theme=name</span>.
        </p>
        <ThemeGallery />
      </div>

      <FloatingPanel title="Notes" top={16} width={300} defaultOpen={false}>
        <p className="text-xs text-foreground/80 leading-relaxed">
          More themes drafted but not yet active —{" "}
          <span className="font-mono">terminal</span> and{" "}
          <span className="font-mono">brutalist</span> are coming back later
          with more polish.
        </p>
      </FloatingPanel>
    </div>
  );
}
