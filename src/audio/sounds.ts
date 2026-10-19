// Sound effects, from Thirty Leeches (src/data/sounds.js) plus the ward's own.
// Each sound uses the first source it has (see audio.ts):
//   file:  'sfx/pump.ogg' or an array of variants in public/sfx/. Missing files fall back below.
//   noise: smooth white noise through a band-pass filter sweeping band [start, peak, end] Hz,
//          with an attack/decay envelope; optional crackle (0–1) and am { rate Hz, depth 0–1 }.
//   def:   a jsfxr definition (overrides on SOUND_DEFAULTS). wave_type: 0 square, 1 saw, 2 sine, 3 noise.
// vary: random playback-rate spread so repeats don't sound mechanical.

export interface NoiseSpec {
  dur: number;
  attack?: number;
  band: [number, number, number?];
  q?: number;
  vol: number;
  crackle?: number;
  am?: { rate: number; depth: number };
}

export interface SoundSpec {
  file?: string | string[];
  noise?: NoiseSpec;
  def?: Record<string, number>;
  vary?: number;
}

export const SOUND_DEFAULTS: Record<string, number> = {
  wave_type: 0, p_env_attack: 0, p_env_sustain: 0.3, p_env_punch: 0, p_env_decay: 0.4,
  p_base_freq: 0.3, p_freq_limit: 0, p_freq_ramp: 0, p_freq_dramp: 0, p_vib_strength: 0, p_vib_speed: 0,
  p_arp_mod: 0, p_arp_speed: 0, p_duty: 0, p_duty_ramp: 0, p_repeat_speed: 0, p_pha_offset: 0, p_pha_ramp: 0,
  p_lpf_freq: 1, p_lpf_ramp: 0, p_lpf_resonance: 0, p_hpf_freq: 0, p_hpf_ramp: 0,
  sound_vol: 0.5, sample_rate: 44100, sample_size: 8,
};

export const SOUNDS = {
  // ── from Thirty Leeches ──
  page: { noise: { dur: 0.36, attack: 0.06, band: [600, 2600, 1200], q: 0.7, vol: 1.2, crackle: 0.3 }, vary: 0.12 },
  scratch: { noise: { dur: 0.22, attack: 0.01, band: [3200, 4200, 3000], q: 1.6, vol: 0.5, am: { rate: 22, depth: 0.85 } }, vary: 0.15 },
  clink: { def: { wave_type: 2, p_env_sustain: 0.02, p_env_decay: 0.32, p_env_punch: 0.45, p_base_freq: 0.74, p_arp_mod: 0.32, p_arp_speed: 0.62, sound_vol: 0.22 }, vary: 0.08 },
  plip: { def: { wave_type: 2, p_env_sustain: 0.08, p_env_decay: 0.2, p_base_freq: 0.4, p_freq_ramp: 0.38, p_lpf_freq: 0.62, sound_vol: 0.36 }, vary: 0.18 },
  squelch: { def: { wave_type: 3, p_env_sustain: 0.14, p_env_decay: 0.3, p_base_freq: 0.2, p_freq_ramp: -0.22, p_lpf_freq: 0.3, p_lpf_resonance: 0.65, p_pha_offset: 0.2, sound_vol: 0.32 }, vary: 0.12 },
  salt: { noise: { dur: 0.45, attack: 0.03, band: [5000, 6500, 4500], q: 0.6, vol: 0.2, crackle: 0.8, am: { rate: 30, depth: 0.6 } }, vary: 0.05 },
  bell: { def: { wave_type: 2, p_env_sustain: 0.22, p_env_decay: 0.92, p_env_punch: 0.5, p_base_freq: 0.36, p_vib_strength: 0.05, p_vib_speed: 0.3, p_arp_mod: -0.18, p_arp_speed: 0.7, sound_vol: 0.34 }, vary: 0 },
  click: { def: { wave_type: 0, p_env_sustain: 0.04, p_env_decay: 0.08, p_base_freq: 0.5, p_hpf_freq: 0.32, p_duty: 0.5, sound_vol: 0.1 }, vary: 0.1 },
  door: { def: { wave_type: 3, p_env_sustain: 0.05, p_env_decay: 0.3, p_env_punch: 0.45, p_base_freq: 0.08, p_lpf_freq: 0.24, sound_vol: 0.3 }, vary: 0.1 },
  thud: { def: { wave_type: 3, p_env_sustain: 0.04, p_env_decay: 0.42, p_env_punch: 0.62, p_base_freq: 0.05, p_lpf_freq: 0.2, sound_vol: 0.46 }, vary: 0.05 },
  stamp: { def: { wave_type: 3, p_env_sustain: 0.06, p_env_decay: 0.3, p_env_punch: 0.8, p_base_freq: 0.14, p_lpf_freq: 0.34, sound_vol: 0.46 }, vary: 0.05 },
  gasp: { noise: { dur: 0.45, attack: 0.18, band: [500, 1300, 700], q: 0.5, vol: 0.4 }, vary: 0.05 },
  // ── the ward ──
  // lint pressed on: a soft cloth pat
  pat: { noise: { dur: 0.16, attack: 0.01, band: [900, 1400, 600], q: 0.6, vol: 0.7 }, vary: 0.15 },
  // picking something up off a shelf
  pick: { noise: { dur: 0.1, attack: 0.005, band: [1800, 2600, 1600], q: 0.9, vol: 0.45 }, vary: 0.2 },
  // the bdellometer's piston: a wheezing suck
  pump: { noise: { dur: 0.32, attack: 0.08, band: [300, 900, 500], q: 1.1, vol: 0.55, am: { rate: 9, depth: 0.5 } }, vary: 0.06 },
  // a kettle's sigh as sugar-water is poured
  pour: { noise: { dur: 0.5, attack: 0.05, band: [1400, 2400, 1800], q: 1.4, vol: 0.35, am: { rate: 18, depth: 0.4 } }, vary: 0.08 },
  // a leech refusing: a wet little 'pfft'
  refuse: { def: { wave_type: 3, p_env_sustain: 0.05, p_env_decay: 0.16, p_base_freq: 0.32, p_freq_ramp: -0.4, p_lpf_freq: 0.4, sound_vol: 0.28 }, vary: 0.15 },
  // warning: the meter crossing into the blue
  tick: { def: { wave_type: 2, p_env_sustain: 0.02, p_env_decay: 0.14, p_base_freq: 0.62, sound_vol: 0.22 }, vary: 0.02 },
  // the green: just right
  ding: { def: { wave_type: 2, p_env_sustain: 0.05, p_env_decay: 0.36, p_env_punch: 0.3, p_base_freq: 0.52, p_arp_mod: 0.3, p_arp_speed: 0.55, sound_vol: 0.22 }, vary: 0 },
  // coins in the box
  coin: { def: { wave_type: 0, p_env_sustain: 0.04, p_env_decay: 0.28, p_env_punch: 0.4, p_base_freq: 0.6, p_arp_mod: 0.42, p_arp_speed: 0.6, p_duty: 0.4, p_lpf_freq: 0.6, sound_vol: 0.16 }, vary: 0.04 },
  // a jar of fresh leeches set down
  delivery: { def: { wave_type: 3, p_env_sustain: 0.08, p_env_decay: 0.36, p_env_punch: 0.4, p_base_freq: 0.12, p_lpf_freq: 0.28, sound_vol: 0.36 }, vary: 0.05 },
  // a leech slipping over the jar's rim
  slither: { noise: { dur: 0.4, attack: 0.1, band: [700, 1600, 900], q: 2.2, vol: 0.4, am: { rate: 7, depth: 0.7 } }, vary: 0.1 },
  // a stretcher's poles knocking the bedframe
  stretcher: { def: { wave_type: 3, p_env_sustain: 0.03, p_env_decay: 0.24, p_env_punch: 0.6, p_base_freq: 0.18, p_lpf_freq: 0.3, sound_vol: 0.34 }, vary: 0.1 },
  // feet out from under him: a skid on wet stone
  slip: { noise: { dur: 0.28, attack: 0.005, band: [2600, 900, 300], q: 0.9, vol: 0.9 }, vary: 0.1 },
  // an orderly's grunt as he's held up
  grunt: { noise: { dur: 0.2, attack: 0.01, band: [300, 520, 260], q: 2.5, vol: 0.5, am: { rate: 40, depth: 0.5 } }, vary: 0.15 },
  // can't: a dull wooden knock
  nope: { def: { wave_type: 1, p_env_sustain: 0.03, p_env_decay: 0.12, p_base_freq: 0.18, p_lpf_freq: 0.3, sound_vol: 0.2 }, vary: 0.05 },
} satisfies Record<string, SoundSpec>;

export type SoundName = keyof typeof SOUNDS;
