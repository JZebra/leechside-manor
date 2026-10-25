// The ward as the server sends it, many times a second: everything the browsers draw,
// and nothing they don't. A man's record (name, looks) goes once, the first time he
// appears; after that only his state does. Each browser keeps a mirror Ward and pours
// the snapshots into it, so the scene draws a game online exactly as it draws one alone.

import { Patient, type Attached, type FaintCause, type PatientState, type Profile } from '../model/patient';
import type { Doctor, DoctorStats, Facing, Hand, Salting, Ward } from '../model/ward';
import type { PatientType } from '../config';

export interface PatientRecord {
  type: PatientType;
  profile: Profile;
  cold: boolean;
}

interface PatientSnap {
  id: number;
  state: PatientState;
  blood: number;
  wounds: number;
  leeches: (Attached | null)[];
  warmed: boolean;
  patience: number;
  panic: number;
  faintCause: FaintCause | null;
  outcome: Patient['outcome'];
  by: number | null;
}

type HandSnap = Exclude<Hand, { kind: 'stretcher' }> | { kind: 'stretcher'; patient: PatientSnap };

interface DoctorSnap {
  x: number;
  y: number;
  facing: Facing;
  flip: boolean;
  moving: boolean;
  running: boolean;
  dazed: number;
  hand: HandSnap | null;
  pumped: number | null;
  stats: DoctorStats;
}

export interface Snapshot {
  clock: number; // shift.elapsed
  stage: number;
  money: number;
  jar: number;
  next: number; // seconds to the next delivery
  device: boolean;
  stove: boolean;
  applied: number;
  lost: number;
  slips: number;
  doctors: DoctorSnap[];
  beds: { p: PatientSnap | null; bites: number[]; freeIn: number; leaving: number }[];
  queue: { id: number; left: number }[];
  floor: [number, number, number, number][]; // id, x, y, angle
  escapees: [number, number, number, number][];
  salting: Salting[];
  orderlies: { id: number; x: number; y: number; facing: Facing; flip: boolean; moving: boolean; load: number }[];
  records: Record<number, PatientRecord>; // men first seen in this snapshot
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

function patientSnap(p: Patient): PatientSnap {
  return {
    id: p.id, state: p.state, blood: r3(p.blood), wounds: p.wounds,
    leeches: p.leeches.map((l) => (l ? { fed: r3(l.fed), wild: l.wild } : null)),
    warmed: p.warmed, patience: r1(p.patience), panic: r3(p.panic),
    faintCause: p.faintCause, outcome: p.outcome, by: p.by,
  };
}

// Server side: one per game, remembering whose records have gone out.
export class Snapshotter {
  private sent = new Set<number>();

  take(w: Ward): Snapshot {
    const records: Record<number, PatientRecord> = {};
    const note = (id: number, rec: PatientRecord) => {
      if (this.sent.has(id)) return;
      this.sent.add(id);
      records[id] = rec;
    };
    for (const q of w.queue) note(q.id, { type: q.type, profile: q.profile, cold: q.cold });
    for (const b of w.beds) if (b.patient) note(b.patient.id, { type: b.patient.type, profile: b.patient.profile, cold: b.patient.cold });
    for (const d of w.doctors) {
      const p = d.hand?.kind === 'stretcher' ? d.hand.patient : null;
      if (p) note(p.id, { type: p.type, profile: p.profile, cold: p.cold });
    }
    return {
      clock: r3(w.shift.elapsed),
      stage: w.shift.stageIndex,
      money: w.shift.money,
      jar: w.supply.jar,
      next: r1(w.supply.nextDelivery),
      device: w.deviceOnStand,
      stove: w.stoveIn,
      applied: w.applied,
      lost: w.lost,
      slips: w.slips,
      doctors: w.doctors.map((d) => ({
        x: r1(d.x), y: r1(d.y), facing: d.facing, flip: d.flip, moving: d.moving, running: d.running,
        dazed: r1(d.dazed), pumped: d.pumped, stats: { ...d.stats },
        hand: d.hand?.kind === 'stretcher' ? { kind: 'stretcher', patient: patientSnap(d.hand.patient) } : d.hand && { ...d.hand },
      })),
      beds: w.beds.map((b) => ({ p: b.patient && patientSnap(b.patient), bites: [...b.bites], freeIn: r1(b.freeIn), leaving: r1(b.leaving) })),
      queue: w.queue.map((q) => ({ id: q.id, left: r1(q.left) })),
      floor: w.floor.map((f) => [f.id, r1(f.x), r1(f.y), r1(f.angle)]),
      escapees: w.escapees.map((e) => [e.id, r1(e.x), r1(e.y), r1(e.angle)]),
      salting: w.salting.map((s) => ({ left: r1(s.left), count: s.count })),
      orderlies: w.orderlies.map((o) => ({ id: o.id, x: r1(o.x), y: r1(o.y), facing: o.facing, flip: o.flip, moving: o.moving, load: o.load })),
      records,
    };
  }
}

// Browser side: pour a snapshot into the mirror ward. `me` is this player's doctor: his
// screen moves him ahead of the server, so his position stays as it is unless the
// server has knocked him down or the two have drifted far apart.
export function applySnapshot(w: Ward, s: Snapshot, records: Map<number, PatientRecord>, me: number | null = null) {
  for (const [id, rec] of Object.entries(s.records)) records.set(Number(id), rec);
  const patient = (ps: PatientSnap, current: Patient | null): Patient | null => {
    let p = current?.id === ps.id ? current : null;
    if (!p) {
      const rec = records.get(ps.id);
      if (!rec) return null;
      p = new Patient(rec.type, rec.profile, rec.cold, ps.id);
    }
    p.state = ps.state;
    p.blood = ps.blood;
    p.wounds = ps.wounds;
    p.leeches = ps.leeches;
    p.warmed = ps.warmed;
    p.patience = ps.patience;
    p.panic = ps.panic;
    p.faintCause = ps.faintCause;
    p.outcome = ps.outcome;
    p.by = ps.by;
    return p;
  };

  w.shift.elapsed = s.clock;
  w.shift.stageIndex = s.stage;
  w.shift.money = s.money;
  w.supply.jar = s.jar;
  w.supply.nextDelivery = s.next;
  w.deviceOnStand = s.device;
  w.stoveIn = s.stove;
  w.applied = s.applied;
  w.lost = s.lost;
  w.slips = s.slips;

  s.doctors.forEach((ds, i) => {
    const d: Doctor | undefined = w.doctors[i];
    if (!d) return;
    const mine = i === me;
    if (!mine || ds.dazed > 0 || Math.hypot(ds.x - d.x, ds.y - d.y) > 40) {
      d.x = ds.x;
      d.y = ds.y;
      d.facing = ds.facing;
      d.flip = ds.flip;
      d.moving = ds.moving;
      d.running = ds.running;
    }
    d.dazed = ds.dazed;
    d.pumped = ds.pumped;
    d.stats = ds.stats;
    const held = d.hand?.kind === 'stretcher' ? d.hand.patient : null;
    d.hand = ds.hand?.kind === 'stretcher'
      ? (() => {
          const p = patient(ds.hand.patient, held);
          return p ? { kind: 'stretcher' as const, patient: p } : null;
        })()
      : ds.hand;
  });

  s.beds.forEach((bs, i) => {
    const b = w.beds[i];
    b.patient = bs.p ? patient(bs.p, b.patient) : null;
    b.bites = bs.bites;
    b.freeIn = bs.freeIn;
    b.leaving = bs.leaving;
  });

  w.queue.length = 0;
  for (const q of s.queue) {
    const rec = records.get(q.id);
    if (rec) w.queue.push({ id: q.id, type: rec.type, profile: rec.profile, cold: rec.cold, left: q.left });
  }
  w.floor.length = 0;
  for (const [id, x, y, angle] of s.floor) w.floor.push({ id, x, y, angle });
  w.escapees.length = 0;
  for (const [id, x, y, angle] of s.escapees) w.escapees.push({ id, x, y, angle, bed: null, t: 0 });
  w.salting.length = 0;
  w.salting.push(...s.salting);
  w.orderlies.length = 0;
  for (const o of s.orderlies) w.orderlies.push({ ...o, route: [], leg: 0, waited: 0 });
}
