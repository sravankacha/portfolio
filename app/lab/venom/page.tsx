import Link from "next/link";
import VenomCreature from "./VenomCreature";

export const metadata = {
  title: "Venom",
  description:
    "A sticky tentacled creature that follows your cursor — Bezier tentacles snap to nearest anchor points with elastic, rubbery feel.",
  alternates: { canonical: "https://sravankacha.com/lab/venom/" },
};

export default function VenomLabPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <Link href="/lab" className="text-sm font-mono text-muted">
        ← lab
      </Link>
      <h1 className="font-display text-5xl font-medium mt-2 mb-3 heading-accent">
        Venom
      </h1>
      <p className="text-foreground/85 leading-relaxed max-w-2xl mb-8">
        A sticky, tentacled creature that follows your cursor around the box.
        Its tentacles dynamically reach for the nearest available anchor
        points scattered across the surface — they let go and snap to closer
        ones when stretched past their reach. Quadratic Bezier with
        gravity-sag and lateral wobble for the rubbery feel; spring-damped
        motion + speed-driven squash-and-stretch for the body.
      </p>

      <VenomCreature />

      <div className="mt-8 space-y-4 text-sm text-muted leading-relaxed max-w-2xl">
        <p>
          The faint grey dots are the anchor points (~90 of them, scattered at
          mount and re-scattered on resize). Each frame, every tentacle slot
          re-picks its nearest unused anchor within reach via a greedy
          nearest-neighbor scan. A quadtree would scale this to thousands of
          anchors; at this count the linear pass is fine.
        </p>
        <p>
          The tentacle <span className="font-mono">tip</span> doesn&apos;t
          teleport to the new anchor — it{" "}
          <span className="font-mono">lerp</span>s toward it, so re-attachment
          reads as an elastic whip rather than a cut.
        </p>
      </div>
    </div>
  );
}
