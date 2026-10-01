/* Time of day for the ocean theme.

   The sun's elevation comes from the visitor's local clock and date with a
   simple solar model (declination + hour angle) at an assumed latitude. Solar
   noon is 12:00 local standard time, shifted an hour when daylight saving is
   in effect. No geolocation prompt: the clock and the timezone are enough to
   get sunrise, golden hour, dusk and night at the right moments.

   A palette is blended from keyframes by elevation, so every minute of the
   day has its own sky, water and light. */

export type RGB = [number, number, number];

export type SkyState = {
  /** direction to the sun by day, the moon by night (y up, camera looks -z) */
  lightDir: [number, number, number];
  zenith: RGB;
  band: RGB;
  horizon: RGB;
  glow: RGB; // halo around the light source
  disc: RGB; // the light source itself
  discSize: number; // exponent: larger = smaller disc
  deep: RGB; // water body color
  crest: RGB; // light through thin crests
  foam: RGB;
  stars: number; // 0..1
  hemiSky: RGB;
  hemiGround: RGB;
  hemiIntensity: number;
  lightColor: RGB;
  lightIntensity: number;
  /** darkness of the text scrim, 0..1 */
  scrim: number;
  phase: "night" | "dawn" | "morning" | "day" | "golden hour" | "dusk" | "blue hour";
  elevation: number; // sun elevation, degrees
  label: string; // e.g. "7:42 pm"
};

const LAT = 38; // assumed latitude (mid-northern; matches DC)
const rad = Math.PI / 180;

/** Sun elevation (deg) and progress through the day/night for a local time. */
export function solar(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86400000);
  const decl = 23.44 * Math.sin(((2 * Math.PI) / 365) * (day - 81));
  // daylight saving: offset differs from the year's larger (standard) offset
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  const dst = date.getTimezoneOffset() < Math.max(jan, jul) ? 1 : 0;
  const hours = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const H = 15 * (hours - (12 + dst)); // hour angle
  const sinEl = Math.sin(LAT * rad) * Math.sin(decl * rad) + Math.cos(LAT * rad) * Math.cos(decl * rad) * Math.cos(H * rad);
  const elevation = Math.asin(Math.max(-1, Math.min(1, sinEl))) / rad;
  // half-day length from the sunrise hour angle
  const cosH0 = -Math.tan(LAT * rad) * Math.tan(decl * rad);
  const H0 = Math.acos(Math.max(-1, Math.min(1, cosH0))) / rad; // degrees
  return { elevation, H, H0 };
}

type Key = { el: number } & Omit<SkyState, "lightDir" | "phase" | "elevation" | "label" | "discSize" | "stars"> & {
  discSize: number;
  stars: number;
};

// Keyframes by sun elevation (degrees), night → noon. Colors are linear-ish HDR.
const KEYS: Key[] = [
  {
    el: -18, // deep night, moonlit
    zenith: [0.004, 0.006, 0.02], band: [0.01, 0.015, 0.045], horizon: [0.03, 0.045, 0.09],
    glow: [0.1, 0.12, 0.18], disc: [9, 9.5, 10.5], discSize: 4500,
    deep: [0.0, 0.006, 0.016], crest: [0.0, 0.02, 0.03], foam: [0.22, 0.25, 0.3], stars: 1,
    hemiSky: [0.18, 0.22, 0.36], hemiGround: [0.01, 0.02, 0.04], hemiIntensity: 0.3,
    lightColor: [0.62, 0.72, 1.0], lightIntensity: 0.4, scrim: 0.25,
  },
  {
    el: -7, // blue hour
    zenith: [0.02, 0.03, 0.1], band: [0.07, 0.07, 0.19], horizon: [0.32, 0.2, 0.3],
    glow: [0.45, 0.24, 0.2], disc: [0, 0, 0], discSize: 2400,
    deep: [0.0, 0.015, 0.04], crest: [0.0, 0.04, 0.06], foam: [0.4, 0.38, 0.45], stars: 0.35,
    hemiSky: [0.3, 0.28, 0.5], hemiGround: [0.02, 0.04, 0.07], hemiIntensity: 0.7,
    lightColor: [0.7, 0.55, 0.75], lightIntensity: 0.6, scrim: 0.3,
  },
  {
    el: 1.5, // sunset / sunrise
    zenith: [0.03, 0.04, 0.12], band: [0.17, 0.12, 0.3], horizon: [1.15, 0.5, 0.26],
    glow: [1.12, 0.5, 0.2], disc: [22, 13, 7], discSize: 2400,
    deep: [0.0, 0.03, 0.065], crest: [0.0, 0.09, 0.1], foam: [0.75, 0.62, 0.58], stars: 0,
    hemiSky: [0.42, 0.36, 0.56], hemiGround: [0.03, 0.08, 0.13], hemiIntensity: 0.9,
    lightColor: [1.0, 0.63, 0.36], lightIntensity: 2.4, scrim: 0.45,
  },
  {
    el: 9, // golden hour
    zenith: [0.1, 0.17, 0.38], band: [0.5, 0.45, 0.6], horizon: [1.3, 0.88, 0.55],
    glow: [1.0, 0.7, 0.4], disc: [24, 18, 11], discSize: 2400,
    deep: [0.0, 0.04, 0.08], crest: [0.0, 0.12, 0.13], foam: [0.85, 0.78, 0.7], stars: 0,
    hemiSky: [0.6, 0.62, 0.78], hemiGround: [0.05, 0.1, 0.15], hemiIntensity: 1.0,
    lightColor: [1.0, 0.8, 0.58], lightIntensity: 2.6, scrim: 0.55,
  },
  {
    el: 35, // midday: clear blue sky over deep blue water (kept rich, not washed out)
    zenith: [0.06, 0.18, 0.5], band: [0.25, 0.48, 0.85], horizon: [0.62, 0.78, 0.95],
    glow: [0.5, 0.48, 0.42], disc: [26, 25, 22], discSize: 3000,
    deep: [0.0, 0.05, 0.11], crest: [0.0, 0.16, 0.17], foam: [0.9, 0.93, 0.96], stars: 0,
    hemiSky: [0.75, 0.85, 1.0], hemiGround: [0.06, 0.12, 0.18], hemiIntensity: 1.1,
    lightColor: [1.0, 0.96, 0.9], lightIntensity: 2.8, scrim: 0.62,
  },
];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRGB = (a: RGB, b: RGB, t: number): RGB => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const smooth = (t: number) => t * t * (3 - 2 * t);

function phaseOf(el: number, morning: boolean): SkyState["phase"] {
  if (el < -10) return "night";
  if (el < -2) return morning ? "dawn" : "blue hour";
  if (el < 4) return morning ? "dawn" : "dusk";
  if (el < 14) return morning ? "morning" : "golden hour";
  return "day";
}

/** Sky state for a local time. `override` = "HH:MM" to preview another time. */
export function skyAt(date: Date, override?: string | null): SkyState {
  const d = new Date(date);
  if (override && /^\d{1,2}:\d{2}$/.test(override)) {
    const [h, m] = override.split(":").map(Number);
    d.setHours(h, m, 0, 0);
  }
  const { elevation, H, H0 } = solar(d);
  const el = Math.max(KEYS[0].el, Math.min(KEYS[KEYS.length - 1].el, elevation));
  let i = 0;
  while (i < KEYS.length - 2 && el > KEYS[i + 1].el) i++;
  const A = KEYS[i], B = KEYS[i + 1];
  const t = smooth(Math.max(0, Math.min(1, (el - A.el) / (B.el - A.el))));

  const out = {} as SkyState;
  for (const k of Object.keys(A) as (keyof Key)[]) {
    if (k === "el") continue;
    const a = A[k], b = B[k];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (out as any)[k] = Array.isArray(a) ? mixRGB(a as RGB, b as RGB, t) : mix(a as number, b as number, t);
  }

  // Light direction: the sun by day, the moon by night.
  const morning = H < 0;
  const day = elevation > -6;
  let progress: number; // 0 at rise .. 1 at set
  let lightEl: number;
  if (day) {
    progress = (H + H0) / (2 * H0);
    lightEl = Math.max(elevation, 0.8);
  } else {
    const nightHalf = 180 - H0;
    const h = H > 0 ? H - H0 : H + 360 - H0; // degrees since sunset
    progress = h / (2 * nightHalf);
    // the moon stays low enough to sit in view and lay a silver path on the water
    lightEl = 1.8 + 3.2 * Math.sin(Math.PI * Math.max(0, Math.min(1, progress)));
  }
  // Both arc across the right half of the view (the ship's side), so their glitter
  // path never runs under the hero text on the left. Artistic, not astronomical.
  const p01 = Math.max(0, Math.min(1, progress));
  const az = day ? 0.18 + 0.44 * p01 : 0.28 + 0.3 * p01; // radians right of straight ahead
  const ce = Math.cos(lightEl * rad);
  out.lightDir = [Math.sin(az) * ce, Math.sin(lightEl * rad), -Math.cos(az) * ce];

  out.elevation = elevation;
  out.phase = phaseOf(elevation, morning);
  out.label = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return out;
}
