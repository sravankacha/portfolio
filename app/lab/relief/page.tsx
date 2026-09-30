import ReliefLab from "./ReliefLab";

export const metadata = {
  title: "Relief",
  description:
    "A 3D raised-relief map of continents, countries and mountain ranges, built from real elevation data. Turn the vertical exaggeration up or down and move the sun.",
  alternates: { canonical: "https://sravankacha.com/lab/relief/" },
};

export default function ReliefLabPage() {
  return <ReliefLab />;
}
