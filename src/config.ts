// Every gameplay number in one place. Start generous; pressure should come from
// overlapping tasks, not short timers. Blood is a 0–1 "drawn" meter per patient.

export type PatientType = 'soldier' | 'anaemic' | 'drummer' | 'nervous';
export type StageId = 'basics' | 'frail' | 'promotion' | 'machine' | 'shortage' | 'drummers';
export type WardId = 'saintCome' | 'saintLouis';

export interface DaySpec {
  title: string;
  ward: WardId;
  realSeconds: number; // 8:00 to the six o'clock bell, in real seconds
  jar: number; // leeches in Madame Ricard's jar at eight
  deliveries: boolean; // does her boy bring more during the day?
  escapes: boolean; // do hungry leeches climb out of the jar?
  orderlies: boolean; // orderlies crossing the ward
  coldChance: number; // share of men who arrive chilled (no leech takes until warmed)
  stages: { id: StageId; at: number }[]; // clock minutes; each opens with a note (data/lines.ts)
  verdict: { approved: number; noted: number }; // francs at six (see npm run sim)
}

export interface StageSpec {
  interval: number; // seconds between arrivals
  mix: Partial<Record<PatientType, number>>; // which men arrive (weights)
  machine?: boolean; // the bdellometer is on its stand from this stage
}

export const CONFIG = {
  shift: {
    startMinutes: 8 * 60,
    endMinutes: 18 * 60,
  },

  days: [
    {
      title: 'Day 1 — the Salle Saint-Côme',
      ward: 'saintCome',
      realSeconds: 200,
      jar: 9,
      deliveries: true,
      escapes: false,
      orderlies: false,
      coldChance: 0,
      stages: [
        { id: 'basics', at: 8 * 60 },
        { id: 'frail', at: 12 * 60 },
      ],
      verdict: { approved: 115, noted: 65 },
    },
    {
      title: 'Day 2 — the Salle Saint-Louis',
      ward: 'saintLouis',
      realSeconds: 230,
      jar: 10,
      deliveries: true,
      escapes: true,
      orderlies: true,
      coldChance: 0.25,
      stages: [
        { id: 'promotion', at: 8 * 60 },
        { id: 'machine', at: 12 * 60 + 30 },
      ],
      verdict: { approved: 80, noted: 35 },
    },
    {
      title: 'Day 3 — the great shortage',
      ward: 'saintLouis',
      realSeconds: 230,
      jar: 18,
      deliveries: false,
      escapes: true,
      orderlies: true,
      coldChance: 0.2,
      stages: [
        { id: 'shortage', at: 8 * 60 },
        { id: 'drummers', at: 12 * 60 },
      ],
      verdict: { approved: 70, noted: 30 },
    },
  ] as DaySpec[],

  stages: {
    basics: { interval: 17, mix: { soldier: 1 } },
    frail: { interval: 14, mix: { soldier: 3, anaemic: 1.4 } },
    promotion: { interval: 13, mix: { soldier: 3, anaemic: 1 } },
    machine: { interval: 12, mix: { soldier: 3, anaemic: 1.2 }, machine: true },
    shortage: { interval: 14, mix: { soldier: 3, anaemic: 1.2 }, machine: true },
    drummers: { interval: 13, mix: { soldier: 3, anaemic: 1, drummer: 0.9, nervous: 0.9 }, machine: true },
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
      soldier: { green: [0.55, 0.8], faintAt: 0.92, afterBleed: 1, label: 'Soldier' },
      anaemic: { green: [0.42, 0.55], faintAt: 0.62, afterBleed: 1, label: 'Anaemic' },
      drummer: { green: [0.45, 0.7], faintAt: 0.82, afterBleed: 2.5, label: 'Drummer boy' },
      nervous: { green: [0.55, 0.8], faintAt: 0.92, afterBleed: 1, label: 'Nervous conscript' },
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
    cap: 14,
    deliveryEvery: 24, // seconds
    deliverySize: 4,
  },

  orderly: {
    every: 9, // seconds between orderlies crossing (days with orderlies)
    speed: 34, // art px per second
    patience: 2.5, // seconds an orderly waits for the doctor to move before squeezing past
  },

  slip: {
    chance: 0.25, // per fed leech stepped on while walking
    radius: 3, // art px from the doctor's feet
    dazed: 3, // seconds on the floor
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
    pickReach: 12, // art px to a leech on the floor
    handful: 3, // hungry leeches carried at once
    scoop: 5, // fed leeches carried in one handful
    calmRange: 26, // art px: a nervous man is calmed while the doctor is this close
  },
} as const;
