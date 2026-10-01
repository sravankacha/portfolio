/* Shared steering state between the hero's helm (input) and the background
   ocean (render loop). Plain mutable module state: the render loop reads it
   every frame, so nothing here needs to trigger React renders. */
export const helm = {
  /** ship heading in radians; forward = (cos, 0, sin) in world xz */
  heading: -2.35,
  /** multiplier on the anchor distance: < 1 closer, > 1 farther */
  distance: 1,
  /** where the ship should sit on screen when the page is scrolled to the top (CSS px) */
  anchor: null as { x: number; y: number } | null,
};

export const DISTANCE_MIN = 0.62; // any closer and she sails over the hero text
export const DISTANCE_MAX = 3.2;

/** Current time-of-day label for the hero ("7:42 pm · dusk"), with a tiny subscription. */
const listeners = new Set<() => void>();
export const sky = {
  label: "",
  notify: () => listeners.forEach((l) => l()),
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
