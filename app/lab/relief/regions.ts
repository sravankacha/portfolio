// [west, south, east, north] in degrees
export type BBox = [number, number, number, number];

export type Region = {
  id: string;
  label: string;
  group: "Continents" | "Countries" | "Ranges";
  bbox: BBox;
  /** Raise only this country (world-atlas name); others stay flat paper. */
  country?: string;
};

export const REGIONS: Region[] = [
  { id: "americas", label: "The Americas", group: "Continents", bbox: [-168, -56, -34, 72] },
  { id: "north-america", label: "North America", group: "Continents", bbox: [-168, 7, -52, 72] },
  { id: "south-america", label: "South America", group: "Continents", bbox: [-82, -56, -34, 13] },
  { id: "europe", label: "Europe", group: "Continents", bbox: [-11, 35, 40, 71] },
  { id: "africa", label: "Africa", group: "Continents", bbox: [-18, -35, 52, 37] },
  { id: "asia", label: "Asia", group: "Continents", bbox: [26, -10, 146, 56] },
  { id: "australia", label: "Australia", group: "Continents", bbox: [112, -44, 154, -10] },

  { id: "usa", label: "United States", group: "Countries", bbox: [-125, 24.3, -66.9, 49.5], country: "United States of America" },
  { id: "mexico", label: "Mexico", group: "Countries", bbox: [-117.2, 14.5, -86.7, 32.8], country: "Mexico" },
  { id: "peru", label: "Peru", group: "Countries", bbox: [-81.4, -18.4, -68.6, 0.1], country: "Peru" },
  { id: "iceland", label: "Iceland", group: "Countries", bbox: [-24.6, 63.3, -13.4, 66.6], country: "Iceland" },
  { id: "norway", label: "Norway", group: "Countries", bbox: [4.5, 57.9, 31.2, 71.2], country: "Norway" },
  { id: "italy", label: "Italy", group: "Countries", bbox: [6.6, 36.5, 18.6, 47.1], country: "Italy" },
  { id: "switzerland", label: "Switzerland", group: "Countries", bbox: [5.9, 45.8, 10.5, 47.9], country: "Switzerland" },
  { id: "india", label: "India", group: "Countries", bbox: [68, 6.5, 97.5, 35.7], country: "India" },
  { id: "nepal", label: "Nepal", group: "Countries", bbox: [80, 26.3, 88.3, 30.5], country: "Nepal" },
  { id: "japan", label: "Japan", group: "Countries", bbox: [129, 30.5, 146, 45.6], country: "Japan" },
  { id: "new-zealand", label: "New Zealand", group: "Countries", bbox: [166, -47.4, 178.6, -34.3], country: "New Zealand" },

  { id: "himalaya", label: "Himalaya", group: "Ranges", bbox: [72, 25, 98, 37] },
  { id: "alps", label: "Alps", group: "Ranges", bbox: [4.5, 43.5, 16.5, 48.5] },
  { id: "andes", label: "Central Andes", group: "Ranges", bbox: [-76, -28, -62, -12] },
  { id: "rockies", label: "Rocky Mountains", group: "Ranges", bbox: [-118, 35, -102, 49] },
];

export const DEFAULT_REGION = "north-america";
