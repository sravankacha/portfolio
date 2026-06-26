import WaveControls from "./WaveControls";

export const metadata = {
  title: "FFT ocean control panel",
  description:
    "Live sliders for the Tessendorf FFT ocean shader — wind direction, patch size, choppiness.",
  alternates: { canonical: "https://sravankacha.com/lab/waves/" },
};

export default function WavesLabPage() {
  return <WaveControls />;
}
