// Radio and music each own an <audio>; starting one pauses the other.
export const pauseOtherAudio = (el: HTMLAudioElement) =>
  document.querySelectorAll("audio").forEach((a) => a !== el && a.pause());

export const formatTime = (s: number) =>
  Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";

// --- Equalizer: both players feed one shared chain of filters ---------------------------
export const EQ_BANDS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export type EqState = { enabled: boolean; gains: number[] };

const STORE = "nirvana-eq";
let eq: EqState = { enabled: true, gains: EQ_BANDS.map(() => 0) };
try {
  const saved = JSON.parse(localStorage.getItem(STORE) ?? "null");
  if (saved?.gains?.length === EQ_BANDS.length) eq = saved;
} catch {} // no storage (SSR, private mode): start flat

let ctx: AudioContext | null = null;
let filters: BiquadFilterNode[] = [];
let analyser: AnalyserNode | null = null;

// Null until something has played (the audio graph is built on first play).
export const getAnalyser = () => analyser;
const attached = new WeakSet<HTMLAudioElement>();

const apply = () => filters.forEach((f, i) => (f.gain.value = eq.enabled ? eq.gains[i] : 0));

export const getEq = () => eq;

export function setEq(next: EqState) {
  eq = next;
  apply();
  try {
    localStorage.setItem(STORE, JSON.stringify(eq));
  } catch {}
}

// Call when an element starts playing (after a user click, so the AudioContext may start).
// The element must have crossOrigin="anonymous" and a CORS-enabled source, or it plays silence.
export function attachEq(el: HTMLAudioElement) {
  if (!ctx) {
    ctx = new AudioContext();
    const c = ctx;
    filters = EQ_BANDS.map((freq, i) => {
      const f = c.createBiquadFilter();
      f.type = i === 0 ? "lowshelf" : i === EQ_BANDS.length - 1 ? "highshelf" : "peaking";
      f.frequency.value = freq;
      f.Q.value = 1.1;
      return f;
    });
    analyser = c.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    // source → EQ filters → analyser (visualizer sees the EQ'd sound) → speakers
    filters.reduce((a, b) => (a.connect(b), b)).connect(analyser);
    analyser.connect(c.destination);
    apply();
  }
  if (!attached.has(el)) {
    ctx.createMediaElementSource(el).connect(filters[0]);
    attached.add(el);
  }
  if (ctx.state === "suspended") ctx.resume();
}
