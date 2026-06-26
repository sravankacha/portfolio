import GlobeLab from "./GlobeLab";

export const metadata = {
  title: "Globe",
  description:
    "Interactive 3D globe — drag to rotate, project public datasets as spikes. Earthquakes, volcanoes, the ISS, population.",
  alternates: { canonical: "https://sravankacha.com/lab/globe/" },
};

export default function GlobeLabPage() {
  return <GlobeLab />;
}
