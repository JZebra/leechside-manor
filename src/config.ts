// Every gameplay number in one place. Start generous; pressure should come from
// overlapping tasks, not short timers. Blood is a 0–1 "drawn" meter per patient.

import { YEAR_TITLE, TYPE_LABEL, COLD_LABEL } from './data/lines';

export type PatientType = 'soldier' | 'anaemic' | 'drummer' | 'nervous';
export type StageId = 'basics' | 'frail' | 'chill' | 'promotion' | 'machine' | 'drummers' | 'cholera' | 'epidemic';
export type WardId = 'saintCome' | 'saintLouis';

// Each level is one day's shift in a year of Broussais's reign at the Val-de-Grâce, set to the
// real history: the leech craze at its height (1828), cholera in Hungary and the leech
// shipments slowed at the Austrian cordon (1831), cholera in Paris (1832).
export interface DaySpec {
  year: number;
  title: string; // shown on the title page and the report (words in data/lines.ts)
  ward: WardId;
  realSeconds: number; // 8:00 to the six o'clock bell, in real seconds
  jar: number; // leeches in Madame Ricard's jar at eight
  deliveries: { every: number; size: number } | null; // her boy with more leeches (null: none come)
  escapes: boolean; // do hungry leeches climb out of the jar?
  orderlies: boolean; // orderlies crossing the ward
  coldLabel: string; // what the cold, blue men are called this year ('chilled', 'cholera')
  stages: { id: StageId; at: number }[]; // clock minutes; each opens with a note (data/lines.ts)
  verdict: { approved: number; noted: number }; // francs at six (see npm run sim)
}

export interface StageSpec {
  interval: number; // seconds between arrivals
  mix: Partial<Record<PatientType, number>>; // which men arrive (weights)
  machine?: boolean; // the bdellometer is on its stand from this stage
  stove?: boolean; // the stove (and its kettle, for hot-water bottles) is in the ward from this stage
  cold?: number; // share of men who come in cold and blue: no leech takes until they're warmed
}

export const CONFIG = {
  shift: {
    startMinutes: 8 * 60,
    endMinutes: 18 * 60,
  },

  days: [
    {
      year: 1828,
      title: YEAR_TITLE[1828],
      ward: 'saintCome',
      realSeconds: 200,
      jar: 9,
      deliveries: { every: 24, size: 4 }, // plenty: France buys some 34 million leeches a year
      escapes: false,
      orderlies: false,
      coldLabel: COLD_LABEL[1828],
      stages: [
        { id: 'basics', at: 8 * 60 },
        { id: 'frail', at: 12 * 60 },
        { id: 'chill', at: 15 * 60 }, // the night watch in from the frost; the stove brought up
      ],
      verdict: { approved: 115, noted: 65 },
    },
    {
      year: 1831,
      title: YEAR_TITLE[1831],
      ward: 'saintLouis',
      realSeconds: 230,
      jar: 10,
      deliveries: { every: 28, size: 4 }, // slowed: cholera in Hungary, the Austrian cordon
      escapes: true,
      orderlies: true,
      coldLabel: COLD_LABEL[1831],
      stages: [
        { id: 'promotion', at: 8 * 60 },
        { id: 'machine', at: 12 * 60 + 30 },
        { id: 'drummers', at: 15 * 60 },
      ],
      verdict: { approved: 70, noted: 30 },
    },
    {
      year: 1832,
      title: YEAR_TITLE[1832],
      ward: 'saintLouis',
      realSeconds: 230,
      jar: 10, // a thin jar: the bdellometer has to carry the day
      deliveries: null, // every hospital in Paris is bleeding the cholera: none to be had
      escapes: true,
      orderlies: true,
      coldLabel: COLD_LABEL[1832],
      stages: [
        { id: 'cholera', at: 8 * 60 },
        { id: 'epidemic', at: 13 * 60 },
      ],
      verdict: { approved: 70, noted: 30 },
    },
  ] as DaySpec[],

  stages: {
    basics: { interval: 17, mix: { soldier: 1 } },
    frail: { interval: 14, mix: { soldier: 3, anaemic: 1.4 } },
    chill: { interval: 14, mix: { soldier: 3, anaemic: 1.4 }, stove: true, cold: 0.35 },
    promotion: { interval: 13, mix: { soldier: 3, anaemic: 1 }, stove: true, cold: 0.15 },
    machine: { interval: 12, mix: { soldier: 3, anaemic: 1.2 }, stove: true, cold: 0.15, machine: true },
    drummers: { interval: 12, mix: { soldier: 3, anaemic: 1, drummer: 0.9, nervous: 0.9 }, stove: true, cold: 0.15, machine: true },
    cholera: { interval: 15, mix: { soldier: 3, anaemic: 1.2, drummer: 0.6, nervous: 0.6 }, stove: true, cold: 0.3, machine: true },
    epidemic: { interval: 12, mix: { soldier: 3, anaemic: 1.2, drummer: 0.8, nervous: 0.8 }, stove: true, cold: 0.3, machine: true },
  } as Record<StageId, StageSpec>,

  arrivals: {
    opening: 2, // patients already waiting at 8:00
  },

  patient: {
    maxLeeches: 3,
    patience: 50, // seconds in bed before anyone touches him; then he walks out
    queuePatience: 50, // seconds waiting at the door for a bed
    turnaround: 2, // seconds for the orderly to bring the next man to a freed bed
    // green band [start, end]; blue (warning) runs from end to faintAt
    types: {
      soldier: { green: [0.55, 0.8], faintAt: 0.92, afterBleed: 1, label: TYPE_LABEL.soldier },
      anaemic: { green: [0.28, 0.36], faintAt: 0.42, afterBleed: 1, label: TYPE_LABEL.anaemic }, // frail: in the green soon, out of it sooner, and down before you know it
      drummer: { green: [0.45, 0.7], faintAt: 0.82, afterBleed: 2.5, label: TYPE_LABEL.drummer },
      nervous: { green: [0.55, 0.8], faintAt: 0.92, afterBleed: 1, label: TYPE_LABEL.nervous },
    } as Record<PatientType, { green: [number, number]; faintAt: number; afterBleed: number; label: string }>,
    panic: {
      rise: 0.02, // per second while the doctor is away
      perLeech: 0.18, // a jolt each time a leech goes on
      calm: 0.12, // per second while the doctor stands by him
    },
  },

  leech: {
    feedSeconds: 9, // hungry → sated
    extraction: 0.022, // blood per second while feeding (≈0.2 per leech)
    afterBleed: 0.008, // blood per second per open bite, until lint
    escape: {
      every: 16, // seconds between escape checks (days with escapes)
      chance: 0.5,
      minJar: 2, // leeches only escape from a jar with at least this many
      crawlSpeed: 8, // art px per second
      seekPatient: 0.5, // chance an escapee heads for a patient rather than the drain
      latchRange: 10, // art px: an escapee this close to an unattended patient climbs on
    },
    recycleSeconds: 30, // salted leeches disgorge and go back in the jar (they really did)
  },

  machine: {
    rate: 0.09, // blood per second while pumping: ≈4 leeches, no after-bleed
  },

  supply: {
    cap: 14, // deliveries never fill the jar past this (each year sets how often and how many)
  },

  orderly: {
    every: 9, // seconds between orderlies crossing (days with orderlies)
    speed: 34, // art px per second
    patience: 2.5, // seconds an orderly waits for the doctor to move before squeezing past
  },

  slip: {
    radius: 3, // art px from the doctor's feet (slips only happen at a run: see run.slipChance)
    dazed: 3, // seconds on the floor
  },

  // Shift: run. Faster, but every fed leech underfoot sends him flying, and running into
  // an orderly knocks him down.
  run: {
    speed: 1.7, // × walking speed
    slipChance: 1, // per fed leech stepped on while running
    stunned: 3, // seconds on the floor after running into an orderly
  },

  score: {
    green: 12, // francs: bled just right
    early: 5, // lint before the green
    late: 7, // lint in the blue, before he faints
    faint: -10,
    walkedOut: -6,
    leechLost: -2, // down the drain, or squashed underfoot
    floorLeech: -1, // each fed leech still on the floor at six
  },

  doctor: {
    speed: 78, // art px per second
    carrying: 0.55, // speed multiplier while carrying a fainted man
    reach: 14, // art px from the doctor's feet to a bed, or to a station's base
    pickReach: 20, // art px to a leech on the floor: generous, so he needn't tread near one to pick it up
    handful: 3, // hungry leeches carried at once
    scoop: 5, // fed leeches carried in one handful
    calmRange: 26, // art px: a nervous man is calmed while the doctor is this close
  },
} as const;
