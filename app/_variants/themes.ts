export type ThemeId = "editorial" | "ocean" | "diner";

export type Theme = {
  id: ThemeId;
  label: string;
  tagline: string;
};

export const themes: Theme[] = [
  {
    id: "editorial",
    label: "editorial",
    tagline: "Serif headlines, gradient hero",
  },
  {
    id: "ocean",
    label: "ocean",
    tagline: "Voyage — waves, glass, fish",
  },
  {
    id: "diner",
    label: "diner",
    tagline: "Neon nights — Roadhouse signs",
  },
];

export const DEFAULT_THEME: ThemeId = "editorial";
export const STORAGE_KEY = "sk-theme";
export const THEME_IDS: ThemeId[] = themes.map((t) => t.id);
