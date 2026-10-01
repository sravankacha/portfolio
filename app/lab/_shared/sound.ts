/* Tiny synthesized UI sounds for the lab carousel (no audio files).
   tick(): a soft detent click as a card settles in the center.
   snap(): a dry crack when a card breaks open.
   Muted state persists per visitor. */

const KEY = "sk-lab-sound";
let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();

export const soundPref = {
  get: (): boolean => {
    try {
      return localStorage.getItem(KEY) !== "off";
    } catch {
      return true;
    }
  },
  set: (on: boolean) => {
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      /* private mode: in-memory only */
    }
    listeners.forEach((l) => l());
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

function audio(): AudioContext | null {
  if (!soundPref.get()) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function noise(a: AudioContext, seconds: number) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * seconds), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  return src;
}

let lastTick = 0;
export function tick() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  if (t - lastTick < 0.035) return; // fast flicks: don't machine-gun
  lastTick = t;
  // a short pitched blip...
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(2300, t);
  o.frequency.exponentialRampToValueAtTime(950, t + 0.03);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.07, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 0.06);
  // ...over a filtered click of noise
  const n = noise(a, 0.02);
  const hp = a.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3500;
  const ng = a.createGain();
  ng.gain.setValueAtTime(0.05, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
  n.connect(hp).connect(ng).connect(a.destination);
  n.start(t);
}

export function snap() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const n = noise(a, 0.25);
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(2600, t);
  bp.frequency.exponentialRampToValueAtTime(700, t + 0.2);
  bp.Q.value = 0.8;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  n.connect(bp).connect(g).connect(a.destination);
  n.start(t);
  // a low thump under it
  const o = a.createOscillator();
  const og = a.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(og).connect(a.destination);
  o.start(t);
  o.stop(t + 0.16);
}
