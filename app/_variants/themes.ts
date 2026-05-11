export type ThemeId = "editorial" | "terminal" | "brutalist" | "ocean";

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
    id: "terminal",
    label: "terminal",
    tagline: "Mono, sharp, command-line",
  },
  {
    id: "brutalist",
    label: "brutalist",
    tagline: "Stark, system, hard edges",
  },
  {
    id: "ocean",
    label: "ocean",
    tagline: "Voyage — waves, glass, fish",
  },
];

export const DEFAULT_THEME: ThemeId = "editorial";
export const STORAGE_KEY = "sk-theme";
export const THEME_IDS: ThemeId[] = themes.map((t) => t.id);
