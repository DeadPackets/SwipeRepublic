const SOUND_KEY = "swipe-republic:sound";
let enabled = (() => {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return false;
  }
})();
let context: AudioContext | null = null;

export const soundEnabled = () => enabled;
export function setSound(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  if (on) chime();
}
export const haptic = (pattern: number | number[]) => navigator.vibrate?.(pattern);

function audio() {
  if (!enabled) return null;
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}
function envelope(c: AudioContext, at: number, peak: number, attack: number, decay: number) {
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  gain.connect(c.destination);
  return gain;
}
export function whoosh() {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  const length = 0.32;
  const buffer = c.createBuffer(1, c.sampleRate * length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = c.createBufferSource();
  source.buffer = buffer;
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.Q.value = 0.9;
  band.frequency.setValueAtTime(500, at);
  band.frequency.exponentialRampToValueAtTime(2600, at + length);
  source.connect(band).connect(envelope(c, at, 0.22, 0.04, length - 0.04));
  source.start(at);
}
export function tick(up: boolean) {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = up ? 1320 : 520;
  osc.connect(envelope(c, at, 0.09, 0.005, 0.09));
  osc.start(at);
  osc.stop(at + 0.12);
}
export function sting() {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  const low = c.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.setValueAtTime(1400, at);
  low.frequency.exponentialRampToValueAtTime(160, at + 1.6);
  low.connect(envelope(c, at, 0.18, 0.02, 1.7));
  for (const f of [73.4, 77.8, 110]) {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    osc.connect(low);
    osc.start(at);
    osc.stop(at + 1.8);
  }
}
export function chime() {
  const c = audio();
  if (!c) return;
  const at = c.currentTime;
  [880, 1318.5].forEach((f, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    osc.connect(envelope(c, at + i * 0.09, 0.08, 0.01, 0.9));
    osc.start(at + i * 0.09);
    osc.stop(at + 1.2);
  });
}
