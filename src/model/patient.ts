// A patient's physiology and treatment state. Pure logic, no Phaser: the ward
// scene calls these methods and renders the result; tests drive them directly.

import { CONFIG, type PatientType } from '../config';

export type Zone = 'red' | 'green' | 'blue';
export type PatientState = 'waiting' | 'treating' | 'fainted' | 'done' | 'left';
export type FaintCause = 'blood' | 'fright';

export interface Attached {
  fed: number; // 0 → 1
  wild: boolean; // climbed on by itself
}

export type PatientEvent =
  | { kind: 'leechDone'; slot: number }
  | { kind: 'ready' } // entered the green
  | { kind: 'warning' } // entered the blue
  | { kind: 'faint'; cause: FaintCause; dropped: number }
  | { kind: 'walkedOut' };

export type AttachResult = 'ok' | 'full' | 'refused' | 'busy';

export interface Profile {
  name: string;
  surname: string;
  rank: string;
  regiment: string;
  portrait: Record<string, unknown>;
}

export class Patient {
  readonly type: PatientType;
  readonly profile: Profile;
  state: PatientState = 'waiting';
  blood = 0; // drawn so far, 0–1
  wounds = 0; // open bites still bleeding
  leeches: (Attached | null)[];
  readonly cold: boolean; // chilled: no leech will take until he's warmed
  warmed = false; // sugar-water dabbed on
  patience: number;
  panic = 0;
  faintCause: FaintCause | null = null;
  outcome: 'green' | 'early' | 'late' | 'faint' | 'walkedOut' | null = null;
  private lastZone: Zone = 'red';

  constructor(type: PatientType, profile: Profile, cold = false) {
    this.type = type;
    this.profile = profile;
    this.cold = cold;
    this.patience = CONFIG.patient.patience;
    this.leeches = new Array(CONFIG.patient.maxLeeches).fill(null);
  }

  get spec() {
    return CONFIG.patient.types[this.type];
  }

  get active(): boolean {
    return this.state === 'waiting' || this.state === 'treating';
  }

  get attachedCount(): number {
    return this.leeches.filter(Boolean).length;
  }

  zone(): Zone {
    const [, g1] = this.spec.green;
    if (this.blood >= g1) return 'blue';
    if (this.blood >= this.spec.green[0]) return 'green';
    return 'red';
  }

  // 0 = his own colour … 3 = white as wax (the Thirty Leeches pallor ladder).
  pallorRung(): number {
    if (this.state === 'fainted') return 3;
    const base = this.type === 'anaemic' ? 2 : 0;
    const share = this.blood / this.spec.faintAt;
    const bled = share < 0.45 ? 0 : share < 0.85 ? 1 : 2;
    return Math.min(3, base + bled);
  }

  private start() {
    if (this.state === 'waiting') this.state = 'treating';
  }

  // Leeches won't take on cold skin (19th-c. manuals: warm it, dab it with milk or sugar-water).
  get chilled(): boolean {
    return this.cold && !this.warmed;
  }

  attach(wild = false): AttachResult {
    if (!this.active) return 'busy';
    if (this.chilled) return 'refused';
    const slot = this.leeches.indexOf(null);
    if (slot < 0) return 'full';
    this.leeches[slot] = { fed: 0, wild };
    this.start();
    if (this.type === 'nervous') this.panic = Math.min(1, this.panic + CONFIG.patient.panic.perLeech);
    return 'ok';
  }

  warm(): boolean {
    if (!this.active || this.warmed) return false;
    this.warmed = true;
    this.start();
    return true;
  }

  // The bdellometer: precise and immediate, no after-bleed.
  pump(dt: number): PatientEvent[] {
    if (!this.active) return [];
    this.start();
    this.blood += CONFIG.machine.rate * dt;
    return this.checkThresholds();
  }

  // Lint and amadou: stops everything. Returns the fee and how many leeches fell off.
  bandage(): { outcome: 'green' | 'early' | 'late'; fee: number; dropped: number } | null {
    if (!this.active) return null;
    const zone = this.zone();
    const outcome = zone === 'green' ? 'green' : zone === 'red' ? 'early' : 'late';
    const dropped = this.attachedCount;
    this.leeches.fill(null);
    this.wounds = 0;
    this.state = 'done';
    this.outcome = outcome;
    return { outcome, fee: CONFIG.score[outcome], dropped };
  }

  // Advance time. doctorNear: the doctor is standing by him (calms the nervous).
  tick(dt: number, doctorNear = false): PatientEvent[] {
    if (!this.active) return [];
    const events: PatientEvent[] = [];

    if (this.state === 'waiting') {
      this.patience -= dt;
      if (this.patience <= 0) {
        this.state = 'left';
        this.outcome = 'walkedOut';
        return [{ kind: 'walkedOut' }];
      }
    }

    // leeches feed; sated ones drop off and leave a bite
    this.leeches.forEach((l, slot) => {
      if (!l) return;
      const step = Math.min(dt, (1 - l.fed) * CONFIG.leech.feedSeconds);
      this.blood += CONFIG.leech.extraction * step;
      l.fed += dt / CONFIG.leech.feedSeconds;
      if (l.fed >= 1) {
        this.leeches[slot] = null;
        this.wounds++;
        events.push({ kind: 'leechDone', slot });
      }
    });

    // bites bleed on
    this.blood += this.wounds * CONFIG.leech.afterBleed * this.spec.afterBleed * dt;

    if (this.type === 'nervous') {
      const p = CONFIG.patient.panic;
      this.panic = Math.max(0, Math.min(1, this.panic + (doctorNear ? -p.calm : p.rise) * dt));
      if (this.panic >= 1) events.push(this.faint('fright'));
    }

    return events.concat(this.checkThresholds());
  }

  private checkThresholds(): PatientEvent[] {
    if (!this.active) return [];
    if (this.blood >= this.spec.faintAt) return [this.faint('blood')];
    const zone = this.zone();
    const out: PatientEvent[] = [];
    if (zone !== this.lastZone) {
      if (zone === 'green') out.push({ kind: 'ready' });
      if (zone === 'blue') out.push({ kind: 'warning' });
      this.lastZone = zone;
    }
    return out;
  }

  private faint(cause: FaintCause): PatientEvent {
    const dropped = this.attachedCount;
    this.leeches.fill(null);
    this.wounds = 0; // the stretcher-bearers press lint on as they lift him
    this.state = 'fainted';
    this.faintCause = cause;
    this.outcome = 'faint';
    return { kind: 'faint', cause, dropped };
  }
}
