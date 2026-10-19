// Background music: one looping track at a time, crossfaded when the scene changes.
// Tracks stream from public/music/ through <audio> elements (no decoding up front),
// start only after the first key or click (browsers forbid autoplay), and follow the
// mute toggle. A missing or unplayable file is skipped silently: music is decoration.
//
// Kevin MacLeod (incompetech.com), CC BY 4.0 — credited on the title page and in CREDITS.md.

export const TRACKS = {
  title: { src: 'music/ancient-rite.mp3', volume: 0.45 }, // "Ancient Rite"
  ward: { src: 'music/vanishing.mp3', volume: 0.3 }, // "Vanishing" — under the sound effects
} as const;
export type Track = keyof typeof TRACKS;

const FADE_MS = 900;
const players: Partial<Record<Track, HTMLAudioElement>> = {};
const fades = new Map<HTMLAudioElement, number>();
let wanted: Track | null = null;
let current: Track | null = null;
let unlocked = false;
let muted = false;

function player(name: Track): HTMLAudioElement | null {
  if (players[name]) return players[name]!;
  try {
    const el = new Audio(TRACKS[name].src);
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0;
    el.muted = muted;
    return (players[name] = el);
  } catch {
    return null;
  }
}

// Ramp an element's volume in small steps; pause it when it reaches silence.
function fade(el: HTMLAudioElement, to: number, ms = FADE_MS) {
  const prev = fades.get(el);
  if (prev) clearInterval(prev);
  const from = el.volume;
  const steps = Math.max(1, Math.round(ms / 50));
  let i = 0;
  const id = window.setInterval(() => {
    i++;
    el.volume = Math.min(1, Math.max(0, from + ((to - from) * i) / steps));
    if (i >= steps) {
      clearInterval(id);
      fades.delete(el);
      if (to === 0) el.pause();
    }
  }, 50);
  fades.set(el, id);
}

function switchTo(name: Track) {
  const el = player(name);
  if (current === name && el && !el.paused && !fades.has(el)) return; // already playing
  if (current && current !== name) {
    const old = players[current];
    if (old) fade(old, 0);
  }
  current = name;
  if (!el) return;
  el.play().then(
    () => fade(el, TRACKS[name].volume),
    () => { /* missing file or still locked: stay silent */ },
  );
}

// Ask for a track; it starts (or crossfades in) as soon as the browser allows sound.
export function playMusic(name: Track) {
  wanted = name;
  if (unlocked) switchTo(name);
}

// Call inside the first user gesture: Safari and Chrome only allow play() from one.
export function unlockMusic() {
  if (unlocked) return;
  unlocked = true;
  // prime every track inside the gesture (silently), so Safari lets it play later
  for (const name of Object.keys(TRACKS) as Track[]) {
    if (name === wanted) continue;
    const el = player(name);
    el?.play().then(() => { if (current !== name) el.pause(); }, () => {});
  }
  if (wanted) switchTo(wanted);
}

export function setMusicMuted(m: boolean) {
  muted = m;
  for (const el of Object.values(players)) if (el) el.muted = m;
}

// For diagnosis in the console: which track is wanted, playing, and at what volume.
export const musicDebug = () => ({
  wanted,
  current,
  unlocked,
  muted,
  players: Object.fromEntries(Object.entries(players).map(([k, el]) => [k, { paused: el!.paused, volume: +el!.volume.toFixed(2), time: +el!.currentTime.toFixed(1), error: el!.error?.code ?? null }])),
});
