import LabCarousel from "./LabCarousel";

export const metadata = {
  title: "Lab",
  description:
    "Small experiments and visual tinkering: interactive demos, shader playgrounds, and design probes.",
  alternates: { canonical: "https://sravankacha.com/lab/" },
};

export default function LabPage() {
  return (
    <div className="pt-16 pb-12">
      <div className="max-w-5xl mx-auto px-6 mb-10">
        <h1 className="font-display text-5xl font-medium mb-4 heading-accent">Lab</h1>
        <p className="text-foreground/85 leading-relaxed max-w-xl">
          Small experiments and visual tinkering. Some serve a purpose, some are
          just fun. Browse with the arrows, then open one.
        </p>
      </div>
      <LabCarousel />
    </div>
  );
}
