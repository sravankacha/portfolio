export type Experiment = {
  slug: string;
  title: string;
  summary: string;
  tag: string;
  /** preview image in /public/lab/thumbs */
  thumb: string;
};

// Newest first. Each one needs a 16:10 preview at /public/lab/thumbs/<slug>.jpg.
export const EXPERIMENTS: Experiment[] = [
  {
    slug: "relief",
    title: "Relief",
    summary:
      "Raised-relief maps of continents, countries and mountain ranges from real elevation data. Dial the vertical exaggeration from true scale to 300× and move the sun.",
    tag: "data · webgl",
    thumb: "/lab/thumbs/relief.jpg",
  },
  {
    slug: "pipe",
    title: "Endless pipe",
    summary:
      "A banded pipe streams away into the screen, inspired by an in-flight map animation. Click anywhere and it grows toward that point, keeping every path it has drawn.",
    tag: "interaction · webgl",
    thumb: "/lab/thumbs/pipe.jpg",
  },
  {
    slug: "globe",
    title: "Globe",
    summary:
      "Interactive 3D globe with country borders. Project public datasets as spikes: earthquakes, volcanoes, the ISS in real time, population.",
    tag: "data · webgl",
    thumb: "/lab/thumbs/globe.jpg",
  },
  {
    slug: "venom",
    title: "Venom",
    summary:
      "A sticky tentacled creature follows your cursor. Bezier tentacles snap to the nearest anchor points with an elastic snap-and-whip.",
    tag: "interaction · svg",
    thumb: "/lab/thumbs/venom.jpg",
  },
  {
    slug: "waves",
    title: "FFT ocean",
    summary:
      "Live sliders for the Tessendorf FFT ocean shader behind the ocean theme: wind direction, patch size, choppiness.",
    tag: "shader · webgl",
    thumb: "/lab/thumbs/waves.jpg",
  },
  {
    slug: "themes",
    title: "Theme gallery",
    summary: "Every site theme side by side. Click one to swap the whole site.",
    tag: "design · variants",
    thumb: "/lab/thumbs/themes.jpg",
  },
];
