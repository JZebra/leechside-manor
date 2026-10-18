// Every gameplay number in one place. Start generous; pressure should come from
// overlapping tasks, not short timers. Blood is a 0–1 "drawn" meter per patient.

export type PatientType = 'soldier' | 'anaemic' | 'drummer' | 'nervous';
export type StageId = 'basics' | 'frail' | 'stubborn' | 'machine' | 'shortage';

export const CONFIG = {
  // One shift: 8:00 to the six o'clock bell.
  shift: {
    realSeconds: 420, // ~7 minutes of play
    startMinutes: 8 * 60,
    endMinutes: 18 * 60,
  },

  // Mechanics arrive in stages, each announced by a note (data/lines.ts).
  stages: [
    { id: 'basics', at: 8 * 60 },
    { id: 'frail', at: 10 * 60 },
    { id: 'stubborn', at: 12 * 60 },
    { id: 'machine', at: 13 * 60 + 30 },
    { id: 'shortage', at: 15 * 60 },
  ] as { id: StageId; at: number }[],

  arrivals: {
    opening: 2, // patients already waiting at 8:00
    // seconds between arrivals, by stage
    interval: { basics: 17, frail: 14, stubborn: 13, machine: 12, shortage: 11 } as Record<StageId, number>,
    // which patient types arrive, by stage (weights)
    mix: {
      basics: { soldier: 1 },
      frail: { soldier: 3, anaemic: 1 },
      stubborn: { soldier: 3, anaemic: 1 },
      machine: { soldier: 3, anaemic: 1.2 },
      shortage: { soldier: 3, anaemic: 1.2, drummer: 0.8, nervous: 0.8 },
    } as Record<StageId, Partial<Record<PatientType, number>>>,
  },

  patient: {
    maxLeeches: 3,
    patience: 45, // seconds in bed before anyone touches him; then he walks out
    queuePatience: 50, // seconds waiting at the door for a bed
    // green band [start, end]; blue (warning) runs from end to faintAt
    types: {
      soldier: { green: [0.55, 0.8], faintAt: 0.92, afterBleed: 1, label: 'Soldier' },
      anaemic: { green: [0.42, 0.55], faintAt: 0.62, afterBleed: 1, label: 'Anaemic' },
      drummer: { green: [0.45, 0.7], faintAt: 0.82, afterBleed: 2.5, label: 'Drummer boy' },
      nervous: { green: [0.55, 0.8], faintAt: 0.92, afterBleed: 1, label: 'Nervous conscript' },
    } as Record<PatientType, { green: [number, number]; faintAt: number; afterBleed: number; label: string }>,
    panic: {
      rise: 0.025, // per second while the doctor is away
      perLeech: 0.18, // a jolt each time a leech goes on
      calm: 0.12, // per second while the doctor stands by him
    },
  },

  leech: {
    feedSeconds: 9, // hungry → sated
    extraction: 0.022, // blood per second while feeding (≈0.2 per leech)
    afterBleed: 0.012, // blood per second per open bite, until lint
    stubbornChance: 0.18, // from the 'stubborn' stage
    escape: {
      every: 16, // seconds between escape checks, from the 'stubborn' stage
      chance: 0.55,
      minJar: 2, // leeches only escape from a jar with at least this many
      crawlSpeed: 7, // art px per second
      latchRange: 10, // art px: an escapee this close to an unattended patient climbs on
    },
  },

  machine: {
    rate: 0.09, // blood per second while pumping: ≈4 leeches, no after-bleed
  },

  supply: {
    start: 8,
    cap: 14,
    deliveryEvery: 24, // seconds
    deliverySize: 4,
    shortage: { warnSeconds: 12, seconds: 70 }, // starts with the 'shortage' stage
  },

  score: {
    green: 12, // francs: bled just right
    early: 5, // lint before the green
    late: 7, // lint in the blue, before he faints
    faint: -10,
    walkedOut: -6,
    leechLost: -2,
    verdict: { approved: 190, noted: 110 }, // francs at six o'clock
  },

  doctor: {
    speed: 78, // art px per second
    carrying: 0.55, // speed multiplier while carrying a fainted man
    reach: 16, // art px from the doctor's feet to a target's edge
  },
} as const;
