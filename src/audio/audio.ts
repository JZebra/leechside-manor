// Sound effects through one master gain, ported from Thirty Leeches (src/ui/audio.js).
// Sources per sound, tried in order: file (public/sfx/) → noise (filtered) → def (jsfxr).
// Audio is decoration: nothing here may throw into the game. Mute persists.

import { sfxr } from 'jsfxr';
import { SOUNDS, SOUND_DEFAULTS, type NoiseSpec, type SoundName, type SoundSpec } from './sounds';
import { setMusicMuted, unlockMusic } from './music';

const MUTE_KEY = 'lc-muted';
let muted = false;
try {
  muted = localStorage.getItem(MUTE_KEY) === '1';
} catch {
  /* storage unavailable */
}
setMusicMuted(muted);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const synthBuffers: Partial<Record<SoundName, AudioBuffer | null>> = {};
const fileBuffers: Partial<Record<SoundName, AudioBuffer[]>> = {};
const noiseBuffers: Record<string, AudioBuffer> = {};
const lastPlayed: Partial<Record<SoundName, number>> = {};
const MAX_ATTACK = 0.015; // seconds

function context(): AudioContext | null {
  if (ctx) return ctx;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

const spec = (name: SoundName): SoundSpec => SOUNDS[name];

function loadFiles() {
  const c = ctx;
  if (!c) return;
  for (const name of Object.keys(SOUNDS) as SoundName[]) {
    const file = spec(name).file;
    if (!file) continue;
    const paths = Array.isArray(file) ? file : [file];
    Promise.all(paths.map((p) =>
      fetch(p)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(p))))
        .then((data) => c.decodeAudioData(data))))
      .then((bufs) => (fileBuffers[name] = bufs))
      .catch(() => { /* missing: keep the synthesized fallback */ });
  }
}

function synthBuffer(name: SoundName): AudioBuffer | null {
  const cached = synthBuffers[name];
  if (cached !== undefined) return cached;
  const def = spec(name).def;
  try {
    synthBuffers[name] = def ? sfxr.toWebAudio({ ...SOUND_DEFAULTS, ...def }, ctx!).buffer : null;
  } catch {
    synthBuffers[name] = null;
  }
  return synthBuffers[name] ?? null;
}

// Two seconds of smooth white noise, with sparse clicks for crackle.
function noiseBuffer(c: AudioContext, crackle = 0): AudioBuffer {
  const key = crackle.toFixed(2);
  if (noiseBuffers[key]) return noiseBuffers[key];
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    d[i] = Math.random() * 2 - 1;
    if (crackle && Math.random() < crackle * 0.004) d[i] += Math.random() < 0.5 ? -1.2 : 1.2;
  }
  return (noiseBuffers[key] = buf);
}

function playNoise(c: AudioContext, out: AudioNode, n: NoiseSpec, rate: number, vol: number) {
  const t0 = c.currentTime;
  const dur = n.dur / rate;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, n.crackle);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = n.q ?? 0.8;
  const [f0, f1, f2 = f1] = n.band;
  bp.frequency.setValueAtTime(f0 * rate, t0);
  bp.frequency.exponentialRampToValueAtTime(f1 * rate, t0 + dur * 0.45);
  bp.frequency.exponentialRampToValueAtTime(f2 * rate, t0 + dur);
  // A short linear attack: an exponential one from silence is inaudible for most of its
  // length, so the sound seemed to arrive late. Long swells are capped for the same reason.
  const attack = Math.min(n.attack ?? 0.01, MAX_ATTACK, dur * 0.5);
  const env = c.createGain();
  env.gain.setValueAtTime(0, t0);
  env.gain.linearRampToValueAtTime(n.vol * vol, t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  let node: AudioNode = src.connect(bp).connect(env);
  if (n.am) {
    const am = c.createGain();
    am.gain.value = 1 - n.am.depth / 2;
    const lfo = c.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = n.am.rate * rate;
    const depth = c.createGain();
    depth.gain.value = n.am.depth / 2;
    lfo.connect(depth).connect(am.gain);
    lfo.start(t0);
    lfo.stop(t0 + dur + 0.05);
    node = node.connect(am);
  }
  node.connect(out);
  src.start(t0, Math.random() * 1.5, dur + 0.05);
}

function playBuffer(c: AudioContext, out: AudioNode, buf: AudioBuffer, rate: number, vol: number) {
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(g).connect(out);
  src.start();
}

export const isMuted = () => muted;

// For diagnosis: the context and master bus (latency figures, in-graph timing).
export const audioDebug = () => ({
  ctx,
  master,
  files: Object.fromEntries(Object.entries(fileBuffers).map(([k, v]) => [k, v?.length ?? 0])), // decoded takes per sound
});

// M mutes everything: sound effects and music.
export function setMuted(m: boolean) {
  muted = m;
  setMusicMuted(m);
  if (master) master.gain.value = m ? 0 : 0.8; // silences running loops too
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    /* storage unavailable */
  }
}

// vol scales one play; rate sets the pitch (instead of the random vary); minGap (s) stops a
// sound stacking when many things happen at once.
export function sfx(name: SoundName, opts: { vol?: number; minGap?: number; rate?: number } = {}) {
  if (muted) return;
  const c = context();
  const s = spec(name);
  if (!s || !c || !master) return;
  const now = c.currentTime;
  if (opts.minGap && now - (lastPlayed[name] ?? -1) < opts.minGap) return;
  lastPlayed[name] = now;
  if (c.state === 'suspended') c.resume().catch(() => {});
  const rate = opts.rate ?? 1 + (Math.random() * 2 - 1) * (s.vary || 0);
  const vol = opts.vol ?? 1;
  try {
    const files = fileBuffers[name];
    if (files && files.length) return playBuffer(c, master, files[Math.floor(Math.random() * files.length)], rate, vol * (s.vol ?? 1));
    if (s.noise) return playNoise(c, master, s.noise, rate, vol);
    const buf = synthBuffer(name);
    if (buf) playBuffer(c, master, buf, rate, vol);
  } catch {
    /* never let audio break the game */
  }
}

// A recording played on a loop (the kettle simmering). Returns null until the file has
// loaded — call again later. The handle sets the loop's level and stops it.
export interface Loop { setVolume(v: number): void; stop(): void }
export function startLoop(name: SoundName, vol = 0): Loop | null {
  const c = ctx;
  const buf = fileBuffers[name]?.[0];
  if (!c || !master || !buf) return null;
  try {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(g).connect(master);
    src.start();
    const base = spec(name).vol ?? 1;
    return {
      setVolume: (v: number) => g.gain.setTargetAtTime(v * base, c.currentTime, 0.15),
      stop: () => {
        try { src.stop(); } catch { /* already stopped */ }
        src.disconnect();
      },
    };
  } catch {
    return null;
  }
}

// Render every synthesized sound ahead of time, a few per tick, so no first play stalls.
function warm(c: AudioContext) {
  const names = Object.keys(SOUNDS) as SoundName[];
  const step = () => {
    for (const name of names.splice(0, 4)) {
      const s = spec(name);
      if (s.def) synthBuffer(name);
      if (s.noise) noiseBuffer(c, s.noise.crackle);
    }
    if (names.length) setTimeout(step, 0);
  };
  step();
}

// Browsers only allow audio after a gesture: warm up on the first one.
export function installAudioUnlock() {
  const unlock = () => {
    unlockMusic(); // must run inside the gesture
    const c = context();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
    if (c) {
      loadFiles();
      warm(c);
    }
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}
