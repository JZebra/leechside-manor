// The shift: the clock from eight to the six o'clock bell, the stages that
// introduce each mechanic, patient arrivals, and the day's takings.

import { CONFIG, type PatientType, type StageId } from '../config';
import { makeRng, type Rng } from './rng';
import { FIRST_NAMES, SURNAMES, REGIMENTS, RANKS } from './names';
import type { Profile } from './patient';

export type ShiftEvent =
  | { kind: 'stage'; id: StageId }
  | { kind: 'arrival'; type: PatientType; profile: Profile }
  | { kind: 'bell' };

export interface Entry {
  profile: Profile;
  type: PatientType;
  outcome: string;
  fee: number;
}

const SKINS = ['A', 'A', 'B', 'B', 'B', 'C'];
const HAIRS = ['hairBlack', 'hairDark', 'hairDark', 'hairBrown', 'hairBrown', 'hairAuburn', 'hairBlond'];

export class Shift {
  readonly rng: Rng;
  elapsed = 0; // real seconds
  stageIndex = 0;
  money = 0;
  over = false;
  log: Entry[] = [];
  private arrivalIn = 0;
  private opening: number = CONFIG.arrivals.opening;
  private usedNames = new Set<string>();

  constructor(seed: string) {
    this.rng = makeRng(seed, 'shift');
  }

  get minutes(): number {
    const { startMinutes, endMinutes, realSeconds } = CONFIG.shift;
    return Math.min(endMinutes, startMinutes + (this.elapsed / realSeconds) * (endMinutes - startMinutes));
  }

  get stage(): StageId {
    return CONFIG.stages[this.stageIndex].id;
  }

  stageReached(id: StageId): boolean {
    return CONFIG.stages.findIndex((s) => s.id === id) <= this.stageIndex;
  }

  clockText(): string {
    const m = Math.floor(this.minutes);
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  }

  profile(type: PatientType): Profile {
    const r = this.rng;
    let surname = r.pick(SURNAMES);
    for (let i = 0; i < 20 && this.usedNames.has(surname); i++) surname = r.pick(SURNAMES);
    this.usedNames.add(surname);
    const first = r.pick(FIRST_NAMES);
    const drummer = type === 'drummer';
    return {
      name: `${first} ${surname}`,
      surname,
      rank: drummer ? 'Drummer' : r.pick(RANKS),
      regiment: r.pick(REGIMENTS),
      portrait: {
        skin: r.pick(SKINS),
        hair: r.pick(HAIRS),
        moustache: !drummer && r.chance(0.5),
      },
    };
  }

  private arrival(): ShiftEvent {
    const type = this.rng.weighted(CONFIG.arrivals.mix[this.stage]) as PatientType;
    return { kind: 'arrival', type, profile: this.profile(type) };
  }

  tick(dt: number): ShiftEvent[] {
    if (this.over) return [];
    const out: ShiftEvent[] = [];
    if (this.elapsed === 0) out.push({ kind: 'stage', id: this.stage });
    this.elapsed += dt;

    const next = CONFIG.stages[this.stageIndex + 1];
    if (next && this.minutes >= next.at) {
      this.stageIndex++;
      out.push({ kind: 'stage', id: next.id });
    }

    if (this.opening > 0) {
      this.opening--;
      out.push(this.arrival());
      if (this.opening === 0) this.arrivalIn = CONFIG.arrivals.interval[this.stage];
    } else {
      this.arrivalIn -= dt;
      if (this.arrivalIn <= 0) {
        this.arrivalIn = CONFIG.arrivals.interval[this.stage];
        out.push(this.arrival());
      }
    }

    if (this.minutes >= CONFIG.shift.endMinutes) {
      this.over = true;
      out.push({ kind: 'bell' });
    }
    return out;
  }

  record(entry: Entry) {
    this.log.push(entry);
    this.money += entry.fee;
  }

  fine(amount: number) {
    this.money += amount;
  }

  verdict(): 'APPROVED' | 'NOTED' | 'REPRIMAND' {
    const v = CONFIG.score.verdict;
    return this.money >= v.approved ? 'APPROVED' : this.money >= v.noted ? 'NOTED' : 'REPRIMAND';
  }
}
