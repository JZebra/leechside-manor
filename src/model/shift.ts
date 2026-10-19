// One day's shift: the clock from eight to the six o'clock bell, the stages that
// introduce each mechanic, patient arrivals, and the day's takings.

import { CONFIG, type DaySpec, type PatientType, type StageId } from '../config';
import { makeRng, type Rng } from './rng';
import { FIRST_NAMES, SURNAMES, REGIMENTS, RANKS } from './names';
import type { Profile } from './patient';

export type ShiftEvent =
  | { kind: 'stage'; id: StageId }
  | { kind: 'arrival'; type: PatientType; profile: Profile; cold: boolean }
  | { kind: 'bell' };

export interface Entry {
  profile: Profile;
  type: PatientType;
  outcome: string;
  fee: number;
}

const SKINS = ['A', 'A', 'B', 'B', 'B', 'C'];
const HAIRS = ['hairBlack', 'hairDark', 'hairDark', 'hairBrown', 'hairBrown', 'hairAuburn', 'hairBlond'];

// A man's coat, if he kept it on, is his regiment's.
function coatOf(regiment: string): string {
  if (regiment.includes('Ligne')) return 'ligne';
  if (regiment.includes('Léger')) return 'leger';
  if (regiment.includes('Grenadiers')) return 'grenadier';
  if (regiment.includes('Hussards')) return 'hussar';
  return 'artillery';
}

export class Shift {
  readonly rng: Rng;
  private readonly looks: Rng; // cosmetic only: its own stream, so a seed's patients and fates don't change
  readonly day: number; // 0-based index into CONFIG.days
  readonly spec: DaySpec;
  elapsed = 0; // real seconds
  stageIndex = 0;
  money = 0;
  over = false;
  log: Entry[] = [];
  private arrivalIn = 0;
  private opening: number = CONFIG.arrivals.opening;
  private usedNames = new Set<string>();
  private started = false;

  constructor(seed: string, day = 0) {
    this.day = day;
    this.spec = CONFIG.days[day];
    this.rng = makeRng(seed, 'shift', day);
    this.looks = makeRng(seed, 'looks', day);
  }

  get minutes(): number {
    const { startMinutes, endMinutes } = CONFIG.shift;
    return Math.min(endMinutes, startMinutes + (this.elapsed / this.spec.realSeconds) * (endMinutes - startMinutes));
  }

  get stage(): StageId {
    return this.spec.stages[this.stageIndex].id;
  }

  get stageSpec() {
    return CONFIG.stages[this.stage];
  }

  clockText(): string {
    const m = Math.floor(this.minutes);
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  }

  // Seconds of play from 8:00 to a clock time on this day.
  secondsAt(minutes: number): number {
    const { startMinutes, endMinutes } = CONFIG.shift;
    return ((minutes - startMinutes) / (endMinutes - startMinutes)) * this.spec.realSeconds;
  }

  profile(type: PatientType): Profile {
    const r = this.rng;
    let surname = r.pick(SURNAMES);
    for (let i = 0; i < 20 && this.usedNames.has(surname); i++) surname = r.pick(SURNAMES);
    this.usedNames.add(surname);
    const first = r.pick(FIRST_NAMES);
    const drummer = type === 'drummer';
    const regiment = r.pick(REGIMENTS);
    const moustache = !drummer && r.chance(0.5);
    const L = this.looks;
    return {
      name: `${first} ${surname}`,
      surname,
      rank: drummer ? 'Drummer' : r.pick(RANKS),
      regiment,
      portrait: {
        skin: r.pick(SKINS),
        hair: r.pick(HAIRS),
        moustache,
        beard: !drummer && !moustache && L.chance(0.3),
        // his coat over his shoulders (drummers keep their laced ones), or shirtsleeves, or the hospital gown
        outfit: drummer ? 'drummer' : L.chance(0.55) ? coatOf(regiment) : L.pick(['shirt', 'shirt', 'striped', 'gown']),
        hat: L.weighted({ none: 4, nightcap: 2.5, forage: 1.5, bandage: 1 }),
        blanket: L.weighted({ army: 4, brown: 2, check: 1.5, patch: 1 }),
      },
    };
  }

  private arrival(): ShiftEvent {
    const type = this.rng.weighted(this.stageSpec.mix) as PatientType;
    const cold = this.rng.chance(this.stageSpec.cold ?? 0);
    return { kind: 'arrival', type, profile: this.profile(type), cold };
  }

  tick(dt: number): ShiftEvent[] {
    if (this.over) return [];
    const out: ShiftEvent[] = [];
    if (!this.started) {
      this.started = true;
      out.push({ kind: 'stage', id: this.stage });
    }
    this.elapsed += dt;

    const next = this.spec.stages[this.stageIndex + 1];
    if (next && this.minutes >= next.at) {
      this.stageIndex++;
      out.push({ kind: 'stage', id: next.id });
    }

    if (this.opening > 0) {
      this.opening--;
      out.push(this.arrival());
      if (this.opening === 0) this.arrivalIn = this.stageSpec.interval;
    } else {
      this.arrivalIn -= dt;
      if (this.arrivalIn <= 0) {
        this.arrivalIn = this.stageSpec.interval;
        out.push(this.arrival());
      }
    }

    if (this.minutes >= CONFIG.shift.endMinutes) {
      this.over = true;
      out.push({ kind: 'bell' });
    }
    return out;
  }

  // Jump the clock to a stage (testing): earlier notes are skipped.
  skipTo(id: StageId): boolean {
    const i = this.spec.stages.findIndex((s) => s.id === id);
    if (i <= 0) return false;
    this.elapsed = this.secondsAt(this.spec.stages[i].at);
    this.stageIndex = i;
    this.started = true;
    return true;
  }

  record(entry: Entry) {
    this.log.push(entry);
    this.money += entry.fee;
  }

  fine(amount: number) {
    this.money += amount;
  }

  verdict(): 'APPROVED' | 'NOTED' | 'REPRIMAND' {
    const v = this.spec.verdict;
    return this.money >= v.approved ? 'APPROVED' : this.money >= v.noted ? 'NOTED' : 'REPRIMAND';
  }
}
