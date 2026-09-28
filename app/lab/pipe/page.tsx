import PipeLab from "./PipeLab";

export const metadata = {
  title: "Endless pipe",
  description:
    "An endless banded pipe that streams away into the screen. Click anywhere and it grows toward that point, keeping every path it has drawn.",
  alternates: { canonical: "https://sravankacha.com/lab/pipe/" },
};

export default function PipeLabPage() {
  return <PipeLab />;
}
