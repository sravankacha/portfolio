import Link from "next/link";
import WaveControls from "./WaveControls";

export const metadata = {
  title: "Wave Control Panel",
  description:
    "Live sliders for the Gerstner-wave ocean shader — steepness, wavelength, sun direction.",
  alternates: { canonical: "https://sravankacha.com/lab/waves/" },
};

export default function WavesLabPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="mb-10">
        <Link href="/lab" className="text-sm font-mono text-muted">
          ← lab
        </Link>
        <h1 className="font-display text-5xl font-medium mt-2 mb-3 heading-accent">
          Wave control panel
        </h1>
        <p className="text-foreground/85 leading-relaxed max-w-2xl">
          Drag sliders to alter the Gerstner-wave parameters in real time. The
          shader sums four waves at varying direction, wavelength, steepness,
          and speed. Sun direction drives both the specular highlight and the
          fresnel reflection off the sky.
        </p>
      </div>

      <WaveControls />

      <p className="mt-10 text-sm text-muted leading-relaxed max-w-2xl">
        Same shader powers the <span className="font-mono">ocean</span> theme
        on this site — toggle it from the footer to see it as a full-screen
        background.
      </p>
    </div>
  );
}
