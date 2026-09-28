import PipeLab from "./PipeLab";

export const metadata = {
  title: "Endless pipe",
  description:
    "An endless banded pipe that loops into the screen. Click anywhere and it bends toward that point, in a new pair of colors.",
  alternates: { canonical: "https://sravankacha.com/lab/pipe/" },
};

export default function PipeLabPage() {
  return <PipeLab />;
}
