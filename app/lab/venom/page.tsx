import VenomCreature from "./VenomCreature";
import { BackButton, FloatingPanel } from "../_shared/LabChrome";
import VenomScrollLock from "./VenomScrollLock";

export const metadata = {
  title: "Venom",
  description:
    "A sticky, tentacled creature that follows your cursor — Bezier tentacles snap to nearest anchor points with elastic, rubbery feel.",
  alternates: { canonical: "https://sravankacha.com/lab/venom/" },
};

export default function VenomLabPage() {
  return (
    <div className="fixed inset-0 z-40 bg-background">
      <VenomScrollLock />
      <VenomCreature />
      <BackButton />

      <FloatingPanel title="Venom" top={16} width={320}>
        <p className="text-xs text-foreground/85 leading-relaxed">
          A sticky, tentacled creature that follows your cursor. Tentacles
          dynamically reach for the nearest available anchor points scattered
          across the surface — they let go and snap to closer ones when
          stretched past their reach.
        </p>
        <p className="text-xs text-foreground/75 leading-relaxed">
          Quadratic Bezier with gravity-sag and lateral wobble for the rubbery
          feel. Spring-damped motion + speed-driven squash-and-stretch for the
          body.
        </p>
      </FloatingPanel>

      <FloatingPanel title="Notes" top={260} width={320} defaultOpen={false}>
        <p className="text-xs text-muted leading-relaxed">
          ~100 grey anchor dots, scattered at mount and re-scattered on
          resize. Each frame every tentacle slot re-picks its nearest unused
          anchor within reach via a greedy nearest-neighbor scan — a quadtree
          would scale this to thousands, the linear pass is fine here.
        </p>
        <p className="text-xs text-muted leading-relaxed">
          The tentacle tip doesn&apos;t teleport to a new anchor — it lerps,
          so re-attachment reads as an elastic whip rather than a cut.
        </p>
      </FloatingPanel>

      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted font-mono select-none pointer-events-none">
        move your mouse around
      </p>
    </div>
  );
}
